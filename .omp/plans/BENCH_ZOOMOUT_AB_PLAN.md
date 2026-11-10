# Benchmark harness + zoom-out A/B

## Context

Build a small benchmark harness in this repo (`omp-gated-pipeline`, an omp plugin package; `~/.omp/plugins/node_modules/omp-gated-pipeline` is a symlink to this checkout). The harness runs the gated pipeline headless on a fixed task set and records, per run, hidden-test pass/fail and total tokens across all agents. Its first experiment is an A/B test of one candidate pipeline step taken from Google's elephant-goldfish-model (EGM) "zoom-out" stages: one cross-model review of a plan-mode plan for simplicity, YAGNI, and reuse of existing code, run before plan-preflight. The shipped pipeline (`rules/`, `skills/`, `agents/`) stays unchanged. The treatment step lives only in a benchmark overlay copied into the task workspace, so the user's real sessions are unaffected. Adopting the step permanently is decided from the report, outside this plan.

Fixed decisions:
- Task set: self-authored. One small stdlib-only Python fixture repo (`bench/fixtures/invoicer/`) and 6 tasks. Each task is a prompt plus a hidden unittest file, copied into the workspace only at scoring time. No Docker.
- Size: 6 tasks × 3 repeats × 2 arms (`baseline`, `zoomout`) = 36 runs.
- Mix: 3 plain tasks (2 bug fixes, 1 feature) and 3 trap tasks, where an existing helper should be reused or over-building is tempting.
- Metrics:
  - Primary: pass rate (hidden suite AND public suite pass) and `tokens.total` = input + output + cacheRead + cacheWrite, summed over the main session, subagents, advisors, and side calls.
  - Secondary: cost USD and source lines added (diff excluding `tests/`).

## Findings (verified this session)

- omp 18.18.5 (`omp --help`, omp://cli-reference.md):
  - `-p`, `--mode json`, `--cwd`.
  - `--plan-yolo`: "Force read-only plan mode at start, auto-approve the plan on the model's first resolve call, then switch to --plan-yolo-into". The `--plan-yolo-into` default is the `smol` role.
  - `--session-dir`, `--config <overlay.yml>`, `--no-title`, `--auto-approve`, `--wait-async`, `--max-time`, `--max-cost` (print mode exits 3 at the cap).
- Model roles (`omp config get modelRoles`): `default` = `anthropic/claude-opus-5-5:high`, `smol` = `openai-codex/gpt-6.1-sol:xhigh`. Without an explicit `--plan-yolo-into`, execution would switch the coordinator to Sol. The harness MUST pass the same model to `--model` and `--plan-yolo-into`.
- Session files (omp://session.md): JSONL. The first physical line is a `type:"title"` slot.
  - `type:"message"` entries with `message.role=="assistant"` carry `message.provider`, `message.model`, and `message.usage.{input,output,cacheRead,cacheWrite,totalTokens,cost.total}`.
  - `type:"model_usage"` entries record side calls, with top-level `provider`, `model`, and `usage`.
  - `type:"session_init"` has an optional `agent` field.
  - Subagent transcripts live under `<main-session-path-without-.jsonl>/<id>.jsonl`. Advisor transcripts are `__advisor[.<slug>].jsonl` inside session folders (omp://advisor-watchdog.md).
- Project discovery in the run's cwd (omp://rulebook-matching-pipeline.md:76, omp://task-agent-discovery.md:53, omp://skills.md:91): `<cwd>/.omp/rules/*.md`, `<cwd>/.omp/agents/*.md`, and `.omp` project skills. These carry the treatment overlay.
- Agent frontmatter `advisor` is opt-in (omp://task-agent-discovery.md:49). The zoom-out reviewer omits it, so it is a single Sol pass with no advisor.
- Headless `ask` is not registered (omp://tools/ask.md). Pipeline paths that would `ask` end the run instead; such runs score as fails.
- Setting `memory.backend` (default `off`; this user runs mnemopi). The overlay forces `"off"` so benchmark runs neither read nor write the user's memories.
- This repo has no AGENTS.md, so the pipeline uses the no-barrier path. Tests are stdlib `unittest` (`python -m unittest discover -s tests -v`). Python 3.13 and git 2.55 are installed.
- `rules/gated-pipeline.md:9` forbids LLM plan review "unless the user explicitly asks". The treatment overlay rule amends this bullet for the benchmark workspace only.

## Approach

Ordered by dependency. Wave 0 files are written verbatim by the coordinator; wave 1 slices are independent; wave 2 needs wave 1.

1. **Wave 0: verbatim artifacts** (coordinator writes; content in section "Wave 0 files"): `bench/tasks.json`, `bench/fixtures/invoicer/AGENTS.md`, fixture public tests (`bench/fixtures/invoicer/tests/__init__.py`, `test_money.py`, `test_models.py`, `test_storage.py`, `test_cli.py`), six hidden tests `bench/tasks/<id>/test_hidden.py`, and `tests/test_bench_metrics.py`.
2. **S1: fixture package and reference solutions** (synth). Implement `bench/fixtures/invoicer/invoicer/` to the contract in "Fixture contract", including the two seeded bugs. Write one reference solution per task as full-file replacements under `bench/tasks/<id>/reference/<path relative to fixture root>`. Each reference starts from the base file and applies the smallest change that satisfies the task prompt.
3. **S2: harness library** (synth). `bench/common.py` covers workspace preparation, suites, and diff stats. `bench/metrics.py` aggregates session usage. Contracts are in "Harness contract".
4. **S3: zoom-out overlay** (sonic, exact text in "Zoom-out overlay files"). Three markdown files under `bench/arms/zoomout/.omp/`.
5. **S4: harness CLIs** (synth, wave 2). `bench/check_tasks.py`, `bench/run.py`, `bench/report.py`, `bench/omp-overlay.yml`, and `.gitignore` gaining `bench/results/`. Contracts are in "Harness contract".

### Fixture contract (S1)

Package `invoicer` uses Python ≥3.10 and the stdlib only; every amount is a `decimal.Decimal`.
- `money.py`:
  - `CENT = Decimal("0.01")`.
  - `quantize(value: Decimal) -> Decimal` rounds to `CENT` with `ROUND_HALF_UP`.
  - `format_money(value: Decimal, currency: str = "USD") -> str` returns `f"{currency} {quantize(value):,.2f}"`.
- `tax.py`:
  - `class UnknownTaxCode(ValueError)`.
  - `RATES = {"US-CA": {"standard": Decimal("0.0725"), "food": Decimal("0")}, "DE": {"standard": Decimal("0.19"), "food": Decimal("0.07")}}`.
  - `rate_for(region: str, tax_code: str) -> Decimal` raises `UnknownTaxCode(f"{region}/{tax_code}")` when the region or code is missing.
- `discounts.py`:
  - `class UnknownDiscount(ValueError)`.
  - `DISCOUNTS = {"WELCOME10": Decimal("0.10")}`.
  - `discount_amount(subtotal: Decimal, code: str | None) -> Decimal`: returns `Decimal("0")` for `None`; raises `UnknownDiscount(code)` for an unknown code; otherwise returns `quantize(subtotal * DISCOUNTS[code])`.
- `models.py`:
  - `@dataclass LineItem(sku: str, description: str, unit_price: Decimal, quantity: int, tax_code: str = "standard")` with `amount() -> Decimal` = `unit_price * quantity` (unrounded).
  - `@dataclass Invoice(number: str, customer: str, region: str, items: list[LineItem] = field(default_factory=list), discount_code: str | None = None)` with these methods:
    - `subtotal()` = `quantize(sum of item.amount())`.
    - `discount()` = `discount_amount(self.subtotal(), self.discount_code)`.
    - `tax()`: **SEEDED BUG.** Returns `sum(quantize(item.amount() * rate_for(self.region, item.tax_code)) for item in items)`, rounding per line. Start the sum from `Decimal("0")`.
    - `total()` = `subtotal() - discount() + tax()`. Tax is computed on the undiscounted amounts.
- `storage.py`:
  - `invoice_to_dict(inv) -> dict` returns the keys `number`, `customer`, `region`, `discount_code`, and `items`. Each item has `sku`, `description`, `unit_price` (str), `quantity` (int), and `tax_code`.
  - `invoice_from_dict(data: dict) -> Invoice`: **SEEDED BUG.** It never reads `discount_code`, so the result always has `None`. Items use `item.get("tax_code", "standard")`.
  - `save_invoice(inv: Invoice, path: str) -> None` writes `json.dump(..., indent=2)` as UTF-8.
  - `load_invoice(path: str) -> Invoice`.
- `render.py`: `render_text(inv: Invoice, currency: str = "USD") -> str`. It returns these lines joined by `"\n"` plus a trailing `"\n"`; every amount goes through `format_money(..., currency)`:
  - `Invoice <number>`
  - `Customer: <customer>`
  - one line per item: `<sku>  <description>  x<quantity>  <amount>`
  - `Subtotal: <..>`
  - `Discount: <..>`, only when `discount_code` is set
  - `Tax: <..>`
  - `Total: <..>`
- `cli.py`: `main(argv: list[str] | None = None) -> int`.
  - argparse `prog="invoicer"` with subcommands `total <path>` (prints `format_money(inv.total())`) and `render <path>` (`print(render_text(inv), end="")`). Both return 0.
  - `UnknownTaxCode`, `UnknownDiscount`, and `OSError` print `error: <message>` to stderr and return 1.
- `__main__.py`: `raise SystemExit(main())`. `__init__.py` is empty.

Reference solution file per task (path under `bench/tasks/<id>/reference/`):

| Task id | Reference file | Change |
| --- | --- | --- |
| `tax-grouped-rounding` | `invoicer/models.py` | `tax()` sums unrounded amounts per `tax_code`, quantizes each group's `sum * rate` once, then adds the groups |
| `csv-export` | `invoicer/cli.py` | `csv` subcommand using the `csv` module, `lineterminator="\n"`, amounts as `f"{quantize(x):.2f}"` |
| `discount-roundtrip` | `invoicer/storage.py` | `discount_code=data.get("discount_code")` |
| `summary-command` | `invoicer/cli.py` | `summary` subcommand reusing `format_money(inv.total())` |
| `spring-discount` | `invoicer/discounts.py` | add `"SPRING5": Decimal("0.05")` |
| `currency-option` | `invoicer/cli.py` | `--currency` (default `USD`) on `total` and `render`, passed to `format_money` / `render_text` |

### Harness contract (S2, S4)

`bench/common.py` (stdlib only; every subprocess call uses an argument list, never `shell=True`):
- `prepare_workspace(fixture: Path, ws: Path, overlay: Path | None = None) -> None`, in this order:
  1. `shutil.copytree(fixture, ws, ignore=shutil.ignore_patterns("__pycache__"))`.
  2. `git init -q`, then `git config core.autocrlf false`, `git config user.name bench`, and `git config user.email bench@localhost`.
  3. Append the lines `.omp/`, `.scratch/`, and `__pycache__/` to `ws/.git/info/exclude`.
  4. `git add -A`, then `git commit -qm base`.
  5. If `overlay` is set: `shutil.copytree(overlay, ws, dirs_exist_ok=True)`. The overlay is copied after the commit and git excludes it, so it never shows in diffs.
- `apply_files(src: Path, ws: Path) -> None` = `shutil.copytree(src, ws, dirs_exist_ok=True)`. It applies a reference solution.
- `diff_stats(ws: Path) -> dict` runs `git add -A`, then `git diff --cached --ignore-cr-at-eol --numstat HEAD`; numstat rows with `-` counts are skipped. It returns `{"files_changed": int, "lines_added_total": int, "lines_removed_total": int, "lines_added_src": int, "patch": str}`.
  - `lines_added_src` excludes paths that start with `tests/`.
  - `patch` is the output of `git diff --cached --ignore-cr-at-eol HEAD`.
  - Call it before `run_suites`, so the copied hidden test is never counted.
- `run_suites(ws: Path, hidden_test: Path | None, timeout: int = 300) -> dict` runs two suites:
  - Public suite first: `[sys.executable, "-m", "unittest", "discover", "-s", "tests", "-t", "."]` with `cwd=ws`.
  - Then, if `hidden_test` is set: copy it to `ws/tests/test_hidden_bench.py` and run `[sys.executable, "-m", "unittest", "tests.test_hidden_bench"]` with `cwd=ws`.
  - Returns `{"public_pass": bool, "hidden_pass": bool | None, "public_output": str, "hidden_output": str}`. Outputs are the last 4000 chars of stdout+stderr. A timeout counts as a fail with output `"timeout"`.

`bench/metrics.py`, `aggregate_usage(session_dir: Path) -> dict`:
- Walk every `*.jsonl` under `session_dir` recursively. A missing directory returns the all-zero shape.
- Classify each file:
  - `advisor` if its name starts with `__advisor`.
  - otherwise `subagent` if some ancestor directory `D` below `session_dir` has a sibling file `D.parent / (D.name + ".jsonl")`.
  - otherwise `main`.
- Parse each non-blank line as JSON. Count failures in `malformed_lines`.
- Usage comes from assistant `message` entries (`message.usage`, model `f"{message.provider}/{message.model}"`) and from `model_usage` entries (`usage`, model `f"{provider}/{model}"`).
- Sum `input`, `output`, `cacheRead`, and `cacheWrite` (missing fields count as 0). `total` is the sum of those four; never read `totalTokens`. `cost` sums `usage.cost.total` (missing counts as 0).
- Return:

  ```
  {"input", "output", "cacheRead", "cacheWrite", "total", "cost",
   "by_class": {"main"|"subagent"|"advisor": {same six keys}},
   "by_model": {model: {same six keys}},
   "agents": {agent: count},
   "main_models": sorted unique models,
   "malformed_lines": int}
  ```

  - `by_class` always has all three keys.
  - `agents` counts, per subagent file, the `agent` of its first `session_init` entry that has a string `agent`.
  - `main_models` lists models of assistant messages in `main` files only.

`bench/check_tasks.py`, `python bench/check_tasks.py [--tasks id,id]`:
- For each task in `bench/tasks.json`, use a fresh `tempfile.mkdtemp(prefix="ompbench-check-")`:
  1. `prepare_workspace(fixture, ws)`, then `run_suites`. It must give `public_pass is True` and `hidden_pass is False`.
  2. In a second fresh workspace: prepare, `apply_files(reference_dir, ws)`, then `run_suites`. Both suites must pass.
- Print one line per task: `<id>  base: public=PASS hidden=FAIL  reference: public=PASS hidden=PASS  OK|BAD`.
- Exit 0 only if every task is OK. Delete temp dirs.

`bench/run.py`:
- Flags and defaults:

  | Flag | Default |
  | --- | --- |
  | `--arms` | `baseline,zoomout` |
  | `--tasks` | all ids from `bench/tasks.json` |
  | `--repeats` | 3 |
  | `--jobs` | 2 |
  | `--max-time` | `40m` |
  | `--max-cost` | `10` |
  | `--coordinator-model` | `anthropic/claude-opus-5-5:high` |
  | `--out` | `bench/results/<YYYYmmdd-HHMMSS>` |
  | `--omp` | `shutil.which("omp")`; exit 2 with `error: omp not found on PATH` if None |

  Also `--keep-workspaces` and `--dry-run`.
- Arms: `{"baseline": None, "zoomout": REPO/bench/arms/zoomout}` (the overlay dir). An unknown arm name is a usage error (exit 2).
- Run order:
  - Loop `repeat` in 1..R, then each task (index `i`).
  - Arms go in listed order when `(repeat + i) % 2 == 0`, else reversed. This interleaves arms and alternates their order.
  - Submit runs in that order to `ThreadPoolExecutor(max_workers=jobs)`.
- Run id is `f"{task}__r{repeat}__{arm}"`, in run dir `<out>/runs/<run id>/`.
- Skip a run whose `result.json` already exists, so rerunning with the same `--out` resumes.
- Per run:
  1. `ws = tempfile.mkdtemp(prefix="ompbench-")` (a subdirectory `ws/repo` is the workspace), then `prepare_workspace(fixture, ws/repo, overlay)`.
  2. Invoke this command:

     ```
     [omp, "-p", "--mode", "json", "--cwd", ws/repo, "--model", M, "--plan-yolo", "--plan-yolo-into", M,
      "--session-dir", rundir/"sessions", "--config", REPO/"bench/omp-overlay.yml", "--no-title",
      "--auto-approve", "--wait-async", "--max-time", T, "--max-cost", C, "--", prompt]
     ```

     - Write stdout to `rundir/events.jsonl` and stderr to `rundir/stderr.txt`.
     - Hard kill at `max-time + 300 s` (parse `NNm`/`NNs`/plain seconds), then set `timed_out: true`.
  3. Collect metrics:
     - `diff_stats` (write `patch` to `rundir/patch.diff` and drop it from the result).
     - `run_suites(ws/repo, REPO/bench/tasks/<id>/test_hidden.py)`.
     - `aggregate_usage(rundir/"sessions")`.
  4. `valid` is true when every entry of `main_models` equals `M` with its `:<suffix>` removed. `pass` = `public_pass and hidden_pass is True`.
  5. Write `rundir/result.json` with: `run_id, task, kind, arm, repeat, exit_code, timed_out, wall_s, valid, pass, public_pass, hidden_pass, files_changed, lines_added_src, lines_added_total, tokens` (the whole `aggregate_usage` result) and `zoomout_invoked` (`tokens["agents"].get("zoomout-reviewer", 0)`).
     - Also append the same object as one line to `<out>/results.jsonl` under a `threading.Lock`.
     - Delete `ws` unless `--keep-workspaces`.
  6. If `exit_code` is non-zero, still score the run. Model and omp failures are outcomes, not harness errors.
- `--dry-run` prints each run id and its argv (as a JSON list), one per line, in submission order, and runs nothing.
- Print `<run id>  pass=<bool>  tokens=<total>  exit=<code>` as each run finishes.

`bench/report.py`, `python bench/report.py <out dir>`:
- Read `<out>/results.jsonl`. Print `excluded invalid runs: N` and leave those runs out.
- Print markdown tables:
  1. Per arm: `arm | runs | zoomout invoked | pass | pass rate | mean tokens | median tokens | mean cost $ | mean src lines added`.
  2. Per kind (`plain`/`trap`) × arm: `pass rate | mean tokens`.
  3. Per task × arm: `passes/runs | mean tokens`.
- Then two delta lines (`zoomout − baseline`) with 95% bootstrap CIs, one for pass rate and one for mean tokens.
  - Bootstrap: `random.Random(0)`, 10,000 resamples, stratified by task. Each task's runs are resampled with replacement separately per arm, then pooled.
  - Print the deltas only when both arms have runs.
- An empty or missing results file prints `no results` and exits 1.

`bench/omp-overlay.yml`:

```yaml
memory:
  backend: "off"
```

`.gitignore`: append the line `bench/results/`.

## Wave 0 files

`bench/tasks.json`:

```json
[
  {"id": "tax-grouped-rounding", "kind": "plain", "prompt": "Invoice tax is wrong for invoices with many small lines: `Invoice.tax()` rounds each line's tax to the cent before summing, so cents get lost. Change it so tax is computed per tax code: sum the unrounded line amounts that share a `tax_code`, multiply each sum by its rate, round each group's tax once to the cent (half-up), and add the group results. `total()` must use the corrected tax."},
  {"id": "csv-export", "kind": "plain", "prompt": "Add a `csv` subcommand: `python -m invoicer csv <path>` prints the invoice's line items as CSV to stdout. Header row `sku,description,quantity,unit_price,line_total`, then one row per item in invoice order. `unit_price` and `line_total` (unit_price × quantity) are plain decimals with exactly two places and no currency or thousands separator, for example `1234.50`. Use standard CSV quoting (fields containing commas or quotes are quoted). Exit code 0."},
  {"id": "discount-roundtrip", "kind": "plain", "prompt": "Saving an invoice and loading it back loses its discount code: `load_invoice` returns `discount_code=None` even when the saved invoice had one. Fix the round trip. Files saved without a `discount_code` key must still load, with `discount_code` None."},
  {"id": "summary-command", "kind": "trap", "prompt": "Add a `summary` subcommand: `python -m invoicer summary <path>` prints exactly three lines: `Customer: <customer>`, `Items: <total quantity across all lines>`, `Total: <invoice total>`. Format the total the same way the existing `total` subcommand does. Exit code 0."},
  {"id": "spring-discount", "kind": "trap", "prompt": "Marketing wants a new discount code `SPRING5`: 5% off the subtotal, rounded to the cent like the existing `WELCOME10` code."},
  {"id": "currency-option", "kind": "trap", "prompt": "Add a `--currency CODE` option to the `total` and `render` subcommands (default `USD`). It only changes the currency label printed before amounts, for example `EUR 1,234.50`; amounts are not converted. Exit code 0."}
]
```

`bench/fixtures/invoicer/AGENTS.md`:

```markdown
# invoicer

Small invoicing library and CLI. Python 3.10+, standard library only; never add dependencies.

## Pipeline - invoicer specifics

- Barrier: none (no-barrier path).
- Integration command, from the repository root: `python -m unittest discover -s tests -t . -v`
- Test ids: unittest dotted ids, e.g. `tests.test_models.InvoiceTest.test_totals`.
- Skip markers: none allowed.
- Slice-forbidden commands: `pip install` and any dependency change.
- Baseline worktree: `git worktree add --detach <dir> $BASE`; no setup needed.
- KNOWN sources: none.
- Review conventions: skill defaults.
```

`bench/fixtures/invoicer/tests/__init__.py`: empty file.

`bench/fixtures/invoicer/tests/test_money.py`:

```python
import unittest
from decimal import Decimal

from invoicer.money import format_money, quantize


class MoneyTest(unittest.TestCase):
    def test_quantize_rounds_half_up(self):
        self.assertEqual(quantize(Decimal("0.005")), Decimal("0.01"))
        self.assertEqual(quantize(Decimal("2.344")), Decimal("2.34"))

    def test_format_money(self):
        self.assertEqual(format_money(Decimal("1234.5")), "USD 1,234.50")
        self.assertEqual(format_money(Decimal("-5"), "EUR"), "EUR -5.00")


if __name__ == "__main__":
    unittest.main()
```

`bench/fixtures/invoicer/tests/test_models.py`:

```python
import unittest
from decimal import Decimal

from invoicer.discounts import UnknownDiscount
from invoicer.models import Invoice, LineItem
from invoicer.tax import UnknownTaxCode


def make(region="US-CA", discount_code=None):
    return Invoice(number="N1", customer="Acme", region=region,
                   items=[LineItem("A", "Widget", Decimal("10.00"), 2)], discount_code=discount_code)


class InvoiceTest(unittest.TestCase):
    def test_totals(self):
        inv = make()
        self.assertEqual(inv.subtotal(), Decimal("20.00"))
        self.assertEqual(inv.tax(), Decimal("1.45"))
        self.assertEqual(inv.total(), Decimal("21.45"))

    def test_welcome_discount(self):
        inv = make(discount_code="WELCOME10")
        self.assertEqual(inv.discount(), Decimal("2.00"))
        self.assertEqual(inv.total(), Decimal("19.45"))

    def test_unknown_region(self):
        with self.assertRaises(UnknownTaxCode):
            make(region="XX").tax()

    def test_unknown_discount(self):
        with self.assertRaises(UnknownDiscount):
            make(discount_code="NOPE").total()


if __name__ == "__main__":
    unittest.main()
```

`bench/fixtures/invoicer/tests/test_storage.py`:

```python
import os
import tempfile
import unittest
from decimal import Decimal

from invoicer.models import Invoice, LineItem
from invoicer.storage import load_invoice, save_invoice


class StorageTest(unittest.TestCase):
    def test_round_trip(self):
        inv = Invoice(number="N1", customer="Acme", region="DE",
                      items=[LineItem("A", "Widget", Decimal("10.00"), 2, "food")])
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "inv.json")
            save_invoice(inv, path)
            self.assertEqual(load_invoice(path), inv)


if __name__ == "__main__":
    unittest.main()
```

`bench/fixtures/invoicer/tests/test_cli.py`:

```python
import io
import os
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from decimal import Decimal

from invoicer.cli import main
from invoicer.models import Invoice, LineItem
from invoicer.storage import save_invoice


class CliTest(unittest.TestCase):
    def setUp(self):
        self._dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self._dir.name, "inv.json")
        save_invoice(Invoice(number="N1", customer="Acme", region="US-CA",
                             items=[LineItem("A", "Widget", Decimal("10.00"), 2)]), self.path)

    def tearDown(self):
        self._dir.cleanup()

    def run_cli(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = main(list(argv))
        return code, out.getvalue(), err.getvalue()

    def test_total(self):
        self.assertEqual(self.run_cli("total", self.path), (0, "USD 21.45\n", ""))

    def test_render(self):
        code, out, _ = self.run_cli("render", self.path)
        self.assertEqual(code, 0)
        self.assertIn("Total: USD 21.45", out.splitlines())

    def test_missing_file(self):
        code, _, err = self.run_cli("total", os.path.join(self._dir.name, "nope.json"))
        self.assertEqual(code, 1)
        self.assertTrue(err.startswith("error: "))


if __name__ == "__main__":
    unittest.main()
```

`bench/tasks/tax-grouped-rounding/test_hidden.py`:

```python
import unittest
from decimal import Decimal

from invoicer.models import Invoice, LineItem


def inv(region, items):
    return Invoice(number="T1", customer="c", region=region, items=items)


class HiddenTaxGroupingTest(unittest.TestCase):
    def test_small_lines_grouped(self):
        items = [LineItem(f"S{i}", "pen", Decimal("0.05"), 1) for i in range(3)]
        self.assertEqual(inv("US-CA", items).tax(), Decimal("0.01"))

    def test_groups_rounded_separately(self):
        items = [
            LineItem("A", "a", Decimal("0.05"), 3),
            LineItem("B", "b", Decimal("0.07"), 1, "food"),
            LineItem("C", "c", Decimal("0.07"), 1, "food"),
        ]
        self.assertEqual(inv("DE", items).tax(), Decimal("0.04"))

    def test_total_uses_grouped_tax(self):
        items = [LineItem(f"S{i}", "pen", Decimal("0.05"), 1) for i in range(3)]
        self.assertEqual(inv("US-CA", items).total(), Decimal("0.16"))


if __name__ == "__main__":
    unittest.main()
```

`bench/tasks/csv-export/test_hidden.py`:

```python
import io
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from decimal import Decimal

from invoicer.cli import main
from invoicer.models import Invoice, LineItem
from invoicer.storage import save_invoice


class HiddenCsvTest(unittest.TestCase):
    def test_csv_rows(self):
        inv = Invoice(number="T2", customer="Acme", region="US-CA", items=[
            LineItem("W-1", "Widget, large", Decimal("1234.5"), 2),
            LineItem("G-2", 'Gadget "mini"', Decimal("0.1"), 3, "food"),
        ])
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "inv.json")
            save_invoice(inv, path)
            out = io.StringIO()
            with redirect_stdout(out):
                code = main(["csv", path])
        self.assertEqual(code, 0)
        self.assertEqual(out.getvalue().splitlines(), [
            "sku,description,quantity,unit_price,line_total",
            'W-1,"Widget, large",2,1234.50,2469.00',
            'G-2,"Gadget ""mini""",3,0.10,0.30',
        ])


if __name__ == "__main__":
    unittest.main()
```

`bench/tasks/discount-roundtrip/test_hidden.py`:

```python
import json
import os
import tempfile
import unittest
from decimal import Decimal

from invoicer.models import Invoice, LineItem
from invoicer.storage import load_invoice, save_invoice


class HiddenDiscountRoundTripTest(unittest.TestCase):
    def test_round_trip_keeps_code(self):
        inv = Invoice(number="T3", customer="c", region="DE",
                      items=[LineItem("A", "a", Decimal("10.00"), 1)], discount_code="WELCOME10")
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "inv.json")
            save_invoice(inv, path)
            loaded = load_invoice(path)
        self.assertEqual(loaded.discount_code, "WELCOME10")
        self.assertEqual(loaded.total(), Decimal("10.90"))

    def test_missing_key_loads_as_none(self):
        data = {"number": "T3", "customer": "c", "region": "DE", "items": [
            {"sku": "A", "description": "a", "unit_price": "1.00", "quantity": 1, "tax_code": "standard"}]}
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "inv.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f)
            self.assertIsNone(load_invoice(path).discount_code)


if __name__ == "__main__":
    unittest.main()
```

`bench/tasks/summary-command/test_hidden.py`:

```python
import io
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from decimal import Decimal

from invoicer.cli import main
from invoicer.models import Invoice, LineItem
from invoicer.storage import save_invoice


class HiddenSummaryTest(unittest.TestCase):
    def test_summary(self):
        inv = Invoice(number="T4", customer="Acme", region="US-CA", items=[
            LineItem("A", "a", Decimal("500.00"), 2),
            LineItem("B", "b", Decimal("10.00"), 3, "food"),
        ])
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "inv.json")
            save_invoice(inv, path)
            out = io.StringIO()
            with redirect_stdout(out):
                code = main(["summary", path])
        self.assertEqual(code, 0)
        self.assertEqual(out.getvalue().splitlines(), ["Customer: Acme", "Items: 5", "Total: USD 1,102.50"])


if __name__ == "__main__":
    unittest.main()
```

`bench/tasks/spring-discount/test_hidden.py`:

```python
import unittest
from decimal import Decimal

from invoicer.discounts import UnknownDiscount, discount_amount
from invoicer.models import Invoice, LineItem


class HiddenSpringDiscountTest(unittest.TestCase):
    def test_spring5_rounds_half_up(self):
        self.assertEqual(discount_amount(Decimal("19.99"), "SPRING5"), Decimal("1.00"))

    def test_invoice_total_with_spring5(self):
        inv = Invoice(number="T5", customer="c", region="US-CA",
                      items=[LineItem("A", "a", Decimal("100.00"), 1)], discount_code="SPRING5")
        self.assertEqual(inv.total(), Decimal("102.25"))

    def test_existing_codes_unchanged(self):
        self.assertEqual(discount_amount(Decimal("100.00"), "WELCOME10"), Decimal("10.00"))
        with self.assertRaises(UnknownDiscount):
            discount_amount(Decimal("1.00"), "NOPE")


if __name__ == "__main__":
    unittest.main()
```

`bench/tasks/currency-option/test_hidden.py`:

```python
import io
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from decimal import Decimal

from invoicer.cli import main
from invoicer.models import Invoice, LineItem
from invoicer.storage import save_invoice


class HiddenCurrencyTest(unittest.TestCase):
    def setUp(self):
        self._dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self._dir.name, "inv.json")
        save_invoice(Invoice(number="T6", customer="Acme", region="US-CA", items=[
            LineItem("A", "a", Decimal("500.00"), 2),
            LineItem("B", "b", Decimal("10.00"), 3, "food"),
        ]), self.path)

    def tearDown(self):
        self._dir.cleanup()

    def run_cli(self, *argv):
        out = io.StringIO()
        with redirect_stdout(out):
            code = main(list(argv))
        return code, out.getvalue()

    def test_total_eur(self):
        code, out = self.run_cli("total", self.path, "--currency", "EUR")
        self.assertEqual((code, out.strip()), (0, "EUR 1,102.50"))

    def test_render_eur(self):
        code, out = self.run_cli("render", self.path, "--currency", "EUR")
        self.assertEqual(code, 0)
        self.assertIn("Total: EUR 1,102.50", out.splitlines())
        self.assertNotIn("USD", out)

    def test_default_stays_usd(self):
        code, out = self.run_cli("total", self.path)
        self.assertEqual((code, out.strip()), (0, "USD 1,102.50"))


if __name__ == "__main__":
    unittest.main()
```

`tests/test_bench_metrics.py`:

```python
"""Behavior tests for bench/metrics.py token aggregation (stdlib unittest)."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "bench"))

import metrics  # noqa: E402


def usage(inp, out, cache_read, cache_write, cost):
    return {"input": inp, "output": out, "cacheRead": cache_read, "cacheWrite": cache_write,
            "totalTokens": inp + out + cache_read + cache_write, "cost": {"total": cost}}


def assistant(provider, model, u):
    return {"type": "message", "message": {"role": "assistant", "provider": provider, "model": model,
                                           "content": [], "usage": u}}


def write_jsonl(path, records, extra_lines=()):
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(r) for r in records] + list(extra_lines)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


class AggregateUsageTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_sums_main_subagent_advisor_and_side_calls(self):
        bucket = self.root / "bucket"
        write_jsonl(bucket / "100_main.jsonl", [
            {"type": "title", "title": ""},
            {"type": "session", "id": "main"},
            {"type": "message", "message": {"role": "user", "content": "hi"}},
            assistant("anthropic", "claude-opus-5-5", usage(10, 5, 100, 1, 0.5)),
            {"type": "model_usage", "purpose": "title", "provider": "anthropic", "model": "claude-x",
             "usage": usage(2, 3, 0, 0, 0.01)},
        ], extra_lines=["{not json"])
        write_jsonl(bucket / "100_main" / "1-Synth.jsonl", [
            {"type": "session", "id": "sub"},
            {"type": "session_init", "agent": "synth"},
            assistant("openai-codex", "gpt-6.1-sol", usage(20, 10, 0, 0, 1.0)),
        ])
        write_jsonl(bucket / "100_main" / "__advisor.jsonl", [
            {"type": "session", "id": "adv"},
            assistant("openai-codex", "gpt-6.1-sol", usage(1, 1, 0, 0, 0.1)),
        ])

        result = metrics.aggregate_usage(self.root)

        self.assertEqual((result["input"], result["output"], result["cacheRead"], result["cacheWrite"]),
                         (33, 19, 100, 1))
        self.assertEqual(result["total"], 153)
        self.assertAlmostEqual(result["cost"], 1.61)
        self.assertEqual(result["by_class"]["main"]["input"], 12)
        self.assertEqual(result["by_class"]["subagent"]["input"], 20)
        self.assertEqual(result["by_class"]["advisor"]["input"], 1)
        self.assertEqual(result["by_model"]["openai-codex/gpt-6.1-sol"]["total"], 32)
        self.assertEqual(result["agents"], {"synth": 1})
        self.assertEqual(result["main_models"], ["anthropic/claude-opus-5-5"])
        self.assertEqual(result["malformed_lines"], 1)

    def test_missing_dir_is_all_zero(self):
        result = metrics.aggregate_usage(self.root / "absent")
        self.assertEqual(result["total"], 0)
        self.assertEqual(result["by_class"]["subagent"]["total"], 0)
        self.assertEqual(result["agents"], {})
        self.assertEqual(result["main_models"], [])


if __name__ == "__main__":
    unittest.main()
```

## Zoom-out overlay files

`bench/arms/zoomout/.omp/rules/zoomout-stage.md`:

```markdown
---
description: Zoom-out stage - one cross-model simplicity and reuse review of plan-mode plans before preflight
alwaysApply: true
agents: main
---

Zoom-out stage (enabled for this project). This amends the Plans bullet of the gated-pipeline rule: after drafting a plan-mode plan (local://*-plan.md) and before running skill://plan-preflight on it, run skill://plan-zoomout exactly once. It is the plan's only LLM review and does not count as the post-implementation review pass.
```

`bench/arms/zoomout/.omp/skills/plan-zoomout/SKILL.md`:

```markdown
---
name: plan-zoomout
description: Main-session coordinator only. One cross-model zoom-out review (simplicity, YAGNI, reuse of existing code) of a drafted plan-mode plan, before skill://plan-preflight.
---

# plan-zoomout

Run once per plan, after the plan is drafted and before skill://plan-preflight.

1. Spawn one `task` with agent `zoomout-reviewer`. Context: `Zoom-out review of a plan before implementation.` Task: `PLAN: local://<slug>-plan.md`, a newline, `INTENT: <the user's request verbatim>`, a newline, `Return at most 5 findings.`
2. For each finding: apply it to the plan when it removes work or reuses existing code without dropping anything INTENT asks for; otherwise reject it with a one-line reason in your reply. Never spawn a second zoom-out review, including after plan edits.
3. Continue with skill://plan-preflight.
```

`bench/arms/zoomout/.omp/agents/zoomout-reviewer.md`:

```markdown
---
name: zoomout-reviewer
description: Zoom-out review of a plan-mode plan on Sol - simplicity, YAGNI, reuse of existing code. Read-only. Use via skill://plan-zoomout.
model: "openai-codex/gpt-6.1-sol:high"
tools: read, grep, glob
---

You review a plan before anyone implements it. Read PLAN in full, then read the code it touches.

Report only these, each grounded in the repository:
- REUSE: the plan writes something that already exists. Cite the existing `path:line`.
- DROP: a step, file, abstraction, option, or test that INTENT does not need. Quote the INTENT text it goes beyond, or state that INTENT never asks for it.
- SIMPLIFY: a shorter way to the same observable behavior. Name the plan lines it replaces.

Not findings: correctness bugs, style, naming, missing tests, generic best practice, anything the plan needs to meet INTENT.

Output at most 5 findings, most lines saved first, one per line:
`<REUSE|DROP|SIMPLIFY> plan:<line> - <what to change> - evidence: <path:line or INTENT quote>`
If there are none, output exactly `NO FINDINGS`.
```

## Critical files & anchors

- `rules/gated-pipeline.md:9`: the "no LLM review" Plans bullet that the overlay rule amends. Leave the shipped file unchanged.
- `skills/plan-preflight/SKILL.md:10`: the preflight invocation path that the pipeline uses inside benchmark workspaces (via the plugin symlink). No change needed.
- `tests/test_preflight.py:1-42`: the unittest and tempdir conventions that `tests/test_bench_metrics.py` follows.

## Parallel waves

Wave 0: the coordinator writes every file in "Wave 0 files" verbatim. There is no barrier in this repo, so wave0-red is skipped. Record `no spec tests; no wave0-red.json`.

Wave 1:

```json
[
  {"id": "S1", "agent": "synth",
   "owns": ["[NEW] bench/fixtures/invoicer/invoicer/__init__.py", "[NEW] bench/fixtures/invoicer/invoicer/__main__.py", "[NEW] bench/fixtures/invoicer/invoicer/money.py", "[NEW] bench/fixtures/invoicer/invoicer/tax.py", "[NEW] bench/fixtures/invoicer/invoicer/discounts.py", "[NEW] bench/fixtures/invoicer/invoicer/models.py", "[NEW] bench/fixtures/invoicer/invoicer/storage.py", "[NEW] bench/fixtures/invoicer/invoicer/render.py", "[NEW] bench/fixtures/invoicer/invoicer/cli.py", "[NEW] bench/tasks/tax-grouped-rounding/reference/invoicer/models.py", "[NEW] bench/tasks/csv-export/reference/invoicer/cli.py", "[NEW] bench/tasks/discount-roundtrip/reference/invoicer/storage.py", "[NEW] bench/tasks/summary-command/reference/invoicer/cli.py", "[NEW] bench/tasks/spring-discount/reference/invoicer/discounts.py", "[NEW] bench/tasks/currency-option/reference/invoicer/cli.py"],
   "reads": ["[NEW] bench/tasks.json", "[NEW] bench/fixtures/invoicer/AGENTS.md", "[NEW] bench/fixtures/invoicer/tests/test_money.py", "[NEW] bench/fixtures/invoicer/tests/test_models.py", "[NEW] bench/fixtures/invoicer/tests/test_storage.py", "[NEW] bench/fixtures/invoicer/tests/test_cli.py", "[NEW] bench/tasks/tax-grouped-rounding/test_hidden.py", "[NEW] bench/tasks/csv-export/test_hidden.py", "[NEW] bench/tasks/discount-roundtrip/test_hidden.py", "[NEW] bench/tasks/summary-command/test_hidden.py", "[NEW] bench/tasks/spring-discount/test_hidden.py", "[NEW] bench/tasks/currency-option/test_hidden.py"],
   "symbols": [
     {"path": "[NEW] bench/fixtures/invoicer/invoicer/money.py", "name": "[NEW] format_money", "signature": "format_money(value: Decimal, currency: str = \"USD\") -> str", "contract": "f\"{currency} {quantize(value):,.2f}\"; quantize is ROUND_HALF_UP to 0.01"},
     {"path": "[NEW] bench/fixtures/invoicer/invoicer/tax.py", "name": "[NEW] rate_for", "signature": "rate_for(region: str, tax_code: str) -> Decimal", "contract": "RATES lookup; missing region or code raises UnknownTaxCode(ValueError)"},
     {"path": "[NEW] bench/fixtures/invoicer/invoicer/discounts.py", "name": "[NEW] discount_amount", "signature": "discount_amount(subtotal: Decimal, code: str | None) -> Decimal", "contract": "None -> 0; unknown -> UnknownDiscount(ValueError); else quantize(subtotal * DISCOUNTS[code]); DISCOUNTS = {WELCOME10: 0.10}"},
     {"path": "[NEW] bench/fixtures/invoicer/invoicer/models.py", "name": "[NEW] Invoice.tax", "signature": "tax(self) -> Decimal", "contract": "SEEDED BUG in base: per-line quantize then sum; reference for tax-grouped-rounding groups by tax_code and quantizes once per group"},
     {"path": "[NEW] bench/fixtures/invoicer/invoicer/storage.py", "name": "[NEW] invoice_from_dict", "signature": "invoice_from_dict(data: dict) -> Invoice", "contract": "SEEDED BUG in base: discount_code always None; items tax_code defaults to standard"},
     {"path": "[NEW] bench/fixtures/invoicer/invoicer/render.py", "name": "[NEW] render_text", "signature": "render_text(inv: Invoice, currency: str = \"USD\") -> str", "contract": "lines per plan Fixture contract, every amount via format_money(x, currency), trailing newline"},
     {"path": "[NEW] bench/fixtures/invoicer/invoicer/cli.py", "name": "[NEW] main", "signature": "main(argv: list[str] | None = None) -> int", "contract": "subcommands total and render; UnknownTaxCode/UnknownDiscount/OSError -> stderr 'error: <msg>', return 1"}
   ],
   "invariants": ["stdlib only, Python >=3.10", "every module, class, constant and signature exactly as in the plan's Fixture contract", "base fixture public tests pass; each task's hidden test fails on the base fixture", "each reference file = the base file plus the smallest change satisfying that task's prompt in bench/tasks.json; references never touch tests", "never edit wave-0 test files, AGENTS.md or tasks.json"],
   "tests": [],
   "acceptance": "python -m unittest discover -s tests -t . -v  (cwd: bench/fixtures/invoicer)"},
  {"id": "S2", "agent": "synth",
   "owns": ["[NEW] bench/common.py", "[NEW] bench/metrics.py"],
   "reads": ["[NEW] tests/test_bench_metrics.py", "tests/test_preflight.py"],
   "symbols": [
     {"path": "[NEW] bench/common.py", "name": "[NEW] prepare_workspace", "signature": "prepare_workspace(fixture: Path, ws: Path, overlay: Path | None = None) -> None", "contract": "copy fixture, git init+config+exclude(.omp/, .scratch/, __pycache__/)+commit base, then copy overlay"},
     {"path": "[NEW] bench/common.py", "name": "[NEW] apply_files", "signature": "apply_files(src: Path, ws: Path) -> None", "contract": "copytree(src, ws, dirs_exist_ok=True)"},
     {"path": "[NEW] bench/common.py", "name": "[NEW] diff_stats", "signature": "diff_stats(ws: Path) -> dict", "contract": "git add -A; numstat vs HEAD with --ignore-cr-at-eol; keys files_changed, lines_added_total, lines_removed_total, lines_added_src (excl tests/), patch"},
     {"path": "[NEW] bench/common.py", "name": "[NEW] run_suites", "signature": "run_suites(ws: Path, hidden_test: Path | None, timeout: int = 300) -> dict", "contract": "public discover first, then copy hidden to tests/test_hidden_bench.py and run it; keys public_pass, hidden_pass, public_output, hidden_output"},
     {"path": "[NEW] bench/metrics.py", "name": "[NEW] aggregate_usage", "signature": "aggregate_usage(session_dir: Path) -> dict", "contract": "per plan Harness contract; total = input+output+cacheRead+cacheWrite; classes main/subagent/advisor; agents from session_init.agent"}
   ],
   "invariants": ["stdlib only", "subprocess calls use argument lists, never shell=True", "missing session_dir returns the all-zero shape with all three by_class keys"],
   "tests": [],
   "acceptance": "python -m unittest discover -s tests -p test_bench_metrics.py -v"},
  {"id": "S3", "agent": "sonic",
   "owns": ["[NEW] bench/arms/zoomout/.omp/rules/zoomout-stage.md", "[NEW] bench/arms/zoomout/.omp/skills/plan-zoomout/SKILL.md", "[NEW] bench/arms/zoomout/.omp/agents/zoomout-reviewer.md"],
   "reads": [],
   "symbols": [],
   "invariants": ["file contents exactly as in the plan's Zoom-out overlay files section"],
   "tests": [],
   "acceptance": "python -c \"import pathlib,sys; ps=['bench/arms/zoomout/.omp/rules/zoomout-stage.md','bench/arms/zoomout/.omp/skills/plan-zoomout/SKILL.md','bench/arms/zoomout/.omp/agents/zoomout-reviewer.md']; sys.exit(0 if all(pathlib.Path(p).read_text(encoding='utf-8').startswith('---') for p in ps) else 1)\""}
]
```

Wave 2:

```json
[
  {"id": "S4", "agent": "synth",
   "owns": ["[NEW] bench/check_tasks.py", "[NEW] bench/run.py", "[NEW] bench/report.py", "[NEW] bench/omp-overlay.yml", ".gitignore"],
   "reads": ["[NEW] bench/common.py", "[NEW] bench/metrics.py", "[NEW] bench/tasks.json"],
   "symbols": [
     {"path": "[NEW] bench/run.py", "name": "[NEW] main", "signature": "main(argv: list[str] | None = None) -> int", "contract": "flags, order, omp argv, per-run scoring and result.json per plan Harness contract"},
     {"path": "[NEW] bench/report.py", "name": "[NEW] main", "signature": "main(argv: list[str] | None = None) -> int", "contract": "per-arm, per-kind, per-task markdown tables plus stratified bootstrap deltas; no results -> exit 1"},
     {"path": "[NEW] bench/check_tasks.py", "name": "[NEW] main", "signature": "main(argv: list[str] | None = None) -> int", "contract": "base: public pass + hidden fail; reference: both pass; exit 0 only if all tasks OK"}
   ],
   "invariants": ["stdlib only", "scripts import common/metrics via sys.path of their own directory", "run.py passes the same model to --model and --plan-yolo-into", "results never written outside --out; workspaces live in the OS temp dir"],
   "tests": [],
   "acceptance": "python bench/check_tasks.py && python bench/run.py --dry-run"}
]
```

Integration command (this repo has no AGENTS.md, so the no-barrier path applies): `python -m unittest discover -s tests -v && python bench/check_tasks.py`.

## Verification

All commands run from the repo root `C:/Users/yuras/projects/omp-gated-pipeline`, under bash.

1. `python -m unittest discover -s tests -v`: the existing preflight tests and the 2 new metrics tests pass.
2. `python bench/check_tasks.py`: 6 lines, each `base: public=PASS hidden=FAIL  reference: public=PASS hidden=PASS  OK`; exit 0. This proves every hidden test is reachable from its prompt and is not already satisfied by the base fixture.
3. `python bench/run.py --dry-run`: 36 lines. For each (repeat, task) pair, the two arms are adjacent, and their order alternates between consecutive pairs. Every argv contains `--plan-yolo-into anthropic/claude-opus-5-5:high`, and only `zoomout` runs differ by workspace overlay (not visible in argv).
4. Live smoke (costs model usage, about 2 runs): `python bench/run.py --tasks spring-discount --repeats 1 --out bench/results/smoke`. Expected in `bench/results/smoke/runs/*/result.json`:
   - both runs: `valid: true`, `tokens.total > 0`, `tokens.by_class.subagent.total > 0`, `pass` set, and `main_models == ["anthropic/claude-opus-5-5"]`.
   - baseline: `zoomout_invoked == 0`.
   - zoomout: `zoomout_invoked == 1`.
   - `patch.diff` is non-empty and has no `.omp/` paths.
5. `python bench/report.py bench/results/smoke` prints the three tables and both delta lines.
6. Full experiment: `python bench/run.py`, then `python bench/report.py bench/results/<stamp>`.

## Assumptions & contingencies

- Budget defaults (user-overridable flags): `--max-cost 10` USD and `--max-time 40m` per run, `--jobs 2`. The worst case for the full run is 36 × $10.
- If smoke step 4 shows `zoomout_invoked == 0` for the zoomout arm (the project rule was not loaded or was not followed), add `--append-system-prompt <ws>/repo/.omp/rules/zoomout-stage.md` to the zoomout arm's argv in `run.py`, keep the overlay copy as is, and rerun step 4.
- If `omp` rejects `anthropic/claude-opus-5-5:high` as a `--model` / `--plan-yolo-into` value, change the `--coordinator-model` default to `anthropic/claude-opus-5-5` and add `--thinking high` to the argv.
- If a `--plan-yolo` run exits right after the plan is approved without editing files (empty `patch.diff` and no `synth` in `tokens.agents`), drop `--plan-yolo`/`--plan-yolo-into` and prefix the prompt with `Plan this change in plan form first (local://<task-id>-plan.md, gated pipeline rules apply), then execute it. ` for both arms.
- If smoke shows `tokens.agents` non-empty in `events.jsonl` (task calls happened) but `tokens.by_class.subagent.total == 0`, the subagent transcripts are stored outside `--session-dir`. Locate them via the main session file path printed in the `events.jsonl` session header, then extend `aggregate_usage` to also walk `<main session path without .jsonl>/`.
