import type { SwarmServerHandle, SwarmSnapshot, SwarmStoreLike } from "./types";
import { renderSwarmHtml } from "./ui";

const encoder = new TextEncoder();
const privateHeaders = {
	"Cross-Origin-Resource-Policy": "same-origin",
	"X-Content-Type-Options": "nosniff",
};

export function startSwarmServer(store: SwarmStoreLike, options?: { port?: number; hostname?: string }): SwarmServerHandle {
	const host = options?.hostname?.toLowerCase();
	const hostname = !host || host === "localhost" ? "127.0.0.1" : host === "[::1]" ? "::1" : host;
	if (hostname !== "127.0.0.1" && hostname !== "::1") throw new Error("Swarm must bind to a loopback address");
	const urlHost = hostname === "::1" ? "[::1]" : hostname;
	const html = renderSwarmHtml();
	const streams = new Set<() => void>();

	function events(signal: AbortSignal): Response {
		let unsubscribe: (() => void) | undefined;
		let cancel: (() => void) | undefined;
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				function close() {
					if (!streams.delete(close)) return;
					unsubscribe?.();
					signal.removeEventListener("abort", close);
					// Bun may have closed the stream already when the request aborts.
					try { controller.close(); } catch { /* already closed */ }
				}
				cancel = close;
				streams.add(close);
				if (signal.aborted) {
					close();
					return;
				}
				signal.addEventListener("abort", close, { once: true });

				function send(event: "snapshot" | "update", snapshot: SwarmSnapshot) {
					if (streams.has(close)) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(snapshot)}\n\n`));
				}
				try {
					send("snapshot", store.getSnapshot());
					unsubscribe = store.subscribe(snapshot => send("update", snapshot));
				} catch (error) {
					close();
					throw error;
				}
			},
			cancel() { cancel?.(); },
		});
		return new Response(body, { headers: {
			...privateHeaders,
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		} });
	}

	async function reelFrame(index: number): Promise<Response> {
		if (Number.isSafeInteger(index)) {
			const path = store.getReelFramePath?.(index);
			const extension = path && /\.(png|jpe?g|webp)$/i.exec(path)?.[1].toLowerCase();
			// A reel request must not probe a network share named by tool output.
			if (path && extension && /^(?:[A-Za-z]:[\\/]|\/(?![\\/]))/.test(path)) {
				const file = Bun.file(path);
				if (await file.exists()) return new Response(file, { headers: {
					...privateHeaders,
					"Content-Type": `image/${extension === "jpg" ? "jpeg" : extension}`,
					"Cache-Control": "no-store",
				} });
			}
		}
		return new Response("Not found", { status: 404 });
	}

	const server = Bun.serve({
		hostname,
		port: options?.port ?? 0,
		fetch(req, server) {
			// Loopback binding alone does not reject requests made through a rebound domain.
			const authority = req.headers.get("host")?.toLowerCase();
			const port = server.port;
			if (authority !== `${urlHost}:${port}` && authority !== `localhost:${port}` &&
				!(port === 80 && (authority === urlHost || authority === "localhost"))) {
				return new Response("Forbidden", { status: 403 });
			}
			if (req.method === "GET") {
				const pathname = new URL(req.url).pathname;
				switch (pathname) {
					case "/": return new Response(html, { headers: {
						...privateHeaders,
						"Content-Type": "text/html; charset=utf-8",
						"Content-Security-Policy": "frame-ancestors 'none'; base-uri 'none'",
						"X-Frame-Options": "DENY",
					} });
					case "/api/state": return Response.json(store.getSnapshot(), { headers: {
						...privateHeaders, "Cache-Control": "no-store",
					} });
					case "/api/events":
						server.timeout(req, 0);
						return events(req.signal);
					default: {
						const match = /^\/api\/reel\/(\d+)$/.exec(pathname);
						if (match) return reelFrame(Number(match[1]));
					}
				}
			}
			return new Response("Not found", { status: 404 });
		},
	});
	const port = server.port!; // This is a TCP listener, not a Unix socket.
	let stopped = false;
	return {
		url: `http://${urlHost}:${port}`,
		port,
		stop() {
			if (stopped) return;
			stopped = true;
			for (const close of streams) close();
			void server.stop(true);
		},
	};
}
