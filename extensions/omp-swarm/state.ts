import type {
	AttentionKind, MessageTag, SwarmAttentionItem, SwarmMember, SwarmMessage, SwarmMilestone,
	SwarmPlanLayout, SwarmReelFrame, SwarmRisk, SwarmSnapshot, SwarmStoreLike, SwarmThread,
} from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseObject(raw: string): Record<string, unknown> | null {
	try {
		const value: unknown = JSON.parse(raw);
		return isObject(value) ? value : null;
	} catch {
		return null;
	}
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every(item => typeof item === "string");
}

export function parseSliceJson(raw: string): { id?: string; owns?: string[]; agent?: string } | null {
	const value = parseObject(raw);
	if (!value) return null;
	const { id, owns, agent } = value;
	if ((id !== undefined && typeof id !== "string") ||
		(owns !== undefined && !isStringArray(owns)) ||
		(agent !== undefined && typeof agent !== "string")) return null;
	return value;
}

export function parseSynthOutput(raw: string): { edits?: string[]; specConflict?: string[]; checks?: string; planDeviations?: string[]; lines?: Record<string, unknown> } | null {
	let value = parseObject(raw);
	if (!value) {
		for (const [, body] of raw.matchAll(/```(?:json)?[^\S\r\n]*\r?\n([\s\S]*?)```/gi)) {
			value = parseObject(body);
			if (value) break;
		}
	}
	if (!value) return null;
	const { edits, specConflict, checks, planDeviations, lines } = value;
	if ((edits !== undefined && !isStringArray(edits)) ||
		(specConflict !== undefined && !isStringArray(specConflict)) ||
		(checks !== undefined && typeof checks !== "string") ||
		(planDeviations !== undefined && !isStringArray(planDeviations)) ||
		(lines !== undefined && !isObject(lines))) return null;
	return value;
}

export function extractAgentTarget(path: string): string | null {
	if (!path.startsWith("agent://")) return null;
	const id = path.slice("agent://".length);
	return id && id !== "peers" && id !== "all" && !/[\s/\\?#]/.test(id) ? id : null;
}

export function parseScreenshots(raw: string): Array<{ path: string; caption: string }> {
	const frames: Array<{ path: string; caption: string }> = [];
	if (typeof raw !== "string") return frames;
	for (const [, rawPath, rawCaption] of raw.matchAll(/^Screenshot:([^|\r\n\u2028\u2029]+)\|(.+)$/gim)) {
		const path = rawPath.trim();
		// Windows treats either separator as a path prefix, including mixed UNC prefixes.
		if (!/^(?:[A-Za-z]:[\\/]|\/(?![\\/]))/.test(path)) continue;
		const caption = rawCaption.trim();
		if (/\.(?:png|jpe?g|webp)$/i.test(path) && caption) frames.push({ path, caption: caption.slice(0, 120) });
	}
	return frames;
}

function copyJsonPayload(payload: Record<string, unknown>): Record<string, unknown> | null {
	try {
		// Share immutable message history across snapshots without letting callers mutate it.
		const value: unknown = JSON.parse(JSON.stringify(payload), (_, item: unknown) =>
			item !== null && typeof item === "object" ? Object.freeze(item) : item);
		return isObject(value) ? value : null;
	} catch {
		return null;
	}
}

type Outcome = "done" | "blocked";

type ThreadEntry = {
	id: string;
	title: string;
	goal?: string;
	createdAt: number;
	memberIds: Set<string>;
};

type MemberEntry = {
	member: Omit<SwarmMember, "now">;
	// lastSeq is the last board reference (sent or received), not necessarily a reply.
	lastSentSeq: number;
	spawned: boolean;
	outcome?: Outcome;
};

type Stall = {
	lastSeq: number;
	alerts: number;
	lastAlertAt: number;
	message: SwarmMessage;
	ownerEditSeq: number | null;
};

const attentionRank: Record<AttentionKind, number> = { decision: 0, failure: 1, review: 2, stuck: 3, error: 4, fyi: 5 };
const threadRank: Record<SwarmThread["status"], number> = { blocked: 0, running: 1, done: 2 };

function shortLine(text: string): string {
	return text.trim().split(/\r?\n/, 1)[0].trimEnd().slice(0, 160);
}

export class SwarmStore implements SwarmStoreLike {
	private goalTitle = "";
	private goalSummary = "";
	private startedAt = Date.now();
	private mainId = "coordinator";
	private totalTasks = 0;
	private doneTasks = 0;
	private nextSeq = 1;
	private nextThreadId = 1;
	private nextAnonymousId = 1;
	private autoStarted = false;
	private readonly autoStartThreshold: number;
	private readonly onAutoStart?: (snapshot: SwarmSnapshot) => void;
	private readonly stallThresholdMs: number;
	private readonly maxMessages: number;
	private readonly threads = new Map<string, ThreadEntry>();
	private readonly members = new Map<string, MemberEntry>();
	private readonly taskDescriptions = new Map<string, string>();
	private readonly stalls = new Map<string, Stall>();
	private readonly reel: Omit<SwarmReelFrame, "index">[] = [];
	// Fixed-size history: position is derived from the monotonically increasing sequence.
	private readonly messages: SwarmMessage[] = [];
	private readonly listeners = new Set<(snapshot: SwarmSnapshot) => void>();

	constructor(options?: {
		autoStartThreshold?: number;
		onAutoStart?: (snapshot: SwarmSnapshot) => void;
		stallThresholdMs?: number;
		maxMessages?: number;
	}) {
		this.autoStartThreshold = options?.autoStartThreshold ?? 3;
		this.onAutoStart = options?.onAutoStart;
		this.stallThresholdMs = options?.stallThresholdMs ?? 600_000;
		this.maxMessages = Math.max(0, Math.floor(options?.maxMessages ?? 500));
	}

	setGoal(title: string, summary = ""): void {
		this.goalTitle = title;
		this.goalSummary = summary;
		this.publish();
	}

	applyPlanLayout(layout: SwarmPlanLayout): void {
		if (layout.goal?.title !== undefined) this.goalTitle = layout.goal.title;
		if (layout.goal?.line !== undefined) this.goalSummary = layout.goal.line;
		if (layout.tasks) {
			for (const [id, description] of Object.entries(layout.tasks)) {
				this.taskDescriptions.set(id, description);
				const member = this.members.get(id)?.member;
				if (member) member.description = description;
			}
		}
		for (const spec of layout.threads ?? []) {
			let thread = this.threads.get(spec.id);
			if (!thread) {
				thread = { id: spec.id, title: spec.title, createdAt: Date.now(), memberIds: new Set() };
				this.threads.set(spec.id, thread);
			}
			thread.title = spec.title;
			thread.goal = spec.goal;
			for (const id of thread.memberIds) this.moveMember(this.members.get(id)!.member, null);
			for (const id of spec.tasks) {
				const member = this.members.get(id)?.member;
				if (member) this.moveMember(member, spec.id);
			}
		}
		this.publish();
	}

	registerMember(info: { id: string; name: string; role: string; kind: "main" | "sub"; model?: string; threadId?: string | null }): void {
		const now = Date.now();
		const entry = this.members.get(info.id);
		if (entry) {
			const member = entry.member;
			member.name = info.name;
			member.role = info.role;
			member.kind = info.kind;
			if (info.model !== undefined) member.model = info.model;
			if (info.threadId !== undefined) this.moveMember(member, info.threadId);
			member.lastActivityAt = now;
			if (this.stalls.get(info.id)?.ownerEditSeq === null) this.stalls.delete(info.id);
		} else {
			const { member } = this.addMember(info.id, info.name, info.role, info.kind, now, info.model);
			if (info.threadId !== undefined) this.moveMember(member, info.threadId);
		}
		if (info.kind === "main") this.mainId = info.id;
		this.publish();
	}

	recordTaskBatch(batchTitle: string, tasks: Array<{ name?: string; agent?: string; task?: string; description?: string }>): string {
		let id: string;
		do id = `thread-${this.nextThreadId++}`;
		while (this.threads.has(id));
		const createdAt = Date.now();
		this.threads.set(id, { id, title: batchTitle, createdAt, memberIds: new Set() });
		const named = tasks.some(task => !task.name) ? new Set(tasks.map(task => task.name)) : null;
		for (const task of tasks) {
			let memberId = task.name;
			if (!memberId) {
				do memberId = `task-${this.nextAnonymousId++}`;
				while (this.members.has(memberId) || named?.has(memberId));
			}
			const worker = this.members.get(memberId) ?? this.addMember(memberId, memberId, task.agent ?? "Worker", "sub", createdAt);
			const member = worker.member;
			if (!member.description) member.description = task.description?.trim() ?? "";
			if (worker.spawned || member.status === "retired") member.startedAt = createdAt;
			member.role = task.agent ?? member.role;
			member.kind = "sub";
			member.status = "working";
			this.moveMember(member, id);
			member.endedAt = null;
			member.lastActivityAt = createdAt;
			worker.spawned = true;
			worker.outcome = undefined;
			this.appendMessage(this.mainId, memberId, task.task ?? `Spawned ${memberId}`, "spawn", task.task ? parseSliceJson(task.task) : null, createdAt);
		}
		this.totalTasks += tasks.length;
		const autoStart = !this.autoStarted && tasks.length > 0 && this.totalTasks >= this.autoStartThreshold;
		if (autoStart) this.autoStarted = true;
		this.publish(autoStart ? this.onAutoStart : undefined);
		return id;
	}

	recordAgentMessage(from: string, to: string, text: string, tag: MessageTag = "info", jsonPayload: Record<string, unknown> | null = null): SwarmMessage {
		const message = this.appendMessage(from, to, text, tag, jsonPayload);
		this.publish();
		return message;
	}

	noteActivity(memberId: string): void {
		const member = this.members.get(memberId)?.member;
		if (!member || member.status === "retired") return;
		member.lastActivityAt = Date.now();
		this.stalls.delete(memberId);
	}

	completeMember(id: string, outputText: string, isError = false): void {
		const entry = this.members.get(id);
		if (!entry) return;
		const payload = parseSynthOutput(outputText);
		const outcome: Outcome = isError || (payload?.specConflict?.length ?? 0) > 0 ? "blocked" : "done";
		const { member } = entry;
		if (entry.spawned) this.doneTasks += Number(outcome === "done") - Number(entry.outcome === "done");
		entry.outcome = outcome;
		if (member.status !== "retired") member.status = outcome;
		member.endedAt ??= Date.now();
		this.appendMessage(id, this.mainId, outputText, outcome, payload);
		this.publish();
	}

	retireMember(id: string): void {
		const member = this.members.get(id)?.member;
		if (!member || member.status === "retired") return;
		member.status = "retired";
		member.lastActivityAt = Date.now();
		member.endedAt ??= member.lastActivityAt;
		if (this.stalls.get(id)?.ownerEditSeq === null) this.stalls.delete(id);
		this.publish();
	}

	getReelFramePath(index: number): string | null {
		return this.reel[index]?.path ?? null;
	}

	checkStalls(now = Date.now()): SwarmMessage[] {
		const alerts: SwarmMessage[] = [];
		// Done workers can have pending owner edits, but a fully inactive swarm stays quiet.
		let working = false;
		for (const { member } of this.members.values()) {
			if (member.status === "working") {
				working = true;
				break;
			}
		}
		if (!working) return alerts;

		const overdueEdits = new Map<string, SwarmMessage>();
		for (const message of this.messages) {
			if (message.tag !== "owner-edit" || now - message.timestamp < this.stallThresholdMs) continue;
			const recipient = this.members.get(message.to);
			if (!recipient || recipient.member.status === "retired" || recipient.lastSentSeq > message.seq) continue;
			const oldest = overdueEdits.get(message.to);
			if (!oldest || oldest.seq > message.seq) overdueEdits.set(message.to, message);
		}
		for (const { member } of this.members.values()) {
			const { id, lastSeq, lastActivityAt, status } = member;
			const edit = overdueEdits.get(id);
			if (!edit && (status !== "working" || now - lastActivityAt < this.stallThresholdMs)) continue;
			const stall = this.stalls.get(id);
			if (stall && stall.lastSeq === lastSeq && (stall.alerts >= 3 || now - stall.lastAlertAt < this.stallThresholdMs)) continue;
			const reason = edit ? `has not answered owner edit #${edit.seq}` : "has not sent an update";
			const message = this.appendMessage("monitor", this.mainId, `@${id} ${reason} (last #${lastSeq}).`, "stall", null, now);
			this.stalls.set(id, {
				lastSeq, alerts: stall?.lastSeq === lastSeq ? stall.alerts + 1 : 1, lastAlertAt: now,
				message, ownerEditSeq: edit?.seq ?? null,
			});
			alerts.push(message);
		}
		if (alerts.length) this.publish();
		return alerts;
	}

	getSnapshot(): SwarmSnapshot {
		let live = false;
		const working: string[] = [];
		const blocked: string[] = [];
		const members = Array.from(this.members.values(), ({ member }) => {
			const { id, status, lastSeq } = member;
			live ||= status === "active" || status === "working" || status === "waiting";
			if (status === "working") working.push(id);
			if (status === "blocked") blocked.push(id);
			const label = status[0].toUpperCase() + status.slice(1);
			return { ...member, now: lastSeq ? `${label} · last #${lastSeq}` : label };
		});

		const messages: SwarmMessage[] = [];
		const attention: SwarmAttentionItem[] = [];
		const milestones: SwarmMilestone[] = [];
		const risks: SwarmRisk[] = [];
		const addAttention = (kind: AttentionKind, severity: SwarmAttentionItem["severity"], title: string, why: string, memberId: string, message: SwarmMessage) => {
			const entry = this.members.get(memberId);
			attention.push({
				id: `${kind}-${message.seq}`, kind, severity, title, why, memberId, seq: message.seq,
				threadId: entry ? entry.member.threadId : message.threadId,
			});
		};
		const firstSeq = this.nextSeq - this.messages.length;
		for (let seq = firstSeq; seq < this.nextSeq; seq++) {
			const message = this.messages[(seq - 1) % this.maxMessages];
			messages.push(message);
			const { tag, from, to, text, jsonPayload } = message;
			const conflicts = jsonPayload?.specConflict;
			const deviations = jsonPayload?.planDeviations;
			if (tag === "owner-edit") {
				const recipient = this.members.get(to);
				if (recipient?.member.status !== "retired" && (recipient?.lastSentSeq ?? 0) <= seq) {
					addAttention("decision", "med", `Owner edit awaiting @${to}`, shortLine(text), to, message);
				}
			} else if (tag === "blocked") {
				const why = isStringArray(conflicts) && conflicts.length ? conflicts[0] : text;
				addAttention("failure", "high", `@${from} is blocked`, shortLine(why), from, message);
			} else if (tag === "done") {
				const edits = jsonPayload?.edits;
				const summary = jsonPayload ? (isStringArray(edits) ? edits[0] : "") : text;
				milestones.push({ id: `m-${seq}`, text: shortLine(summary ?? "") || `@${from} completed`, seq, memberId: from });
			}
			let riskIndex = 0;
			if (isStringArray(conflicts)) {
				for (const text of conflicts) risks.push({ id: `r-${seq}-${riskIndex++}`, text, seq, memberId: from });
			}
			if (isStringArray(deviations) && deviations.length) {
				addAttention("review", "med", `Plan deviation by @${from}`, shortLine(deviations[0]), from, message);
				for (const text of deviations) risks.push({ id: `r-${seq}-${riskIndex++}`, text, seq, memberId: from });
			}
		}
		for (const [id, stall] of this.stalls) {
			const { member } = this.members.get(id)!;
			const active = member.status === "working" ||
				(member.status !== "retired" && stall.ownerEditSeq !== null && stall.ownerEditSeq >= firstSeq);
			if (active && member.lastSeq === stall.lastSeq) {
				addAttention("stuck", "high", `@${id} may be stuck`, stall.message.text, id, stall.message);
			}
		}
		attention.sort((a, b) => attentionRank[a.kind] - attentionRank[b.kind] || (b.seq ?? 0) - (a.seq ?? 0));
		const attentionByThread = new Map<string, string[]>();
		for (const item of attention) {
			if (item.threadId === null) continue;
			const ids = attentionByThread.get(item.threadId);
			if (ids) ids.push(item.id);
			else attentionByThread.set(item.threadId, [item.id]);
		}
		const threads = Array.from(this.threads.values(), (entry): SwarmThread => {
			const { id, title, goal, createdAt } = entry;
			const memberIds = Array.from(entry.memberIds);
			const totalCount = memberIds.length;
			let doneCount = 0;
			let blockedCount = 0;
			let workingCount = 0;
			for (const id of memberIds) {
				const { member, outcome } = this.members.get(id)!;
				if (outcome === "done") doneCount++;
				if (outcome === "blocked") blockedCount++;
				if (member.status === "working") workingCount++;
			}
			const status = blockedCount ? "blocked" : doneCount === totalCount ? "done" : "running";
			const now = status === "blocked" ? `Blocked (${blockedCount})`
				: status === "done" ? `Delivered ${doneCount} ${doneCount === 1 ? "task" : "tasks"}`
				: `${workingCount} working · ${doneCount}/${totalCount} done`;
			return { id, title, summary: goal ?? memberIds.join(", "), status, memberIds, doneCount, totalCount, createdAt, now, attentionIds: attentionByThread.get(id) ?? [] };
		}).sort((a, b) => threadRank[a.status] - threadRank[b.status]);

		const progress: string[] = [];
		if (working.length) progress.push(`${working.length} working (${working.join(", ")})`);
		if (blocked.length) progress.push(`${blocked.length} blocked (${blocked.join(", ")})`);
		let runningSummary = progress.join(", ");
		if (this.totalTasks) {
			runningSummary = this.doneTasks === this.totalTasks ? `All ${this.totalTasks} tasks done`
				: `${runningSummary ? `${runningSummary}; ` : ""}${this.doneTasks} of ${this.totalTasks} tasks done`;
		}
		return {
			goalTitle: this.goalTitle,
			goalSummary: this.goalSummary,
			live,
			startedAt: this.startedAt,
			totalTasks: this.totalTasks,
			doneTasks: this.doneTasks,
			autoStartThreshold: this.autoStartThreshold,
			threads,
			members,
			messages,
			runningSummary: runningSummary || "Idle",
			attention,
			milestones,
			risks,
			reel: this.reel.map((frame, index) => ({ ...frame, index })),
		};
	}

	subscribe(listener: (snapshot: SwarmSnapshot) => void): () => void {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	}

	reset(): void {
		this.goalTitle = "";
		this.goalSummary = "";
		this.startedAt = Date.now();
		this.mainId = "coordinator";
		this.totalTasks = 0;
		this.doneTasks = 0;
		this.nextSeq = 1;
		this.nextThreadId = 1;
		this.nextAnonymousId = 1;
		this.autoStarted = false;
		this.threads.clear();
		this.members.clear();
		this.messages.length = 0;
		this.taskDescriptions.clear();
		this.stalls.clear();
		this.reel.length = 0;
		this.publish();
	}

	private addMember(id: string, name: string, role: string, kind: "main" | "sub", startedAt: number, model = "unknown"): MemberEntry {
		const entry: MemberEntry = {
			member: {
				id, name, role, kind, model, status: kind === "main" ? "active" : "working", threadId: null,
				lastMessage: "", lastSeq: 0, startedAt, endedAt: null, lastActivityAt: startedAt,
				description: this.taskDescriptions.get(id) ?? "",
			},
			lastSentSeq: 0,
			spawned: false,
		};
		this.members.set(id, entry);
		return entry;
	}

	private moveMember(member: MemberEntry["member"], threadId: string | null): void {
		if (member.threadId === threadId) return;
		if (member.threadId !== null) this.threads.get(member.threadId)?.memberIds.delete(member.id);
		member.threadId = threadId;
		if (threadId !== null) this.threads.get(threadId)?.memberIds.add(member.id);
	}

	private appendMessage(from: string, to: string, text: string, tag: MessageTag, payload: Record<string, unknown> | null, timestamp = Date.now()): SwarmMessage {
		const sender = this.members.get(from);
		const recipient = this.members.get(to);
		const frames = parseScreenshots(text);
		const message = Object.freeze({
			seq: this.nextSeq++,
			timestamp,
			from, to, tag, text: text.slice(0, 2000),
			jsonPayload: payload === null ? null : copyJsonPayload(payload),
			threadId: recipient?.member.threadId ?? sender?.member.threadId ?? null,
		});
		if (this.maxMessages > 0) this.messages[(message.seq - 1) % this.maxMessages] = message;
		for (const frame of frames) {
			if (this.reel.some(existing => existing.path === frame.path)) continue;
			this.reel.push({ ...frame, seq: message.seq, from, timestamp });
			if (this.reel.length > 24) this.reel.shift();
		}
		if (tag === "stall") return message;
		if (sender) {
			sender.lastSentSeq = message.seq;
			sender.member.lastActivityAt = timestamp;
			sender.member.lastMessage = message.text;
			sender.member.lastSeq = message.seq;
			this.stalls.delete(from);
		}
		if (recipient && recipient !== sender) {
			recipient.member.lastMessage = message.text;
			recipient.member.lastSeq = message.seq;
			this.stalls.delete(to);
		}
		return message;
	}

	private publish(onAutoStart?: (snapshot: SwarmSnapshot) => void): void {
		if (!onAutoStart && !this.listeners.size) return;
		const snapshot = this.getSnapshot();
		for (const listener of this.listeners) {
			try { listener(snapshot); } catch { /* A subscriber cannot interrupt other observers. */ }
		}
		onAutoStart?.(snapshot);
	}
}
