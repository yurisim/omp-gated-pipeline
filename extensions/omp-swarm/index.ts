import { startSwarmServer } from "./server";
import { extractAgentTarget, parseScreenshots, SwarmStore } from "./state";
import type { ExtensionAPI, ExtensionContext, ExtensionEventName, SwarmServerHandle } from "./types";

const COORDINATOR = "coordinator";
const SNIPPET_LENGTH = 500;
let autoStartPending = false;
// The store signals the threshold synchronously; the task hook owns the notifying context.
const store = new SwarmStore({ onAutoStart: () => { autoStartPending = true; } });
let server: SwarmServerHandle | null = null;
let stallTimer: NodeJS.Timeout | null = null;

type Task = Parameters<SwarmStore["recordTaskBatch"]>[1][number];

function isTask(value: unknown): value is Task {
	return typeof value === "object" && value !== null && !Array.isArray(value) &&
		(!("name" in value) || value.name === undefined || typeof value.name === "string") &&
		(!("agent" in value) || value.agent === undefined || typeof value.agent === "string") &&
		(!("task" in value) || value.task === undefined || typeof value.task === "string");
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

function stopServer(): void {
	const running = server;
	server = null;
	running?.stop();
}

export default function ompSwarmExtension(pi: ExtensionAPI): void {
	// Factories are rebound for child sessions. Only plan-review correlation is session-local.
	let pendingPlan: { id: string; title: string } | undefined;

	function observe(name: ExtensionEventName, handler: (event: Record<string, unknown>, ctx: ExtensionContext) => void): void {
		pi.on(name, (event, ctx) => {
			try { handler(event, ctx); } catch { /* Never affect the observed turn. */ }
		});
	}

	pi.registerCommand("omp-swarm", {
		description: "Show the local Swarm UI, or use stop or reset",
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
						autoStartPending = false;
						store.reset();
						ctx.ui.notify("Swarm history cleared", "info");
						break;
					default: {
						server ??= startSwarmServer(store);
						const { doneTasks, totalTasks } = store.getSnapshot();
						ctx.ui.notify(`Swarm: ${server.url} (${doneTasks}/${totalTasks} tasks done)`, "info");
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
			const title = "i" in input && typeof input.i === "string" ? input.i.trim() : "";
			store.recordTaskBatch(title || "Task batch", tasks);
			ensureStallTimer(ctx.ui);
			if (autoStartPending) {
				server ??= startSwarmServer(store);
				autoStartPending = false;
				ctx.ui.notify(`Swarm: ${server.url}`, "info");
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
		if (event.toolName === "task") {
			const summary = text.trim();
			if (summary) store.recordAgentMessage("task", from, summary.slice(0, SNIPPET_LENGTH));
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
