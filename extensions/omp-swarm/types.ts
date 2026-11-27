// Shared data model for omp-swarm. Imported by state.ts, server.ts, ui.ts, index.ts and tests.
// Local structural extension types keep `bun test` independent of the omp host binary.

export type MemberStatus = "active" | "working" | "waiting" | "done" | "blocked" | "retired";
export type MessageTag = "spawn" | "done" | "blocked" | "owner-edit" | "gate" | "stall" | "info";
export type AttentionKind = "decision" | "failure" | "review" | "stuck" | "error" | "fyi";
export type AttentionSeverity = "high" | "med" | "low";

export interface SwarmMember {
	id: string;
	name: string;
	role: string;
	kind: "main" | "sub";
	model: string;
	status: MemberStatus;
	threadId: string | null;
	lastMessage: string;
	lastSeq: number;
	startedAt: number;
	endedAt: number | null;
	/** Concise present-tense status line, e.g. "Working · last #4". */
	now: string;
	/** Short task description from applyPlanLayout `tasks`; "" when none. */
	description: string;
	lastActivityAt: number;
}

export interface SwarmThread {
	id: string;
	title: string;
	summary: string;
	status: "running" | "done" | "blocked";
	memberIds: string[];
	doneCount: number;
	totalCount: number;
	createdAt: number;
	now: string;
	attentionIds: string[];
}

export interface SwarmMessage {
	seq: number;
	timestamp: number;
	from: string;
	to: string;
	tag: MessageTag;
	text: string;
	jsonPayload: Record<string, unknown> | null;
	threadId: string | null;
}

export interface SwarmSnapshot {
	goalTitle: string;
	goalSummary: string;
	live: boolean;
	startedAt: number;
	totalTasks: number;
	doneTasks: number;
	autoStartThreshold: number;
	threads: SwarmThread[];
	members: SwarmMember[];
	messages: SwarmMessage[];
	runningSummary: string;
	attention: SwarmAttentionItem[];
	milestones: SwarmMilestone[];
	risks: SwarmRisk[];
	reel: SwarmReelFrame[];
}

export interface SwarmAttentionItem {
	id: string;
	kind: AttentionKind;
	severity: AttentionSeverity;
	title: string;
	why: string;
	memberId: string | null;
	seq: number | null;
	threadId: string | null;
}

export interface SwarmMilestone {
	id: string;
	text: string;
	seq: number;
	memberId: string;
}

export interface SwarmRisk {
	id: string;
	text: string;
	seq: number;
	memberId: string;
}

/** `index` is the frame's current position in `reel`; GET /api/reel/<index> serves it. */
export interface SwarmReelFrame {
	index: number;
	path: string;
	seq: number;
	caption: string;
	from: string;
	timestamp: number;
}

export interface SwarmPlanLayout {
	goal?: { title?: string; line?: string };
	tasks?: Record<string, string>;
	threads?: Array<{ id: string; title: string; goal?: string; tasks: string[] }>;
}

export interface SwarmStoreLike {
	getSnapshot(): SwarmSnapshot;
	subscribe(listener: (snapshot: SwarmSnapshot) => void): () => void;
	getReelFramePath?(index: number): string | null;
}

export interface SwarmServerHandle {
	url: string;
	port: number;
	stop: () => void;
}

// --- Minimal structural subset of omp's ExtensionAPI (see omp://extensions.md) ---

export interface ExtensionAgentInfo {
	kind: "main" | "sub";
	id: string;
	name: string;
	depth: number;
	parentId?: string;
}

export interface ExtensionContext {
	cwd?: string;
	hasUI?: boolean;
	mode?: "tui" | "rpc" | "json" | "print";
	agent?: ExtensionAgentInfo;
	models?: { current(): { id: string } | null | undefined };
	ui: { notify(message: string, level?: "info" | "warning" | "error"): void };
}

export interface ExtensionCustomMessage {
	customType: string;
	content: string;
	display: boolean;
	excludeFromContext?: boolean;
}

export interface ExtensionSendMessageOptions {
	triggerTurn?: boolean;
}

// Host events are untyped at this boundary; handlers narrow fields with type guards.
export type ExtensionHandler = (event: Record<string, unknown>, ctx: ExtensionContext) => unknown;

/** The omp events omp-swarm observes; a misspelled name fails type checking. */
export type ExtensionEventName =
	| "session_start"
	| "plan_review_requested"
	| "plan_review_resolved"
	| "tool_call"
	| "tool_result"
	| "agent_end"
	| "session_shutdown";

export interface ExtensionCommand {
	description?: string;
	/** omp declares command handlers as returning Promise<void>. */
	handler: (args: string, ctx: ExtensionContext) => Promise<void>;
}

export interface ExtensionAPI {
	on(event: ExtensionEventName, handler: ExtensionHandler): void;
	registerCommand(name: string, command: ExtensionCommand): void;
	sendMessage?(message: ExtensionCustomMessage, options?: ExtensionSendMessageOptions): void;
}
