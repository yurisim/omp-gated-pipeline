import { describe, expect, jest, setSystemTime, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionCommand, ExtensionContext, ExtensionHandler, SwarmMessage, SwarmSnapshot, SwarmStoreLike } from "../extensions/omp-swarm/types";

// Lazy per-test imports: wave-1 slices create state.ts and server.ts in parallel, so each
// `-t` filter must load only its own module. Static imports would fail the whole file.
const STATE = "../extensions/omp-swarm/state";
const SERVER = "../extensions/omp-swarm/server";
const EXT = "../extensions/omp-swarm/index";
// 1x1 transparent PNG.
const PNG_BYTES = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64"));
const T0 = 1_700_000_000_000;
const COORD = { id: "coordinator", name: "coordinator", role: "Coordinator", kind: "main" as const, model: "m" };

/** Member id from a stall alert: the first `@<id>` mention in its text. */
function stalled(messages: SwarmMessage[]): string[] {
	return messages.map(m => m.text.match(/@([\w.-]+)/)?.[1] ?? "?").sort();
}

function emptySnapshot(overrides: Partial<SwarmSnapshot> = {}): SwarmSnapshot {
	return {
		goalTitle: "Goal",
		goalSummary: "",
		live: true,
		startedAt: 1,
		totalTasks: 0,
		doneTasks: 0,
		autoStartThreshold: 3,
		threads: [],
		members: [],
		messages: [],
		runningSummary: "",
		attention: [],
		milestones: [],
		risks: [],
		reel: [],
		...overrides,
	};
}

describe("SwarmStore", () => {
	test("SwarmStore parse helpers never throw", async () => {
		const { parseSliceJson, parseSynthOutput, extractAgentTarget } = await import(STATE);
		expect(parseSliceJson("not json")).toBeNull();
		expect(parseSliceJson('{"id":"S1","owns":["a.ts"],"agent":"synth"}')).toEqual({ id: "S1", owns: ["a.ts"], agent: "synth" });
		expect(parseSynthOutput("plain prose, no payload")).toBeNull();
		expect(parseSynthOutput('done\n```json\n{"edits":["a.ts"],"specConflict":[],"checks":"ok"}\n```')).toMatchObject({
			edits: ["a.ts"],
			specConflict: [],
			checks: "ok",
		});
		expect(extractAgentTarget("agent://S1")).toBe("S1");
		expect(extractAgentTarget("agent://S1/model")).toBeNull();
		expect(extractAgentTarget("agent://S1/effort")).toBeNull();
		expect(extractAgentTarget("agent://peers")).toBeNull();
		expect(extractAgentTarget("agent://all")).toBeNull();
		expect(extractAgentTarget("local://notes.md")).toBeNull();
	});

	test("SwarmStore tracks batches, messages, completion, retirement and one-shot auto-start", async () => {
		const { SwarmStore } = await import(STATE);
		const autoStarts: SwarmSnapshot[] = [];
		const store = new SwarmStore({ onAutoStart: (s: SwarmSnapshot) => autoStarts.push(s) });
		let notified = 0;
		const unsubscribe = store.subscribe(() => notified++);

		store.setGoal("Ship omp-swarm", "UI for fanout");
		store.registerMember({ id: "coordinator", name: "coordinator", role: "Coordinator", kind: "main", model: "m-main" });

		const t1 = store.recordTaskBatch("Wave 1", [
			{ name: "S1", agent: "synth", task: '{"id":"S1","owns":["a.ts"]}' },
			{ name: "S2", agent: "sonic", task: "docs" },
		]);
		let snap: SwarmSnapshot = store.getSnapshot();
		expect(snap.goalTitle).toBe("Ship omp-swarm");
		expect(snap.autoStartThreshold).toBe(3);
		expect(snap.threads).toHaveLength(1);
		expect(snap.threads[0]).toMatchObject({ id: t1, title: "Wave 1", memberIds: ["S1", "S2"], totalCount: 2, doneCount: 0, status: "running" });
		expect(snap.totalTasks).toBe(2);
		expect(snap.messages.map(m => [m.seq, m.tag, m.from, m.to])).toEqual([
			[1, "spawn", "coordinator", "S1"],
			[2, "spawn", "coordinator", "S2"],
		]);
		expect(snap.members.find(m => m.id === "S1")).toMatchObject({ kind: "sub", threadId: t1 });
		expect(autoStarts).toHaveLength(0);
		expect(notified).toBeGreaterThan(0);

		const edit = store.recordAgentMessage("coordinator", "S1", "Apply ADV1", "owner-edit");
		expect(edit).toMatchObject({ seq: 3, tag: "owner-edit", from: "coordinator", to: "S1" });

		store.recordTaskBatch("Wave 2", [{ name: "S3", agent: "synth" }]);
		expect(autoStarts).toHaveLength(1);
		expect(autoStarts[0].totalTasks).toBe(3);
		store.recordTaskBatch("Wave 3", [{ name: "S4", agent: "synth" }]);
		expect(autoStarts).toHaveLength(1);

		store.completeMember("S1", 'Result:\n```json\n{"edits":["a.ts"],"specConflict":[],"checks":"ok"}\n```');
		store.completeMember("S2", '{"edits":[],"specConflict":["types.ts:4 contradicts plan"]}');
		store.completeMember("S3", "crashed", true);
		snap = store.getSnapshot();
		expect(snap.members.find(m => m.id === "S1")?.status).toBe("done");
		expect(snap.members.find(m => m.id === "S2")?.status).toBe("blocked");
		expect(snap.members.find(m => m.id === "S3")?.status).toBe("blocked");
		expect(snap.doneTasks).toBe(1);
		expect(snap.totalTasks).toBe(4);
		expect(snap.threads.find(t => t.id === t1)).toMatchObject({ doneCount: 1, status: "blocked" });
		const doneMsg = snap.messages.find(m => m.from === "S1" && m.tag === "done");
		expect(doneMsg?.jsonPayload).toMatchObject({ edits: ["a.ts"] });
		expect(snap.messages.some(m => m.from === "S2" && m.tag === "blocked")).toBe(true);

		const seqs = snap.messages.map(m => m.seq);
		expect(seqs).toEqual(seqs.map((_, i) => i + 1));

		store.retireMember("S1");
		snap = store.getSnapshot();
		const s1 = snap.members.find(m => m.id === "S1");
		expect(s1?.status).toBe("retired");
		expect(typeof s1?.endedAt).toBe("number");
		expect(snap.doneTasks).toBe(1);
		expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);

		unsubscribe();
		const before = notified;
		store.setGoal("Changed");
		expect(notified).toBe(before);

		store.reset();
		snap = store.getSnapshot();
		expect(snap.members).toHaveLength(0);
		expect(snap.messages).toHaveLength(0);
		expect(snap.threads).toHaveLength(0);
	});

	test("SwarmStore single wave of three fires auto-start once", async () => {
		const { SwarmStore } = await import(STATE);
		let fired = 0;
		const store = new SwarmStore({ onAutoStart: () => fired++ });
		store.recordTaskBatch("Wave 1", [{ name: "A" }, { name: "B" }, { name: "C" }]);
		store.recordTaskBatch("Wave 2", [{ name: "D" }]);
		expect(fired).toBe(1);

		let jumped = 0;
		const big = new SwarmStore({ onAutoStart: () => jumped++ });
		big.recordTaskBatch("Wave 1", [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }]);
		expect(jumped).toBe(1);
	});

	test("SwarmStore parseScreenshots extracts image frames only and never throws", async () => {
		const { parseScreenshots } = await import(STATE);
		const raw = [
			"Screenshot: C:/tmp/a.PNG | Overview layout",
			"screenshot: /x/b.jpeg|Board",
			"Screenshot: /x/c.webp | Reel",
			"Screenshot: /x/d.jpg | Members",
			"Screenshot: /x/e.txt | not an image",
			"Screenshot: /x/f.png",
			"see Screenshot: /x/g.png | mid-line",
			"Screenshot: \\\\evil.example\\s\\x.png | UNC share",
			"Screenshot: //evil.example/s/x.png | UNC share",
			"Screenshot: rel/x.png | relative path",
			`Screenshot: /x/h.png | ${"c".repeat(300)}`,
		].join("\n");
		const frames = parseScreenshots(raw);
		expect(frames).toHaveLength(5);
		expect(frames.slice(0, 4)).toEqual([
			{ path: "C:/tmp/a.PNG", caption: "Overview layout" },
			{ path: "/x/b.jpeg", caption: "Board" },
			{ path: "/x/c.webp", caption: "Reel" },
			{ path: "/x/d.jpg", caption: "Members" },
		]);
		expect(frames[4].path).toBe("/x/h.png");
		expect(frames[4].caption).toHaveLength(120);
		expect(parseScreenshots("")).toEqual([]);
		expect(() => parseScreenshots(undefined as unknown as string)).not.toThrow();
	});

	test("SwarmStore captures a bounded, deduplicated progress reel", async () => {
		const { SwarmStore } = await import(STATE);
		const store = new SwarmStore();
		store.recordTaskBatch("Wave 1", [{ name: "S1" }]);
		const first = store.recordAgentMessage("S1", "coordinator", "Done\nScreenshot: /x/a.png | First frame");
		store.recordAgentMessage("S1", "coordinator", "Screenshot: /x/a.png | Same path again");
		let snap: SwarmSnapshot = store.getSnapshot();
		expect(snap.reel).toEqual([{ index: 0, path: "/x/a.png", caption: "First frame", seq: first.seq, from: "S1", timestamp: first.timestamp }]);
		expect(store.getReelFramePath(0)).toBe("/x/a.png");
		expect(store.getReelFramePath(1)).toBeNull();
		expect(store.getReelFramePath(-1)).toBeNull();

		for (let i = 1; i <= 30; i++) store.recordAgentMessage("S1", "coordinator", `Screenshot: /x/${i}.png | Frame ${i}`);
		snap = store.getSnapshot();
		expect(snap.reel).toHaveLength(24);
		expect(snap.reel.map(f => f.index)).toEqual(Array.from({ length: 24 }, (_, i) => i));
		expect(snap.reel[0].path).toBe("/x/7.png");
		expect(snap.reel[23].path).toBe("/x/30.png");
		expect(store.getReelFramePath(23)).toBe("/x/30.png");
		snap.reel[0].path = "/etc/passwd";
		expect(store.getReelFramePath(0)).toBe("/x/7.png");
	});

	test("SwarmStore bounds stored history while keeping #seq monotonic", async () => {
		const { SwarmStore } = await import(STATE);
		const store = new SwarmStore({ maxMessages: 5 });
		store.recordTaskBatch("Wave 1", Array.from({ length: 8 }, (_, i) => ({ name: `S${i + 1}` })));
		let snap: SwarmSnapshot = store.getSnapshot();
		expect(snap.messages.map(m => m.seq)).toEqual([4, 5, 6, 7, 8]);
		const next = store.recordAgentMessage("S1", "coordinator", "x".repeat(3000));
		expect(next.seq).toBe(9);
		expect(next.text).toHaveLength(2000);
		snap = store.getSnapshot();
		expect(snap.messages.map(m => m.seq)).toEqual([5, 6, 7, 8, 9]);
		expect(snap.members.find(m => m.id === "S1")?.lastSeq).toBe(9);
		store.reset();
		expect(store.recordAgentMessage("a", "b", "fresh").seq).toBe(1);

		const unbounded = new SwarmStore();
		for (let i = 0; i < 501; i++) unbounded.recordAgentMessage("a", "b", `m${i}`);
		const seqs = unbounded.getSnapshot().messages.map((m: SwarmMessage) => m.seq);
		expect([seqs.length, seqs[0], seqs.at(-1)]).toEqual([500, 2, 501]);
	});

	test("SwarmStore derives summary, ranked attention, milestones, risks and ordered threads", async () => {
		const { SwarmStore } = await import(STATE);
		expect(new SwarmStore().getSnapshot()).toMatchObject({ runningSummary: "Idle", attention: [], milestones: [], risks: [], reel: [] });
		setSystemTime(new Date(T0));
		try {
			const store = new SwarmStore({ stallThresholdMs: 1000 });
			store.registerMember(COORD);
			const doneId = store.recordTaskBatch("Done wave", [{ name: "S1" }]);
			const runningId = store.recordTaskBatch("Running wave", [{ name: "S2" }, { name: "S3" }]);
			const blockedId = store.recordTaskBatch("Blocked wave", [{ name: "S4" }]);
			store.completeMember("S1", '{"edits":["a.ts"],"specConflict":[],"planDeviations":["Used a Map instead of an array"]}');
			store.completeMember("S4", '{"edits":[],"specConflict":["types.ts:4 contradicts plan"]}');
			const edit = store.recordAgentMessage("coordinator", "S2", "Apply ADV1", "owner-edit");

			let snap: SwarmSnapshot = store.getSnapshot();
			const s1Done = snap.messages.find(m => m.from === "S1" && m.tag === "done")!;
			const s4Blocked = snap.messages.find(m => m.from === "S4" && m.tag === "blocked")!;
			expect(snap.runningSummary).toBe("2 working (S2, S3), 1 blocked (S4); 1 of 4 tasks done");
			expect(snap.threads.map(t => t.id)).toEqual([blockedId, runningId, doneId]);
			expect(snap.attention.map(a => [a.kind, a.severity, a.memberId, a.seq])).toEqual([
				["decision", "med", "S2", edit.seq],
				["failure", "high", "S4", s4Blocked.seq],
				["review", "med", "S1", s1Done.seq],
			]);
			const failure = snap.attention[1];
			const blockedThread = snap.threads.find(t => t.id === blockedId)!;
			expect(blockedThread.attentionIds).toContain(failure.id);
			expect(blockedThread.now).toContain("Blocked");
			for (const t of snap.threads) expect(t.now.length).toBeGreaterThan(0);
			for (const m of snap.members) expect(m.now.length).toBeGreaterThan(0);
			expect(snap.milestones).toEqual([expect.objectContaining({ id: `m-${s1Done.seq}`, seq: s1Done.seq, memberId: "S1", text: expect.stringContaining("a.ts") })]);
			expect(snap.risks).toHaveLength(2);
			expect(snap.risks).toEqual(expect.arrayContaining([
				expect.objectContaining({ id: `r-${s1Done.seq}-0`, seq: s1Done.seq, memberId: "S1", text: expect.stringContaining("Used a Map") }),
				expect.objectContaining({ id: `r-${s4Blocked.seq}-0`, seq: s4Blocked.seq, memberId: "S4", text: expect.stringContaining("types.ts:4") }),
			]));

			expect(stalled(store.checkStalls(T0 + 1000))).toEqual(["S2", "S3"]);
			snap = store.getSnapshot();
			expect(snap.attention.map(a => a.kind)).toEqual(["decision", "failure", "review", "stuck", "stuck"]);
			const stuck = snap.attention.filter(a => a.kind === "stuck");
			expect(stuck.map(a => a.severity)).toEqual(["high", "high"]);
			expect(stuck.map(a => a.memberId).sort()).toEqual(["S2", "S3"]);
			expect(stuck[0].seq!).toBeGreaterThan(stuck[1].seq!);

			setSystemTime(new Date(T0 + 1000));
			store.recordAgentMessage("S2", "coordinator", "Applied ADV1");
			snap = store.getSnapshot();
			expect(snap.attention.map(a => [a.kind, a.memberId])).toEqual([["failure", "S4"], ["review", "S1"], ["stuck", "S3"]]);
			expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
		} finally {
			setSystemTime();
		}
	});

	test("SwarmStore checkStalls alerts without repeating, caps at three and resets on activity", async () => {
		const { SwarmStore } = await import(STATE);
		setSystemTime(new Date(T0));
		try {
			const idle = new SwarmStore({ stallThresholdMs: 1000 });
			idle.registerMember(COORD);
			expect(idle.checkStalls(T0 + 10_000_000)).toEqual([]);

			const store = new SwarmStore({ stallThresholdMs: 1000 });
			store.registerMember(COORD);
			store.recordTaskBatch("Wave 1", [{ name: "S1" }, { name: "S2" }]);
			expect(store.checkStalls(T0 + 999)).toEqual([]);
			const first = store.checkStalls(T0 + 1000);
			expect(first.map(m => [m.tag, m.from, m.to])).toEqual([["stall", "monitor", "coordinator"], ["stall", "monitor", "coordinator"]]);
			expect(stalled(first)).toEqual(["S1", "S2"]);
			const text = first.map(m => m.text).join("\n");
			expect(text).toContain("#1");
			expect(text).toContain("#2");
			expect(store.getSnapshot().messages.filter(m => m.tag === "stall")).toHaveLength(2);
			expect(store.checkStalls(T0 + 1500)).toEqual([]);

			setSystemTime(new Date(T0 + 1600));
			store.recordAgentMessage("S2", "coordinator", "still going");
			expect(stalled(store.checkStalls(T0 + 2000))).toEqual(["S1"]);
			expect(stalled(store.checkStalls(T0 + 3000))).toEqual(["S1", "S2"]);
			expect(stalled(store.checkStalls(T0 + 4000))).toEqual(["S2"]);
			expect(stalled(store.checkStalls(T0 + 9000))).toEqual(["S2"]);
			expect(store.checkStalls(T0 + 20_000)).toEqual([]);

			setSystemTime(new Date(T0 + 20_000));
			store.recordAgentMessage("S1", "coordinator", "back");
			expect(store.checkStalls(T0 + 20_999)).toEqual([]);
			expect(stalled(store.checkStalls(T0 + 21_000))).toEqual(["S1"]);

			store.completeMember("S1", "ok");
			store.completeMember("S2", "ok");
			expect(store.getSnapshot().attention.some(a => a.kind === "stuck")).toBe(false);
			expect(store.checkStalls(T0 + 10_000_000)).toEqual([]);
			// Dormant once no member works, even with an overdue unanswered owner-edit.
			store.recordAgentMessage("coordinator", "S1", "Late edit", "owner-edit");
			const stalls = store.getSnapshot().messages.filter(m => m.tag === "stall").length;
			expect(store.checkStalls(T0 + 20_000_000)).toEqual([]);
			expect(store.getSnapshot().messages.filter(m => m.tag === "stall")).toHaveLength(stalls);
		} finally {
			setSystemTime();
		}
	});

	test("SwarmStore checkStalls flags an owner-edit its recipient has not answered", async () => {
		const { SwarmStore } = await import(STATE);
		setSystemTime(new Date(T0));
		try {
			const store = new SwarmStore({ stallThresholdMs: 1000 });
			store.registerMember(COORD);
			store.recordTaskBatch("Wave 1", [{ name: "S1" }, { name: "S2" }]);
			store.completeMember("S1", "ok");
			setSystemTime(new Date(T0 + 1500));
			store.recordAgentMessage("S2", "coordinator", "progress");
			const edit = store.recordAgentMessage("coordinator", "S1", "Apply ADV1", "owner-edit");
			expect(store.getSnapshot().attention).toContainEqual(expect.objectContaining({ kind: "decision", memberId: "S1", seq: edit.seq }));
			expect(store.checkStalls(T0 + 2400)).toEqual([]);
			expect(stalled(store.checkStalls(T0 + 2500))).toEqual(["S1", "S2"]);

			setSystemTime(new Date(T0 + 2600));
			store.recordAgentMessage("S1", "coordinator", "Applied ADV1");
			const snap = store.getSnapshot();
			expect(snap.attention.some(a => a.memberId === "S1" && (a.kind === "decision" || a.kind === "stuck"))).toBe(false);
		} finally {
			setSystemTime();
		}
	});

	test("SwarmStore noteActivity counts tool activity without board messages", async () => {
		const { SwarmStore } = await import(STATE);
		setSystemTime(new Date(T0));
		try {
			const store = new SwarmStore({ stallThresholdMs: 1000 });
			store.registerMember(COORD);
			store.recordTaskBatch("Wave 1", [{ name: "S1" }]);
			const count = store.getSnapshot().messages.length;
			setSystemTime(new Date(T0 + 900));
			store.noteActivity("S1");
			store.noteActivity("unknown");
			expect(store.getSnapshot().messages).toHaveLength(count);
			expect(store.checkStalls(T0 + 1500)).toEqual([]);
			expect(stalled(store.checkStalls(T0 + 1900))).toEqual(["S1"]);
		} finally {
			setSystemTime();
		}
	});

	test("SwarmStore applyPlanLayout sets the goal, task descriptions and outcome threads", async () => {
		const { SwarmStore } = await import(STATE);
		const store = new SwarmStore();
		store.applyPlanLayout({ tasks: { S1: "Store logic", S2: "Reel endpoint" } });
		const original = store.recordTaskBatch("Task batch", [{ name: "S1" }, { name: "S2" }, { name: "S3" }]);
		store.completeMember("S2", "ok");
		const layout = {
			goal: { title: "Upgrade swarm", line: "Adopt narrator patterns" },
			threads: [{ id: "outcome-ui", title: "UI polish", goal: "Ship the Overview", tasks: ["S2", "S3", "S9"] }],
		};
		store.applyPlanLayout(layout);
		store.applyPlanLayout(layout);
		let snap: SwarmSnapshot = store.getSnapshot();
		expect(snap.goalTitle).toBe("Upgrade swarm");
		expect(snap.goalSummary).toBe("Adopt narrator patterns");
		expect(snap.threads).toHaveLength(2);
		expect(snap.threads.find(t => t.id === "outcome-ui")).toMatchObject({ title: "UI polish", memberIds: ["S2", "S3"], doneCount: 1, totalCount: 2, status: "running" });
		expect(snap.threads.find(t => t.id === original)).toMatchObject({ memberIds: ["S1"], doneCount: 0, totalCount: 1, status: "running" });
		expect(snap.members.find(m => m.id === "S2")).toMatchObject({ threadId: "outcome-ui", description: "Reel endpoint" });
		expect(snap.members.find(m => m.id === "S1")?.description).toBe("Store logic");
		expect(snap.members.find(m => m.id === "S3")?.description).toBe("");
		expect([snap.doneTasks, snap.totalTasks]).toEqual([1, 3]);

		store.completeMember("S3", "ok");
		snap = store.getSnapshot();
		expect(snap.threads.find(t => t.id === "outcome-ui")).toMatchObject({ doneCount: 2, status: "done" });
		store.applyPlanLayout({});
		expect(store.getSnapshot().goalTitle).toBe("Upgrade swarm");
	});

	test("disambiguates duplicate batch titles using descriptive task names or numeric suffix", async () => {
		const { SwarmStore } = await import(STATE);
		const store = new SwarmStore();
		store.recordTaskBatch("Make triage tokenBudget user-configurable", [
			{ name: "TriageApi", agent: "synth" },
			{ name: "TriageUi", agent: "synth" },
		]);
		store.recordTaskBatch("Make triage tokenBudget user-configurable", [
			{ name: "TriageE2e", agent: "synth" },
			{ name: "TriageDocs", agent: "sonic" },
		]);
		store.recordTaskBatch("Make triage tokenBudget user-configurable", [
			{ name: "S5", agent: "synth" },
			{ name: "S6", agent: "sonic" },
		]);
		store.recordTaskBatch("Make triage tokenBudget user-configurable", [
			{ name: "S7", agent: "synth" },
			{ name: "S8", agent: "synth" },
		]);
		const titles = store.getSnapshot().threads.map(t => t.title);
		expect(titles).toEqual([
			"Make triage tokenBudget user-configurable",
			"TriageE2e, TriageDocs",
			"Make triage tokenBudget user-configurable (2)",
			"Make triage tokenBudget user-configurable (3)",
		]);
	});
});

interface StubStore {
	listeners: Set<(s: SwarmSnapshot) => void>;
	stats: { unsubscribed: number };
	store: SwarmStoreLike;
}

function stubStore(snap: SwarmSnapshot): StubStore {
	const listeners = new Set<(s: SwarmSnapshot) => void>();
	const stats = { unsubscribed: 0 };
	return {
		listeners,
		stats,
		store: {
			getSnapshot: () => snap,
			subscribe(fn) {
				listeners.add(fn);
				return () => {
					if (listeners.delete(fn)) stats.unsubscribed++;
				};
			},
		},
	};
}

interface SseFrames {
	reader: ReadableStreamDefaultReader<Uint8Array>;
	next(): Promise<{ event: string; data: SwarmSnapshot }>;
}

// Reads whole SSE frames (terminated by a blank line) and parses their JSON data payload.
function sseFrames(body: ReadableStream<Uint8Array>): SseFrames {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	return {
		reader,
		async next() {
			for (;;) {
				let end = buffer.indexOf("\n\n");
				while (end < 0) {
					const { value, done } = await reader.read();
					if (done) throw new Error("SSE stream ended mid-frame");
					buffer += decoder.decode(value, { stream: true });
					end = buffer.indexOf("\n\n");
				}
				const lines = buffer.slice(0, end).split("\n");
				buffer = buffer.slice(end + 2);
				const data = lines.filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart());
				if (data.length === 0) continue; // comment / keep-alive frame
				const event = lines.find(l => l.startsWith("event:"))?.slice(6).trim() ?? "message";
				return { event, data: JSON.parse(data.join("\n")) as SwarmSnapshot };
			}
		},
	};
}

describe("SwarmServer", () => {
	test("SwarmServer serves UI, state and SSE frames; client cancel unsubscribes", async () => {
		const { startSwarmServer } = await import(SERVER);
		const snap = emptySnapshot({ goalTitle: "Server goal" });
		const { store, listeners, stats } = stubStore(snap);
		const handle = startSwarmServer(store, { port: 0 });
		try {
			expect(handle.url.startsWith("http://127.0.0.1:")).toBe(true);
			expect(handle.port).toBeGreaterThan(0);

			const page = await fetch(handle.url);
			expect(page.status).toBe(200);
			expect(page.headers.get("content-type")).toContain("text/html");
			const html = await page.text();
			for (const tab of ["Overview", "Board", "Members", "Graph"]) expect(html).toContain(`data-tab="${tab}"`);
			expect(html).not.toMatch(/<script[^>]+src=/i);
			expect(html).not.toMatch(/<link[^>]+stylesheet/i);

			const state = await fetch(new URL("/api/state", handle.url));
			expect(state.status).toBe(200);
			expect(await state.json()).toEqual(snap);

			expect((await fetch(new URL("/nope", handle.url))).status).toBe(404);

			const abort = new AbortController();
			const events = await fetch(new URL("/api/events", handle.url), { signal: abort.signal });
			expect(events.headers.get("content-type")).toContain("text/event-stream");
			const frames = sseFrames(events.body!);
			expect(await frames.next()).toEqual({ event: "snapshot", data: snap });
			expect(listeners.size).toBe(1);
			const updated = emptySnapshot({ goalTitle: "Updated goal" });
			for (const fn of listeners) fn(updated);
			expect(await frames.next()).toEqual({ event: "update", data: updated });
			abort.abort();
			await frames.reader.cancel().catch(() => {});
			// Bun delivers the client disconnect asynchronously; poll briefly for the unsubscribe it triggers.
			for (let i = 0; i < 100 && stats.unsubscribed === 0; i++) await Bun.sleep(10);
			expect(stats.unsubscribed).toBe(1);
		} finally {
			handle.stop();
		}
		await expect(fetch(handle.url)).rejects.toThrow();
	});

	test("SwarmServer stop() releases an open SSE subscription exactly once", async () => {
		const { startSwarmServer } = await import(SERVER);
		const { store, listeners, stats } = stubStore(emptySnapshot());
		const handle = startSwarmServer(store, { port: 0 });
		let frames: SseFrames | undefined;
		try {
			const events = await fetch(new URL("/api/events", handle.url));
			frames = sseFrames(events.body!);
			expect((await frames.next()).event).toBe("snapshot");
			expect(listeners.size).toBe(1);
		} finally {
			handle.stop();
		}
		expect(stats.unsubscribed).toBe(1);
		expect(listeners.size).toBe(0);
		handle.stop();
		expect(stats.unsubscribed).toBe(1);
		await frames?.reader.cancel().catch(() => {});
	});

	test("SwarmServer serves only registered image reel frames", async () => {
		const { startSwarmServer } = await import(SERVER);
		const dir = mkdtempSync(join(tmpdir(), "omp-swarm-reel-"));
		let handle: { url: string; stop(): void } | undefined;
		try {
			const png = join(dir, "frame.png");
			const txt = join(dir, "secret.txt");
			const webp = join(dir, "later.webp");
			const webpBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
			writeFileSync(png, PNG_BYTES);
			writeFileSync(txt, "secret");
			writeFileSync(webp, webpBytes);
			const paths = [png, txt, join(dir, "missing.png"), webp];
			const { store } = stubStore(emptySnapshot());
			handle = startSwarmServer({ ...store, getReelFramePath: (i: number) => paths[i] ?? null }, { port: 0 });
			const url = handle!.url;
			const ok = await fetch(new URL("/api/reel/0", url));
			expect(ok.status).toBe(200);
			expect(ok.headers.get("content-type")).toContain("image/png");
			expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
			expect(ok.headers.get("cache-control")).toBe("no-store");
			expect(new Uint8Array(await ok.arrayBuffer())).toEqual(PNG_BYTES);
			const later = await fetch(new URL("/api/reel/3", url));
			expect(later.status).toBe(200);
			expect(later.headers.get("content-type")).toContain("image/webp");
			expect(new Uint8Array(await later.arrayBuffer())).toEqual(webpBytes);
			for (const path of ["/api/reel/1", "/api/reel/2", "/api/reel/4", "/api/reel/-1", "/api/reel/abc", "/api/reel/0.5", "/api/reel/"]) {
				const res = await fetch(new URL(path, url));
				expect([path, res.status]).toEqual([path, 404]);
				await res.body?.cancel();
			}
			const html = await (await fetch(url)).text();
			for (const marker of ['data-tag="stall"', 'id="attention"', 'id="reel"', 'id="milestones"']) expect(html).toContain(marker);
		} finally {
			try { handle?.stop(); } finally { rmSync(dir, { recursive: true, force: true }); }
		}
		const plain = startSwarmServer(stubStore(emptySnapshot()).store, { port: 0 });
		try {
			expect((await fetch(new URL("/api/reel/0", plain.url))).status).toBe(404);
		} finally {
			plain.stop();
		}
	});

	test("SwarmServer auto-stops when idle with no working members and no SSE clients", async () => {
		const { startSwarmServer } = await import(SERVER);
		const workingSnap = emptySnapshot({
			live: true,
			members: [{ id: "S1", name: "S1", role: "synth", kind: "sub", model: "m", status: "working", threadId: null, lastMessage: "", lastSeq: 0, startedAt: T0, endedAt: null, lastActivityAt: T0, now: "Working", description: "" }],
		});
		const doneSnap = emptySnapshot({
			live: false,
			members: [{ id: "S1", name: "S1", role: "synth", kind: "sub", model: "m", status: "done", threadId: null, lastMessage: "", lastSeq: 1, startedAt: T0, endedAt: T0 + 1, lastActivityAt: T0 + 1, now: "Done", description: "" }],
		});
		let current = workingSnap;
		const listeners = new Set<(s: SwarmSnapshot) => void>();
		const store: SwarmStoreLike = {
			getSnapshot: () => current,
			subscribe: fn => {
				listeners.add(fn);
				return () => { listeners.delete(fn); };
			},
		};
		const publish = (next: SwarmSnapshot) => {
			current = next;
			for (const fn of listeners) fn(next);
		};
		let idleStops = 0;
		const handle = startSwarmServer(store, { port: 0, idleTimeoutMs: 60, onIdleStop: () => { idleStops++; } });
		try {
			// Working member keeps server alive past idleTimeoutMs even with zero SSE clients.
			await Bun.sleep(90);
			expect(idleStops).toBe(0);
			expect((await fetch(new URL("/api/state", handle.url))).status).toBe(200);

			// Connected SSE client keeps server alive even after all members finish.
			const abort = new AbortController();
			const events = await fetch(new URL("/api/events", handle.url), { signal: abort.signal });
			const frames = sseFrames(events.body!);
			expect((await frames.next()).event).toBe("snapshot");
			publish(doneSnap);
			expect((await frames.next()).event).toBe("update");
			await Bun.sleep(90);
			expect(idleStops).toBe(0);
			expect((await fetch(new URL("/api/state", handle.url))).status).toBe(200);

			// Disconnecting the last SSE client starts the idle countdown and stops the server.
			abort.abort();
			await frames.reader.cancel().catch(() => {});
			// The countdown starts only at disconnect, so the server must still be up well before idleTimeoutMs.
			await Bun.sleep(20);
			expect(idleStops).toBe(0);
			for (let i = 0; i < 40 && idleStops === 0; i++) await Bun.sleep(15);
			expect(idleStops).toBe(1);
			expect(listeners.size).toBe(0);
			await expect(fetch(new URL("/api/state", handle.url))).rejects.toThrow();
		} finally {
			handle.stop();
		}

		// A server that starts idle (no workers, no SSE client, no store publication) arms the countdown at startup.
		let startIdleStops = 0;
		const startIdle = startSwarmServer(stubStore(doneSnap).store, { port: 0, idleTimeoutMs: 60, onIdleStop: () => { startIdleStops++; } });
		try {
			await Bun.sleep(20);
			expect(startIdleStops).toBe(0);
			for (let i = 0; i < 40 && startIdleStops === 0; i++) await Bun.sleep(15);
			expect(startIdleStops).toBe(1);
		} finally {
			startIdle.stop();
		}

		// Manual stop() releases the idle subscription at once, cancels the timer, and never invokes onIdleStop.
		let manualIdleStops = 0;
		const manualStub = stubStore(doneSnap);
		const manual = startSwarmServer(manualStub.store, { port: 0, idleTimeoutMs: 60, onIdleStop: () => { manualIdleStops++; } });
		expect(manualStub.listeners.size).toBe(1);
		manual.stop();
		expect(manualStub.stats.unsubscribed).toBe(1);
		await Bun.sleep(90);
		expect(manualIdleStops).toBe(0);
	});
});

describe("ompSwarmExtension", () => {
	test("ompSwarmExtension observes fanout across rebound sessions and auto-starts at three subagents", async () => {
		const { default: ompSwarmExtension } = await import(EXT);
		const notes: string[] = [];
		// omp calls the factory once per session (main and each subagent) in one process.
		const bind = (kind: "main" | "sub", id: string) => {
			const handlers = new Map<string, ExtensionHandler[]>();
			const commands = new Map<string, ExtensionCommand>();
			ompSwarmExtension({
				on: (event: string, handler: ExtensionHandler) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
				registerCommand: (name: string, command: ExtensionCommand) => commands.set(name, command),
			});
			const ctx: ExtensionContext = {
				cwd: ".",
				agent: { kind, id, name: kind === "main" ? "main" : "synth", depth: kind === "main" ? 0 : 1 },
				models: { current: () => ({ id: `model-${id}` }) },
				ui: { notify: (message: string) => notes.push(message) },
			};
			// Host events carry their `type` discriminant; return values are collected to prove passivity.
			const emit = async (event: string, payload: Record<string, unknown>) => {
				const results: unknown[] = [];
				for (const h of handlers.get(event) ?? []) results.push(await h({ type: event, ...payload }, ctx));
				return results;
			};
			return { ctx, emit, command: commands.get("omp-swarm") };
		};
		const urlFromNotes = () => notes.map(n => n.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]).find(Boolean);
		const state = async (url: string) => (await (await fetch(`${url}/api/state`)).json()) as SwarmSnapshot;

		const main = bind("main", "main");
		expect(main.command).toBeDefined();
		await main.command!.handler("reset", main.ctx);
		notes.length = 0;
		try {
			await main.emit("session_start", {});
			const passive = await main.emit("tool_call", {
				toolName: "task",
				toolCallId: "t1",
				input: { context: "c", tasks: [{ name: "S1", agent: "synth", task: "{}" }, { name: "S2", agent: "sonic" }] },
			});
			expect(passive.every(r => r === undefined)).toBe(true);
			expect(urlFromNotes()).toBeUndefined();

			await main.emit("tool_call", { toolName: "task", toolCallId: "t2", input: { tasks: [{ name: "S3", agent: "synth" }] } });
			const url = urlFromNotes();
			expect(url).toBeDefined();

			// Malformed host payloads must never throw out of a hook.
			await main.emit("tool_call", { toolName: "task", toolCallId: "t3", input: { tasks: "bad" } });
			await main.emit("tool_call", { toolName: "write", toolCallId: "t4", input: null });
			await main.emit("tool_call", { toolName: "write", toolCallId: "t5" });
			const results = await main.emit("tool_result", { toolName: "task", toolCallId: "t2", content: 42, isError: false });
			expect(results.every(r => r === undefined)).toBe(true);

			const children = ["S1", "S2", "S3"].map(id => bind("sub", id));
			for (const child of children) await child.emit("session_start", {});
			await children[2].emit("agent_end", { messages: "bad" });
			await main.emit("tool_call", { toolName: "write", toolCallId: "t6", input: { path: "agent://S2", content: "Apply ADV1 from local://x-checks.md" } });
			await children[0].emit("agent_end", {
				messages: [
					{ role: "user", content: "go" },
					{ role: "assistant", content: [{ type: "text", text: '{"edits":["a.ts"],"specConflict":[],"checks":"ok"}' }] },
				],
			});
			// Structured subagents finish through the hidden `yield` tool: no text part, payload in its arguments.
			await children[1].emit("agent_end", {
				messages: [
					{ role: "user", content: "go" },
					{
						role: "assistant",
						content: [{ type: "toolCall", id: "y1", name: "yield", arguments: { edits: [], planDeviations: [], checks: "not run", specConflict: ["types.ts:4 bad"] } }],
					},
				],
			});

			let snap = await state(url!);
			expect(snap.totalTasks).toBe(3);
			expect(snap.members.find(m => m.kind === "main")).toBeDefined();
			for (const id of ["S1", "S2", "S3"]) expect(snap.members.find(m => m.id === id)?.model).toBe(`model-${id}`);
			expect(snap.members.find(m => m.id === "S1")?.status).toBe("done");
			expect(snap.members.find(m => m.id === "S2")?.status).toBe("blocked");
			expect(snap.messages.some(m => m.tag === "owner-edit" && m.to === "S2")).toBe(true);

			await children[0].emit("session_shutdown", {});
			snap = await state(url!);
			expect(snap.members.find(m => m.id === "S1")?.status).toBe("retired");

			await main.emit("session_shutdown", {});
			await expect(fetch(`${url}/api/state`)).rejects.toThrow();

			notes.length = 0;
			await main.command!.handler("", main.ctx);
			const onDemand = urlFromNotes();
			expect(onDemand).toBeDefined();
			expect((await fetch(`${onDemand}/api/state`)).status).toBe(200);
			await main.command!.handler("stop", main.ctx);
			await expect(fetch(`${onDemand}/api/state`)).rejects.toThrow();
		} finally {
			await main.command?.handler("stop", main.ctx);
		}
	});

	test("ompSwarmExtension applies plan layout, captures screenshots, alerts stalls and clears its timer on shutdown", async () => {
		const { default: ompSwarmExtension } = await import(EXT);
		const notes: string[] = [];
		const levels: Array<string | undefined> = [];
		const handlers = new Map<string, ExtensionHandler[]>();
		const commands = new Map<string, ExtensionCommand>();
		ompSwarmExtension({
			on: (event: string, handler: ExtensionHandler) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
			registerCommand: (name: string, command: ExtensionCommand) => commands.set(name, command),
		});
		const ctx: ExtensionContext = {
			cwd: ".",
			agent: { kind: "main", id: "main", name: "main", depth: 0 },
			models: { current: () => ({ id: "model-main" }) },
			ui: { notify: (message: string, level?: string) => { notes.push(message); levels.push(level); } },
		};
		const emit = async (event: string, payload: Record<string, unknown>) => {
			const results: unknown[] = [];
			for (const h of handlers.get(event) ?? []) results.push(await h({ type: event, ...payload }, ctx));
			return results;
		};
		const command = commands.get("omp-swarm")!;
		// Track intervals so the test proves shutdown clears every timer the extension started.
		const live = new Map<unknown, { callback: () => void; delay: number | undefined }>();
		const realSetInterval = globalThis.setInterval;
		const realClearInterval = globalThis.clearInterval;
		globalThis.setInterval = ((callback: () => void, delay?: number) => {
			const id = realSetInterval(callback, delay);
			live.set(id, { callback, delay });
			return id;
		}) as typeof setInterval;
		globalThis.clearInterval = ((id?: Parameters<typeof clearInterval>[0]) => {
			live.delete(id);
			realClearInterval(id);
		}) as typeof clearInterval;
		const dir = mkdtempSync(join(tmpdir(), "omp-swarm-ext-"));
		try {
			const png = join(dir, "overview.png");
			writeFileSync(png, PNG_BYTES);
			await command.handler("reset", ctx);
			notes.length = 0;
			await emit("session_start", {});
			const plan = [
				"# Plan", "", "## Parallel waves", "", "```json",
				JSON.stringify([{ id: "R1", owns: ["extensions/a.ts"] }, { id: "R2", owns: [], symbols: [{ name: "Foo.bar" }] }]),
				"```", "", "## Verification", "",
			].join("\n");
			const planned = await emit("plan_review_requested", { reviewId: "rv1", title: "Layout plan", planFilePath: "local://layout-plan.md", planContent: plan });
			expect(planned.every(r => r === undefined)).toBe(true);
			await emit("tool_call", { toolName: "task", toolCallId: "r1", input: { tasks: [{ name: "R1" }, { name: "R2" }, { name: "R3" }] } });
			const url = notes.map(n => n.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]).find(Boolean);
			expect(url).toBeDefined();
			expect(live.size).toBe(1);
			const [[timerId, timer]] = [...live];
			expect(timer.delay).toBe(60_000);
			const refState = typeof timerId === "object" && timerId !== null && "hasRef" in timerId && typeof timerId.hasRef === "function" ? timerId.hasRef() : "no hasRef";
			expect(refState).toBe(false);

			const results = await emit("tool_result", {
				toolName: "bash",
				toolCallId: "r2",
				content: [{ type: "text", text: `ok\nScreenshot: ${png} | Updated Overview layout` }],
				isError: false,
			});
			expect(results.every(r => r === undefined)).toBe(true);
			let snap = (await (await fetch(`${url}/api/state`)).json()) as SwarmSnapshot;
			expect(snap.goalTitle).toBe("Layout plan");
			expect(["R1", "R2", "R3"].map(id => snap.members.find(m => m.id === id)?.description)).toEqual(["extensions/a.ts", "Foo.bar", ""]);
			expect(snap.reel).toHaveLength(1);
			expect(snap.reel[0]).toMatchObject({ index: 0, path: png, caption: "Updated Overview layout" });
			const frame = await fetch(`${url}/api/reel/0`);
			expect(frame.status).toBe(200);
			expect(frame.headers.get("content-type")).toContain("image/png");
			await frame.arrayBuffer();

			// A sub-agent's tool call counts as activity, so only R2 and R3 stall past the 10-minute threshold.
			const base = Date.now();
			const subCtx: ExtensionContext = { ...ctx, agent: { kind: "sub", id: "R1", name: "synth", depth: 1 } };
			setSystemTime(new Date(base + 400_000));
			try {
				for (const h of handlers.get("tool_call") ?? []) await h({ type: "tool_call", toolName: "bash", toolCallId: "r3", input: { command: "ls" } }, subCtx);
			} finally {
				setSystemTime();
			}
			notes.length = 0;
			levels.length = 0;
			setSystemTime(new Date(base + 700_000));
			try {
				timer.callback();
			} finally {
				setSystemTime();
			}
			expect(stalled(notes.map(text => ({ text }) as SwarmMessage))).toEqual(["R2", "R3"]);
			expect(levels).toEqual(["warning", "warning"]);
			snap = (await (await fetch(`${url}/api/state`)).json()) as SwarmSnapshot;
			expect(snap.messages.filter(m => m.tag === "stall")).toHaveLength(2);

			await emit("session_shutdown", {});
			await expect(fetch(`${url}/api/state`)).rejects.toThrow();
			expect(live.size).toBe(0);
		} finally {
			try {
				await command.handler("stop", ctx);
			} finally {
				for (const id of live.keys()) realClearInterval(id as Parameters<typeof clearInterval>[0]);
				globalThis.setInterval = realSetInterval;
				globalThis.clearInterval = realClearInterval;
				rmSync(dir, { recursive: true, force: true });
			}
		}
	});

	test("ompSwarmExtension opens browser on /omp-swarm and posts zero-token chat messages", async () => {
		const { default: ompSwarmExtension, browserOpenCommand, openSwarmUrl } = await import(EXT);
		expect(browserOpenCommand("http://127.0.0.1:4321", "win32")).toEqual(["rundll32.exe", "url.dll,FileProtocolHandler", "http://127.0.0.1:4321"]);
		expect(browserOpenCommand("http://127.0.0.1:4321", "darwin")).toEqual(["open", "http://127.0.0.1:4321"]);
		expect(browserOpenCommand("http://127.0.0.1:4321", "linux")).toEqual(["xdg-open", "http://127.0.0.1:4321"]);
		const realSpawn = Bun.spawn;
		let spawnCalls = 0;
		Bun.spawn = ((...args: Parameters<typeof Bun.spawn>) => {
			spawnCalls++;
			return realSpawn(...args);
		}) as typeof Bun.spawn;
		try {
			expect(openSwarmUrl("https://example.com")).toBe(false);
			expect(openSwarmUrl("http://example.com:4321")).toBe(false);
			expect(openSwarmUrl("file:///etc/passwd")).toBe(false);
			expect(spawnCalls).toBe(0);
		} finally {
			Bun.spawn = realSpawn;
		}

		const notes: string[] = [];
		const sent: Array<{ message: Record<string, unknown>; options?: Record<string, unknown> }> = [];
		const opened: string[] = [];
		const handlers = new Map<string, ExtensionHandler[]>();
		const commands = new Map<string, ExtensionCommand>();
		let throwSend = false;
		let throwOpen = false;
		ompSwarmExtension(
			{
				on: (event: string, handler: ExtensionHandler) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
				registerCommand: (name: string, command: ExtensionCommand) => commands.set(name, command),
				sendMessage: (message, options) => {
					if (throwSend) throw new Error("send failed");
					sent.push({ message: message as unknown as Record<string, unknown>, options: options as unknown as Record<string, unknown> });
				},
			},
			{
				openUrl: (url: string) => {
					if (throwOpen) throw new Error("spawn failed");
					opened.push(url);
					return true;
				},
			},
		);
		const makeCtx = (overrides: Partial<ExtensionContext> = {}): ExtensionContext => ({
			cwd: ".",
			hasUI: true,
			mode: "tui",
			agent: { kind: "main", id: "main", name: "main", depth: 0 },
			models: { current: () => ({ id: "model-main" }) },
			ui: { notify: (message: string) => notes.push(message) },
			...overrides,
		});
		const command = commands.get("omp-swarm")!;
		const ctx = makeCtx();
		const emit = async (event: string, payload: Record<string, unknown>) => {
			for (const h of handlers.get(event) ?? []) await h({ type: event, ...payload }, ctx);
		};
		const prevNoOpen = process.env.OMP_SWARM_NO_OPEN;
		delete process.env.OMP_SWARM_NO_OPEN;
		try {
			await command.handler("stop", ctx);
			await command.handler("reset", ctx);
			notes.length = 0;
			sent.length = 0;
			opened.length = 0;

			// Auto-start at 3 subagents posts in chat without opening a browser window.
			await emit("tool_call", { toolName: "task", toolCallId: "a1", input: { tasks: [{ name: "A1" }, { name: "A2" }, { name: "A3" }] } });
			expect(opened).toEqual([]);
			expect(sent).toHaveLength(1);
			expect(sent[0].message).toMatchObject({ customType: "omp-swarm", display: true, excludeFromContext: true });
			expect(sent[0].options).toEqual({ triggerTurn: false });
			const autoUrl = String(sent[0].message.content).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
			expect(autoUrl).toBeDefined();

			// Explicit /omp-swarm opens the browser and posts status in chat.
			notes.length = 0;
			sent.length = 0;
			await command.handler("", ctx);
			expect(opened).toEqual([autoUrl!]);
			expect(sent).toHaveLength(1);
			expect(sent[0].message).toMatchObject({ customType: "omp-swarm", display: true, excludeFromContext: true });
			expect(sent[0].options).toEqual({ triggerTurn: false });
			expect(String(sent[0].message.content)).toContain(autoUrl!);
			expect(String(sent[0].message.content)).toContain("0/3 tasks done");
			expect(notes[0]).toContain("opened in browser");

			// Non-interactive contexts and OMP_SWARM_NO_OPEN=1 skip browser launch but still post in chat and notify.
			const suppressed: Array<() => Promise<void>> = [
				() => command.handler("", makeCtx({ hasUI: false })),
				() => command.handler("", makeCtx({ mode: "print" })),
				() => command.handler("", makeCtx({ mode: "json" })),
				async () => {
					process.env.OMP_SWARM_NO_OPEN = "1";
					try {
						await command.handler("", ctx);
					} finally {
						delete process.env.OMP_SWARM_NO_OPEN;
					}
				},
			];
			for (const run of suppressed) {
				opened.length = 0;
				sent.length = 0;
				notes.length = 0;
				await run();
				expect(opened).toEqual([]);
				expect(sent).toHaveLength(1);
				expect(sent[0].message).toMatchObject({ customType: "omp-swarm", display: true, excludeFromContext: true });
				expect(sent[0].options).toEqual({ triggerTurn: false });
				expect(notes).toHaveLength(1);
			}

			// Failure in openUrl still posts chat and notifies without throwing.
			notes.length = 0;
			sent.length = 0;
			throwOpen = true;
			throwSend = false;
			await command.handler("", ctx);
			expect(sent).toHaveLength(1);
			expect(notes.some(n => n.includes(autoUrl!) && !n.includes("opened in browser"))).toBe(true);

			// Failure in sendMessage still notifies on /omp-swarm and on fresh auto-start.
			notes.length = 0;
			throwOpen = false;
			throwSend = true;
			await command.handler("", ctx);
			expect(notes.some(n => n.includes(autoUrl!))).toBe(true);

			await command.handler("stop", ctx);
			await command.handler("reset", ctx);
			notes.length = 0;
			opened.length = 0;
			await emit("tool_call", { toolName: "task", toolCallId: "a2", input: { tasks: [{ name: "B1" }, { name: "B2" }, { name: "B3" }] } });
			expect(opened).toEqual([]);
			expect(notes.some(n => /http:\/\/127\.0\.0\.1:\d+/.test(n))).toBe(true);
		} finally {
			if (prevNoOpen === undefined) delete process.env.OMP_SWARM_NO_OPEN;
			else process.env.OMP_SWARM_NO_OPEN = prevNoOpen;
			await command.handler("stop", ctx);
		}
	});

	test("derives descriptive batch titles and member descriptions without bogus @task participant", async () => {
		const { default: ompSwarmExtension, deriveBatchTitle, describeTask } = await import(EXT);
		expect(deriveBatchTitle({ i: "Spawning wave 1" }, [{ name: "S1" }])).toBe("Spawning wave 1");
		expect(deriveBatchTitle({ context: "# Goal\nFix login redirect bug\n\n# Contract\n..." }, [{ name: "S1" }, { name: "S2" }])).toBe("Fix login redirect bug");
		expect(deriveBatchTitle({}, [{ name: "FixTools" }, { name: "FixWizard" }])).toBe("FixTools, FixWizard");
		expect(deriveBatchTitle({}, [{ name: "Rev1", agent: "adversarial-reviewer" }, { name: "Rev2", agent: "adversarial-reviewer-alt" }])).toBe("Review: Rev1, Rev2");
		expect(deriveBatchTitle({}, [{ name: "MapUI", agent: "scout" }, { name: "MapAPI", agent: "scout" }])).toBe("Scout: MapUI, MapAPI");
		expect(deriveBatchTitle({}, [{ name: "S1", task: '{"id":"S1","owns":["extensions/omp-swarm/ui.ts"]}' }])).toBe("extensions/omp-swarm/ui.ts");
		expect(deriveBatchTitle({}, [{}])).toBe("Task batch");

		expect(describeTask({ task: '{"id":"S1","owns":["[NEW] src/foo.ts"]}' })).toBe("src/foo.ts");
		expect(describeTask({ solutionSpace: "one fix: compact header layout" })).toBe("one fix: compact header layout");
		expect(describeTask({ task: "# Target\nCompact the swarm header" })).toBe("Compact the swarm header");
		const clipped = deriveBatchTitle({ context: "# Goal\nomp-swarm: idle auto-stop of the in-process Swarm HTTP server, plus UI cleanup" }, [{ name: "IdleStopServer" }]);
		expect(clipped).toBe("omp-swarm: idle auto-stop of the in-process…");
		expect(describeTask({ name: "Empty" })).toBe("");

		const handlers = new Map<string, ExtensionHandler[]>();
		const commands = new Map<string, ExtensionCommand>();
		const notes: string[] = [];
		ompSwarmExtension(
			{
				on: (event: string, handler: ExtensionHandler) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
				registerCommand: (name: string, command: ExtensionCommand) => commands.set(name, command),
			},
			{ openUrl: () => false },
		);
		const ctx: ExtensionContext = {
			cwd: ".",
			agent: { kind: "main", id: "main", name: "main", depth: 0 },
			models: { current: () => ({ id: "m" }) },
			ui: { notify: (m: string) => notes.push(m) },
		};
		const command = commands.get("omp-swarm")!;
		const emit = async (event: string, payload: Record<string, unknown>) => {
			for (const h of handlers.get(event) ?? []) await h({ type: event, ...payload }, ctx);
		};
		try {
			await command.handler("stop", ctx);
			await command.handler("reset", ctx);
			notes.length = 0;
			await emit("tool_call", {
				toolName: "task",
				toolCallId: "d1",
				input: {
					tasks: [
						{ name: "FixTools", agent: "synth", solutionSpace: "fix tool wiring" },
						{ name: "FixWizard", agent: "synth", task: '{"id":"FixWizard","owns":["src/wizard.ts"]}' },
						{ name: "Bare", agent: "synth" },
					],
				},
			});
			await emit("tool_result", {
				toolName: "task",
				toolCallId: "d1",
				content: [{ type: "text", text: "Spawned 3 background agents." }],
				isError: false,
			});
			const url = notes.map(n => n.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]).find(Boolean);
			expect(url).toBeDefined();
			const snap = (await (await fetch(`${url}/api/state`)).json()) as SwarmSnapshot;
			expect(snap.threads[0]?.title).toBe("FixTools, FixWizard, Bare");
			expect(snap.members.find(m => m.id === "FixTools")?.description).toBe("fix tool wiring");
			expect(snap.members.find(m => m.id === "FixWizard")?.description).toBe("src/wizard.ts");
			expect(snap.members.find(m => m.id === "Bare")?.description).toBe("");
			expect(snap.messages.some(m => m.from === "task")).toBe(false);
		} finally {
			await command.handler("stop", ctx);
		}
	});

	test("ignores planning boilerplate and bare background context when deriving batch titles", async () => {
		const { deriveBatchTitle } = await import(EXT);
		expect(deriveBatchTitle(
			{ context: "We are planning a change to make triage tokenBudget user-configurable." },
			[
				{ name: "ScoutAvasUI", agent: "scout" },
				{ name: "ScoutApiAndTests", agent: "scout" },
				{ name: "ScoutE2eAndDocs", agent: "scout" },
			],
		)).toBe("Scout: AvasUI, ApiAndTests, E2eAndDocs");
		expect(deriveBatchTitle(
			{ context: "Adversarial second-opinion review. OUTPUT is a patch file." },
			[
				{ name: "ReviewSynth", agent: "adversarial-reviewer" },
				{ name: "ReviewAlt", agent: "adversarial-reviewer-alt" },
			],
		)).toBe("Review: Synth, Alt");
		expect(deriveBatchTitle(
			{ context: "Avas Angular app (repo root /work/avas)" },
			[{ name: "UiCheck", solutionSpace: "verify tokenBudget UI in browser" }],
		)).toBe("verify tokenBudget UI in browser");
		expect(deriveBatchTitle(
			{ context: "# Goal\nWe are planning a change to triage\n\n# Contract\n..." },
			[{ name: "TriageApi", agent: "synth" }, { name: "TriageUi", agent: "synth" }],
		)).toBe("TriageApi, TriageUi");
		expect(deriveBatchTitle(
			{ context: "Adversarial second-opinion review." },
			[{ name: "ReviewWave0", agent: "adversarial-reviewer-alt" }],
		)).toBe("Review: Wave0");
		expect(deriveBatchTitle(
			{ context: "Review it." },
			[{ name: "Reviewer", agent: "adversarial-reviewer" }, { name: "Scouting", agent: "adversarial-reviewer-alt" }],
		)).toBe("Review: Reviewer, Scouting");
		expect(deriveBatchTitle(
			{ context: "# Goal\nMake triage tokenBudget user-configurable\n" },
			[{ name: "ScoutingReport", agent: "scout" }, { name: "ScoutDocs", agent: "scout" }],
		)).toBe("Scout: ScoutingReport, Docs");
	});

	test("ompSwarmExtension auto-stops on idle and restarts on next 3+ task fanout", async () => {
		const { default: ompSwarmExtension, DEFAULT_IDLE_TIMEOUT_MS } = await import(EXT);
		expect(DEFAULT_IDLE_TIMEOUT_MS).toBe(300_000);
		const notes: string[] = [];
		const bind = (kind: "main" | "sub", id: string, overrides: { idleTimeoutMs?: number } = { idleTimeoutMs: 60 }) => {
			const handlers = new Map<string, ExtensionHandler[]>();
			const commands = new Map<string, ExtensionCommand>();
			ompSwarmExtension(
				{
					on: (event: string, handler: ExtensionHandler) => handlers.set(event, [...(handlers.get(event) ?? []), handler]),
					registerCommand: (name: string, command: ExtensionCommand) => commands.set(name, command),
				},
				{ openUrl: () => false, ...overrides },
			);
			const ctx: ExtensionContext = {
				cwd: ".",
				agent: { kind, id, name: kind === "main" ? "main" : "synth", depth: kind === "main" ? 0 : 1 },
				models: { current: () => ({ id: "m" }) },
				ui: { notify: (message: string) => notes.push(message) },
			};
			const emit = async (event: string, payload: Record<string, unknown>) => {
				for (const h of handlers.get(event) ?? []) await h({ type: event, ...payload }, ctx);
			};
			return { ctx, emit, command: commands.get("omp-swarm")! };
		};
		const lastUrl = () => [...notes].reverse().map(n => n.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0]).find(Boolean);
		const main = bind("main", "main");
		try {
			await main.command.handler("stop", main.ctx);
			await main.command.handler("reset", main.ctx);
			notes.length = 0;
			await main.emit("session_start", {});
			await main.emit("tool_call", { toolName: "task", toolCallId: "i1", input: { tasks: [{ name: "W1" }, { name: "W2" }, { name: "W3" }] } });
			const firstUrl = lastUrl();
			expect(firstUrl).toBeDefined();
			expect((await fetch(`${firstUrl}/api/state`)).status).toBe(200);

			// Complete all three subagents; with no SSE clients, server auto-stops after idleTimeoutMs.
			for (const id of ["W1", "W2", "W3"]) {
				const sub = bind("sub", id);
				await sub.emit("session_start", {});
				await sub.emit("agent_end", { messages: [{ role: "assistant", content: [{ type: "text", text: "done" }] }] });
			}
			for (let i = 0; i < 40 && !notes.some(n => /auto-stopped/i.test(n)); i++) await Bun.sleep(15);
			expect(notes.some(n => /auto-stopped/i.test(n))).toBe(true);
			await expect(fetch(`${firstUrl}/api/state`)).rejects.toThrow();

			// Restart needs autoStartThreshold (3) new tasks: none at one or two, restart at three.
			notes.length = 0;
			await main.emit("tool_call", { toolName: "task", toolCallId: "i2", input: { tasks: [{ name: "W4" }] } });
			expect(lastUrl()).toBeUndefined();
			await main.emit("tool_call", { toolName: "task", toolCallId: "i3", input: { tasks: [{ name: "W5" }] } });
			expect(lastUrl()).toBeUndefined();
			await main.emit("tool_call", { toolName: "task", toolCallId: "i4", input: { tasks: [{ name: "W6" }] } });
			const secondUrl = lastUrl();
			expect(secondUrl).toBeDefined();
			expect((await fetch(`${secondUrl}/api/state`)).status).toBe(200);

			// Manual /omp-swarm stop after an idle auto-stop (before any restart) cancels restart eligibility.
			for (const id of ["W4", "W5", "W6"]) {
				const sub = bind("sub", id);
				await sub.emit("session_start", {});
				await sub.emit("agent_end", { messages: [{ role: "assistant", content: [{ type: "text", text: "done" }] }] });
			}
			for (let i = 0; i < 40 && !notes.some(n => /auto-stopped/i.test(n)); i++) await Bun.sleep(15);
			expect(notes.some(n => /auto-stopped/i.test(n))).toBe(true);
			await main.command.handler("stop", main.ctx);
			notes.length = 0;
			await main.emit("tool_call", { toolName: "task", toolCallId: "i5", input: { tasks: [{ name: "W7" }, { name: "W8" }, { name: "W9" }] } });
			expect(lastUrl()).toBeUndefined();

			// Manually stopping a server left running by reset also stays stopped on a later 3-task fanout.
			await main.command.handler("", main.ctx);
			expect(lastUrl()).toBeDefined();
			await main.command.handler("reset", main.ctx);
			await main.command.handler("stop", main.ctx);
			notes.length = 0;
			await main.emit("tool_call", { toolName: "task", toolCallId: "i6", input: { tasks: [{ name: "W10" }, { name: "W11" }, { name: "W12" }] } });
			expect(lastUrl()).toBeUndefined();
		} finally {
			await main.command.handler("stop", main.ctx);
		}

		// Without an override the extension uses DEFAULT_IDLE_TIMEOUT_MS; /omp-swarm reopens after auto-stop.
		// Fake timers: a real 5-minute wait is impossible; Bun.serve itself is unaffected.
		const dflt = bind("main", "main", {});
		jest.useFakeTimers();
		try {
			await dflt.command.handler("stop", dflt.ctx);
			await dflt.command.handler("reset", dflt.ctx);
			notes.length = 0;
			await dflt.command.handler("", dflt.ctx);
			expect(lastUrl()).toBeDefined();
			jest.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS - 1);
			expect(notes.some(n => /auto-stopped/i.test(n))).toBe(false);
			jest.advanceTimersByTime(1);
			expect(notes.some(n => /auto-stopped/i.test(n))).toBe(true);
			notes.length = 0;
			await dflt.command.handler("", dflt.ctx);
			const reopened = lastUrl();
			expect(reopened).toBeDefined();
			expect((await fetch(`${reopened}/api/state`)).status).toBe(200);
		} finally {
			await dflt.command.handler("stop", dflt.ctx);
			jest.useRealTimers();
		}
	});
});

describe("renderSwarmHtml", () => {
	test("renders Linear-dense compact layout with auto light/dark tokens and status cues", async () => {
		const { renderSwarmHtml } = await import("../extensions/omp-swarm/ui.ts");
		const html = renderSwarmHtml();
		expect(html).toContain('<meta name="color-scheme" content="light dark">');
		expect(html).toContain("color-scheme: light dark");
		expect(html).toContain("light-dark(");
		expect(html).toContain("@media (prefers-color-scheme: dark)");
		expect(html).toContain("@media (forced-colors: active)");
		expect(html).toContain("@media (pointer: coarse)");
		expect(html).toContain("dense-list");
		expect(html).toContain('aria-label="Status key"');
		expect(html).toContain("statusGlyph");
	});

	test("renders som Vice visual tokens, fonts, brand mark, tinted pills, and reduced-motion fallbacks", async () => {
		const { renderSwarmHtml } = await import("../extensions/omp-swarm/ui.ts");
		const html = renderSwarmHtml();
		expect(html).toContain("'Space Grotesk'");
		expect(html).toContain("--bg-dark: #0b0d17");
		expect(html).toContain("--surface-dark: #141728");
		expect(html).toContain("--brand-pink-dark: #ff2a85");
		expect(html).toContain("--brand-cyan-dark: #00f0ff");
		expect(html).toContain("color-mix(in oklab,");
		expect(html).toContain('class="brand-mark"');
		expect(html).toContain("backdrop-filter: blur(");
		expect(html).toContain("@media (prefers-reduced-motion: reduce)");
	});

	test("removes redundant header brand and goal card, collapses status key into one details disclosure, and uses clean margins", async () => {
		const { renderSwarmHtml } = await import("../extensions/omp-swarm/ui.ts");
		const html = renderSwarmHtml();
		expect(html).not.toContain('class="brand"');
		expect(html).not.toContain(">omp/swarm<");
		expect(html).not.toContain('id="goal-card"');
		expect(html).toContain('id="overview-summary"');
		expect(html).toContain('<details class="status-key-disclosure">');
		expect(html.match(/data-status-key/g)?.length).toBe(1);
		expect(html).toContain("padding-inline: clamp(.85rem, 2.5vw, 1.5rem)");
		expect(html).toContain("padding-block: .75rem 1.5rem");
	});

	test("uses compact 11.5px base typography and renders Markdown safely via DOM nodes", async () => {
		const { renderSwarmHtml } = await import("../extensions/omp-swarm/ui.ts");
		const html = renderSwarmHtml();
		expect(html).toContain("font: .72rem/1.38 var(--font-sans)");
		expect(html).toContain("function renderMarkdown(");
		expect(html).toContain("function renderInline(");
		expect(html).toContain("table-wrapper");
		expect(html).not.toContain("innerHTML");
	});

	test("wraps hive cell titles onto two lines and renders wider chips with member descriptions", async () => {
		const { renderSwarmHtml } = await import("../extensions/omp-swarm/ui.ts");
		const html = renderSwarmHtml();
		expect(html).toContain("function wrapLines(");
		expect(html).toContain("svg('tspan'");
		expect(html).toContain(".member-desc");
		expect(html).toContain("const NODE_W = 168;");
		expect(html).toContain("clip(name, 22)");
	});
});
