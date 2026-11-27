import { startSwarmServer } from "./server";
import { extractAgentTarget, parseObject, parseScreenshots, SwarmStore } from "./state";
import type { ExtensionAPI, ExtensionContext, ExtensionEventName, SwarmServerHandle } from "./types";

export const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60_000;

const COORDINATOR = "coordinator";
const SNIPPET_LENGTH = 500;
let autoStart: "armed" | "started" | "pending" | "suppressed" = "armed";
let server: SwarmServerHandle | null = null;
let stallTimer: NodeJS.Timeout | null = null;
let idleStoppedAtTasks: number | null = null;
// The store signals the first threshold synchronously; the task hook owns the notifying context.
const store = new SwarmStore({
	onAutoStart: () => {
		if (autoStart !== "suppressed" && idleStoppedAtTasks === null) autoStart = "pending";
	},
});

type Task = Parameters<typeof describeTask>[0];

function isTask(value: unknown): value is Task {
	return typeof value === "object" && value !== null && !Array.isArray(value) &&
		(!("name" in value) || value.name === undefined || typeof value.name === "string") &&
		(!("agent" in value) || value.agent === undefined || typeof value.agent === "string") &&
		(!("task" in value) || value.task === undefined || typeof value.task === "string") &&
		(!("solutionSpace" in value) || value.solutionSpace === undefined || typeof value.solutionSpace === "string");
}

function firstProseLine(lines: string[], start = 0): string {
	for (let i = start; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || line.startsWith("#")) continue;
		const prose = line.replace(/^(?:[-*][ \t]+|#+[ \t]*)+/, "");
		const cleaned = (prose.startsWith("`") ? prose.replace(/^`+|`+$/g, "") : prose).trim();
		if (cleaned) return cleaned;
	}
	return "";
}

function clipWords(text: string, max: number): string {
	const cleaned = text.replace(/\s+/g, " ").trim();
	if (cleaned.length <= max) return cleaned;
	const limit = max - 1;
	const boundary = cleaned.lastIndexOf(" ", limit);
	const clipped = cleaned.slice(0, boundary >= Math.floor(max / 2) ? boundary : limit);
	return `${clipped.replace(/[\s,;:]+$/, "")}…`;
}

export function describeTask(task: { name?: string; agent?: string; task?: string; solutionSpace?: string }): string {
	const text = task.task?.trim();
	if (text) {
		const slice = parseObject(text);
		const newTag = /^\[NEW\]\s*/;
		const owned: unknown = Array.isArray(slice?.owns) ? slice.owns[0] : undefined;
		const path = typeof owned === "string" ? owned.trim().replace(newTag, "") : "";
		if (path) return clipWords(path, 64);
		const symbol: unknown = Array.isArray(slice?.symbols) ? slice.symbols[0] : undefined;
		if (typeof symbol === "object" && symbol !== null && "name" in symbol && typeof symbol.name === "string") {
			const name = symbol.name.trim().replace(newTag, "");
			if (name) return clipWords(name, 64);
		}
	}
	return clipWords(task.solutionSpace?.trim() || (text ? firstProseLine(text.split(/\r?\n/)) : ""), 64);
}

export function deriveBatchTitle(input: Record<string, unknown>, tasks: Array<{ name?: string; agent?: string; task?: string; solutionSpace?: string }>): string {
	const intent = typeof input.i === "string" ? input.i.trim() : "";
	if (intent) return clipWords(intent, 48);
	if (typeof input.context === "string") {
		const lines = input.context.split(/\r?\n/);
		const goal = lines.findIndex(line => /^#[ \t]+goal(?:[ \t]+#+)?$/i.test(line.trim()));
		const title = (goal >= 0 && firstProseLine(lines, goal + 1)) || firstProseLine(lines);
		if (title.length >= 4 && !/^adversarial second-opinion review/i.test(title)) return clipWords(title, 48);
	}
	if (tasks.length === 1) return clipWords(describeTask(tasks[0]) || tasks[0].name?.trim() || "Task batch", 48);
	if (tasks.length > 1) {
		const names = tasks.map(task => task.name?.trim()).filter(Boolean);
		if (names.length) {
			const prefix = tasks.every(task => /review/i.test(task.agent ?? "")) ? "Review: "
				: tasks.every(task => task.agent === "scout") ? "Scout: " : "";
			const rest = names.length > 3 ? ` +${names.length - 3}` : "";
			return clipWords(`${prefix}${names.slice(0, 3).join(", ")}${rest}`, 48);
		}
	}
	return "Task batch";
}

function readText(content: unknown): string | undefined {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return undefined;
	let text: string | undefined;
	for (const part of content) {
		if (typeof part === "object" && part !== null && "type" in part && part.type === "text" &&
			"text" in part && typeof part.text === "string") {
			text = text === undefined ? part.text : `${text}\n${part.text}`;
		}
	}
	return text;
}

function readPlanTasks(content: unknown): Record<string, string> | undefined {
	if (typeof content !== "string") return undefined;
	let inWaves = false;
	let tasks: Record<string, string> | undefined;
	// Consume fenced blocks whole so headings inside examples do not delimit the section.
	const blocks = /^ {0,3}(?:(`{3,}|~{3,})[ \t]*([^\r\n]*)\r?\n([\s\S]*?)^ {0,3}\1[ \t]*(?=\r?$)|(#{1,2})(?=[ \t]|\r?$)([^\r\n]*))/gm;
	for (const [, , language, body, level, heading] of content.matchAll(blocks)) {
		if (level) {
			if (inWaves) break;
			inWaves = level === "##" && heading.trim() === "Parallel waves";
			continue;
		}
		if (!inWaves || language.trim().toLowerCase() !== "json") continue;

		let slices: unknown;
		try { slices = JSON.parse(body); } catch { continue; }
		if (!Array.isArray(slices)) continue;
		for (const slice of slices as unknown[]) {
			if (typeof slice !== "object" || slice === null ||
				!("id" in slice) || typeof slice.id !== "string" || !slice.id) continue;
			const owned: unknown = "owns" in slice && Array.isArray(slice.owns) ? slice.owns[0] : undefined;
			let description = typeof owned === "string" ? owned.trim() : "";
			if (!description && "symbols" in slice && Array.isArray(slice.symbols)) {
				const first: unknown = slice.symbols[0];
				if (typeof first === "object" && first !== null && "name" in first && typeof first.name === "string") {
					description = first.name.trim();
				}
			}
			if (description) (tasks ??= Object.create(null))[slice.id] = description;
		}
	}
	return tasks;
}

function readYieldCompletion(content: unknown): { text: string; isError?: true } | undefined {
	if (!Array.isArray(content)) return undefined;
	for (let i = content.length - 1; i >= 0; i--) {
		const part: unknown = content[i];
		if (typeof part !== "object" || part === null || !("type" in part) || part.type !== "toolCall" ||
			!("name" in part) || part.name !== "yield" || !("arguments" in part)) continue;
		const args = part.arguments;
		if (typeof args !== "object" || args === null || Array.isArray(args)) continue;
		if ("error" in args && typeof args.error === "string" && args.error) {
			return { text: args.error, isError: true };
		}
		// The host wraps the payload in `data`; also accept a direct structured payload.
		const data = "data" in args ? args.data : args;
		if (data === undefined || data === null) continue;
		const text = typeof data === "string" ? data : JSON.stringify(data);
		if (text !== undefined) return { text };
	}
	return undefined;
}

function ensureStallTimer(ui: ExtensionContext["ui"]): void {
	if (stallTimer !== null) return;
	const notify = ui.notify.bind(ui);
	stallTimer = setInterval(() => {
		try {
			for (const message of store.checkStalls()) {
				try { notify(message.text, "warning"); } catch { /* Keep notifying other stalls. */ }
			}
		} catch { /* Monitoring must not affect the session. */ }
	}, 60_000);
	stallTimer.unref?.();
}

function stopStallTimer(): void {
	const timer = stallTimer;
	stallTimer = null;
	clearInterval(timer ?? undefined);
}

function ensureServer(idleTimeoutMs: number, ui?: ExtensionContext["ui"]): SwarmServerHandle {
	if (server !== null) {
		autoStart = "started";
		return server;
	}
	const handle = startSwarmServer(store, {
		idleTimeoutMs,
		onIdleStop: () => {
			if (server !== handle) return;
			server = null;
			idleStoppedAtTasks = store.getSnapshot().totalTasks;
			stopStallTimer();
			try { ui?.notify("Swarm server auto-stopped after idle timeout", "info"); } catch { /* Notification must not interrupt cleanup. */ }
		},
	});
	server = handle;
	idleStoppedAtTasks = null;
	autoStart = "started";
	return handle;
}

function stopServer(): void {
	const running = server;
	// A server left running by reset may still be active or have since stopped on idle.
	if (running !== null || autoStart !== "armed" || idleStoppedAtTasks !== null) autoStart = "suppressed";
	idleStoppedAtTasks = null;
	server = null;
	running?.stop();
}

export function browserOpenCommand(url: string, platform: NodeJS.Platform = process.platform): [string, ...string[]] {
	switch (platform) {
		case "win32": return ["rundll32.exe", "url.dll,FileProtocolHandler", url];
		case "darwin": return ["open", url];
		default: return ["xdg-open", url];
	}
}

export function openSwarmUrl(url: string): boolean {
	if (!/^http:\/\/(?:127\.0\.0\.1|\[::1\]):\d+$/.test(url)) return false;
	try {
		const proc = Bun.spawn(browserOpenCommand(url), { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
		proc.unref();
		return true;
	} catch {
		return false;
	}
}

function canOpenBrowser(ctx: ExtensionContext): boolean {
	return ctx.hasUI === true && ctx.mode !== "print" && ctx.mode !== "json" && process.env.OMP_SWARM_NO_OPEN !== "1";
}

function postSwarmChat(pi: ExtensionAPI, content: string): void {
	try {
		pi.sendMessage?.({ customType: "omp-swarm", content, display: true, excludeFromContext: true }, { triggerTurn: false });
	} catch { /* A chat failure must not suppress the notification. */ }
}

export default function ompSwarmExtension(
	pi: ExtensionAPI,
	options?: { openUrl?: (url: string) => boolean; idleTimeoutMs?: number },
): void {
	const openUrl = options?.openUrl ?? openSwarmUrl;
	const idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
	// Factories are rebound for child sessions. Only plan-review correlation is session-local.
	let pendingPlan: { id: string; title: string } | undefined;

	function observe(name: ExtensionEventName, handler: (event: Record<string, unknown>, ctx: ExtensionContext) => void): void {
		pi.on(name, (event, ctx) => {
			try { handler(event, ctx); } catch { /* Never affect the observed turn. */ }
		});
	}

	pi.registerCommand("omp-swarm", {
		description: "Open the local Swarm UI in browser and chat, or use stop or reset",
		async handler(args, ctx) {
			try {
				switch (args.trim()) {
					case "stop":
						stopStallTimer();
						stopServer();
						ctx.ui.notify("Swarm server stopped", "info");
						break;
					case "reset":
						stopStallTimer();
						autoStart = "armed";
						idleStoppedAtTasks = null;
						store.reset();
						ctx.ui.notify("Swarm history cleared", "info");
						break;
					default: {
						const active = ensureServer(idleTimeoutMs, ctx.ui);
						const { doneTasks, totalTasks } = store.getSnapshot();
						const summary = `Swarm UI: ${active.url} (${doneTasks}/${totalTasks} tasks done)`;
						let opened = false;
						if (canOpenBrowser(ctx)) {
							try { opened = openUrl(active.url); } catch { /* Keep the URL available in chat. */ }
						}
						postSwarmChat(pi, summary);
						ctx.ui.notify(opened ? `${summary} — opened in browser` : summary, "info");
					}
				}
			} catch (error) {
				try {
					ctx.ui.notify(`Swarm: ${error instanceof Error ? error.message : String(error)}`, "error");
				} catch { /* Notification failure must not escape either. */ }
			}
		},
	});

	observe("session_start", (_event, ctx) => {
		const agent = ctx.agent;
		if (!agent) return;
		store.registerMember({
			id: agent.id,
			name: agent.kind === "main" ? COORDINATOR : agent.id,
			role: agent.kind === "main" ? "Coordinator" : agent.name,
			kind: agent.kind,
			model: ctx.models?.current()?.id ?? "unknown",
		});
	});

	// The resolved event only has a review id and choice; the requested event carries the title/path.
	observe("plan_review_requested", event => {
		if (typeof event.reviewId !== "string") return;
		const title = (typeof event.title === "string" && event.title.trim()) ||
			(typeof event.planFilePath === "string" && event.planFilePath.trim());
		if (title) pendingPlan = { id: event.reviewId, title };
		const tasks = readPlanTasks(event.planContent);
		if (tasks) store.applyPlanLayout({ goal: { title: title || undefined }, tasks });
	});

	observe("plan_review_resolved", event => {
		if (!pendingPlan || event.reviewId !== pendingPlan.id) return;
		const { title } = pendingPlan;
		pendingPlan = undefined;
		if (event.choice === "execute" || event.choice === "compact" || event.choice === "keep") {
			store.setGoal(title);
		}
	});

	observe("tool_call", (event, ctx) => {
		if (ctx.agent) store.noteActivity(ctx.agent.id);
		if (event.toolName !== "task" && event.toolName !== "write") return;
		const input = event.input;
		if (typeof input !== "object" || input === null) return;
		if (event.toolName === "task") {
			const tasks = "tasks" in input ? input.tasks : undefined;
			if (!Array.isArray(tasks) || !tasks.length || !tasks.every(isTask)) return;
			store.recordTaskBatch(
				deriveBatchTitle(input as Record<string, unknown>, tasks),
				tasks.map(task => ({ ...task, description: describeTask(task) })),
			);
			ensureStallTimer(ctx.ui);
			if (server === null && idleStoppedAtTasks !== null) {
				const snap = store.getSnapshot();
				if (snap.totalTasks - idleStoppedAtTasks >= snap.autoStartThreshold) autoStart = "pending";
			}
			if (autoStart === "pending") {
				const active = ensureServer(idleTimeoutMs, ctx.ui);
				const summary = `Swarm UI: ${active.url}`;
				postSwarmChat(pi, summary);
				ctx.ui.notify(summary, "info");
			}
		} else if ("path" in input && typeof input.path === "string" &&
			"content" in input && typeof input.content === "string") {
			const target = extractAgentTarget(input.path);
			if (target) store.recordAgentMessage(ctx.agent?.id ?? COORDINATOR, target, input.content.slice(0, SNIPPET_LENGTH), "owner-edit");
		}
	});

	observe("tool_result", (event, ctx) => {
		if (ctx.agent) store.noteActivity(ctx.agent.id);
		const text = readText(event.content);
		if (!text) return;
		const from = ctx.agent?.id ?? COORDINATOR;
		const frames = parseScreenshots(text);
		if (frames.length) {
			const lines = frames.map(({ path, caption }) => `Screenshot: ${path} | ${caption}`).join("\n");
			store.recordAgentMessage(from, COORDINATOR, lines, "info");
		}
	});

	observe("agent_end", (event, ctx) => {
		const agent = ctx.agent;
		const messages = event.messages;
		if (agent?.kind !== "sub" || !Array.isArray(messages)) return;
		for (let i = messages.length - 1; i >= 0; i--) {
			const message: unknown = messages[i];
			if (typeof message !== "object" || message === null || !("role" in message) || message.role !== "assistant") continue;
			const isError = "stopReason" in message && (message.stopReason === "error" || message.stopReason === "aborted");
			const content = "content" in message ? message.content : undefined;
			const text = readText(content);
			const yielded = text ? undefined : readYieldCompletion(content);
			if (text !== undefined || yielded || isError) {
				const errorMessage = "errorMessage" in message && typeof message.errorMessage === "string" ? message.errorMessage : "";
				store.completeMember(agent.id, yielded?.text ?? text ?? errorMessage, isError || yielded?.isError);
			}
			break;
		}
	});

	observe("session_shutdown", (_event, ctx) => {
		if (ctx.agent?.kind === "sub") store.retireMember(ctx.agent.id);
		else if (ctx.agent?.kind === "main") {
			stopStallTimer();
			stopServer();
		}
	});
}
