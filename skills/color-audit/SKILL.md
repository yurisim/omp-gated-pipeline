---
name: color-audit
description: Main-session coordinator only. Use for explicit color audits or before planning or editing changes to rendered UI color or its meaning; not for non-UI work, prose mentions, or rendering-preserving refactors.
---

# color-audit

> Running in Antigravity? See [antigravity.md](./antigravity.md) for tool mappings.

- **Explicit audit:** run all sections except §5 unless fixes are requested; read small inventories directly and batch `scout`s for multi-screen apps.
- **Scoped UI color edit:** apply §1, §3, and §5 to affected elements only, with no full inventory or standalone report.

## 1. Sources

- When skill://modern-web-guidance is available, retrieve its `color` and `accessibility` guides before judging anything. Without it, section 3 stands alone.
- The project's `AGENTS.md` and the design or audit documents it names are repo rules: a color policy stated there overrides the defaults in section 3, and a conflict between that policy and the user's request goes to the user with `ask`.

## 2. Inventory (audits only)

For multi-screen apps, batch read-only `scout`s in one `task`: one for tokens and shared components, one per screen group. Record per colored element with `path:line`:

- the element and the class, utility, or style binding that colors it;
- the token or literal and its hue name;
- the expression that picks the color, with every key of the map and every threshold;
- what the color is meant to say;
- the explanation the screen already gives (visible text, icon, key, tooltip, `aria-*`), or `not found`.

Search every color source: token files, theme config, hue utilities, inline style bindings, component-library theme overrides.

## 3. Rules

Each violation is one finding. `TEXT`, `STEP`, and `KEY` apply only to meaning-bearing non-neutral colors; purely decorative colors (including brand accents) and neutral surfaces are exempt from semantic cues, not contrast.

| Code | Rule |
| --- | --- |
| `ROLE` | Every color token has exactly one role: severity (error, warning), category, selection/focus/current, brand or decoration, neutral. A token or class used for a second role is a finding (for example a category badge class reused for a status). |
| `HUE` | Two roles never share a hue on one screen. Green, yellow, and red are reserved for OK, warning, and error; categories use other hues. |
| `TEXT` | No color alone (WCAG 1.4.1): the element carries visible text or an icon stating the meaning. A tooltip, `title`, or `aria-label` alone does not count. |
| `STEP` | Use the color only where the user can act on its meaning; elsewhere the element is neutral. |
| `KEY` | A screen showing a category palette or two or more meaning-bearing roles needs a key naming each hue and meaning, built from the same tokens. |
| `CONTRAST` | Text is at least 4.5:1 against its background, large text at least 3:1 (WCAG 1.4.3); icons, graphics, and boundaries the user needs to identify a control or its state at least 3:1 against adjacent colors (WCAG 1.4.11). Composite any translucent tint over the surface it sits on, then compute the ratio; never judge by eye. |
| `SOURCE` | Each hue literal is defined in one token file; templates and components reference the token. |

## 4. Report

Write `local://<topic>-color-audit.md` with two tables: roles (`role | tokens | hue | meaning | screens`) and findings (`id | rule | path:line | what the user sees | fix`). List decoration and neutral surfaces once as roles; report any actual violations.

Use `ask` only for unresolved intent or named project-policy exceptions. Offer rule-compliant options unless a named exception applies; record exceptions in the report.

## 5. Fix and verify

Fixes follow the normal pipeline (plan, skill://parallel-fanout, skill://adversarial-review). The plan's Verification section includes:

- the computed contrast ratio for every changed foreground/background pair;
- one UI or e2e assertion per screen for the on-element cue and any required key;
- a grayscale screenshot of each screen, checked for states that can no longer be told apart.

Pass the rule codes this change touches as `concerns:` in the review SCOPE.
