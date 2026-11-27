import { describe, expect, test } from "bun:test";
import type { SwarmSnapshot } from "../extensions/omp-swarm/types";

const STATE = "../extensions/omp-swarm/state";
const COORD = { id: "coordinator", name: "coordinator", role: "Coordinator", kind: "main" as const, model: "m" };

class FakeElement {
	readonly attributes = new Map<string, string>();
	readonly dataset: Record<string, string> = {};
	readonly listeners = new Map<string, Array<(event?: Record<string, unknown>) => void>>();
	readonly classes = new Set<string>();
	readonly classList = {
		add: (...names: string[]) => { for (const name of names) this.classes.add(name); },
		remove: (...names: string[]) => { for (const name of names) this.classes.delete(name); },
		contains: (name: string) => this.classes.has(name),
	};
	children: Array<FakeElement | string> = [];
	id = "";
	title = "";
	type = "";
	value = "1";
	max = "1";
	hidden = false;
	disabled = false;
	tabIndex = 0;
	clientWidth = 800;
	clientHeight = 540;
	scrollLeft = 0;
	scrollTop = 0;
	dateTime = "";
	private _text = "";
	constructor(readonly tag: string) {}
	get className() { return Array.from(this.classes).join(" "); }
	set className(value: string) {
		this.classes.clear();
		for (const part of value.split(/\s+/).filter(Boolean)) this.classes.add(part);
	}
	get textContent(): string {
		if (this.children.length) return this.children.map(c => typeof c === "string" ? c : c.textContent).join("");
		return this._text;
	}
	set textContent(value: string) {
		this.children = [];
		this._text = String(value);
	}
	get childElementCount() { return this.children.filter(c => c instanceof FakeElement).length; }
	get firstElementChild() { return this.children.find(c => c instanceof FakeElement) ?? null; }
	setAttribute(name: string, value: string) {
		this.attributes.set(name, String(value));
		if (name === "class") this.className = String(value);
	}
	getAttribute(name: string) { return this.attributes.get(name) ?? null; }
	append(...items: Array<FakeElement | string>) {
		for (const item of items) {
			if (item instanceof FakeElement && item.tag === "fragment") this.children.push(...item.children);
			else this.children.push(item);
		}
	}
	prepend(...items: Array<FakeElement | string>) {
		const expanded: Array<FakeElement | string> = [];
		for (const item of items) {
			if (item instanceof FakeElement && item.tag === "fragment") expanded.push(...item.children);
			else expanded.push(item);
		}
		this.children.unshift(...expanded);
	}
	replaceChildren(...items: Array<FakeElement | string>) {
		this.children = [];
		this.append(...items);
	}
	querySelectorAll() { return []; }
	querySelector() { return null; }
	contains() { return false; }
	focus() {}
	getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
	addEventListener(type: string, fn: (event?: Record<string, unknown>) => void) {
		const list = this.listeners.get(type) ?? [];
		list.push(fn);
		this.listeners.set(type, list);
	}
	trigger(type: string, event: Record<string, unknown> = {}) {
		for (const fn of this.listeners.get(type) ?? []) fn({ preventDefault() {}, ...event });
	}
}

function makeHarness(html: string) {
	const elements = new Map<string, FakeElement>();
	const document = {
		activeElement: null,
		getElementById(id: string) {
			if (!elements.has(id)) elements.set(id, new FakeElement(id));
			return elements.get(id)!;
		},
		createElement: (tag: string) => new FakeElement(tag),
		createElementNS: (_ns: string, tag: string) => new FakeElement(tag),
		createDocumentFragment: () => new FakeElement("fragment"),
		createTextNode: (text: string) => text,
	};
	const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
	const boot = script.indexOf("\nconst views =");
	const api = new Function("document", `${script.slice(0, boot)}
		return {
			render(next, opts = {}) {
				snapshot = next;
				retainedSeqs = new Set(next.messages.map(m => m.seq));
				if (opts.view !== undefined) graphView = opts.view;
				if (opts.followLive !== undefined) followLive = opts.followLive;
				if (opts.cursor !== undefined) cursor = opts.cursor;
				if ('selection' in opts) selection = opts.selection;
				renderGraph();
			},
			zoomBy(factor) { if (typeof zoomBy === 'function') zoomBy(factor); },
			resetCamera() { if (typeof resetCamera === 'function') resetCamera(); },
			renderMembers(next) {
				snapshot = next;
				byId('member-search').value = '';
				renderMembers();
			},
			getViewBox() { return byId('graph-svg').getAttribute('viewBox'); },
		};`)(document) as {
			render: (next: SwarmSnapshot, opts?: Record<string, unknown>) => void;
			zoomBy: (factor: number) => void;
			resetCamera: () => void;
			getViewBox: () => string | null;
			renderMembers: (next: SwarmSnapshot) => void;
		};
	return { document, api };
}

const walk = (root: FakeElement): FakeElement[] => {
	const out: FakeElement[] = [root];
	for (const child of root.children) if (child instanceof FakeElement) out.push(...walk(child));
	return out;
};

describe("Swarm constellation UI", () => {
	test("lays out radial depth rings, orbital tree edges, non-overlapping circular stars, and keeps star coordinates fixed in Mentions", async () => {
		const { renderSwarmHtml } = await import("../extensions/omp-swarm/ui.ts");
		const { SwarmStore } = await import(STATE);
		const store = new SwarmStore();
		store.registerMember(COORD);
		store.recordTaskBatch("Wave 1", ["S1", "S2", "S3", "S4"].map(name => ({ name, agent: "synth" })));
		store.recordTaskBatch("Wave 2", ["S5", "S6"].map(name => ({ name, agent: "synth" })));
		store.completeMember("S1", "Done S1");
		store.recordAgentMessage("S2", "S3", "Peer handoff");
		store.recordAgentMessage("S6", COORD.id, "Wave 2 update");
		const frame = store.getSnapshot();

		const { document, api } = makeHarness(renderSwarmHtml());
		api.render(frame, { view: "Network", followLive: true, cursor: frame.messages.length, selection: undefined });

		const graph = document.getElementById("graph-svg");
		const all = walk(graph);

		// Concentric depth rings at origin (ring1 for threads, ring2 for workers)
		const rings = all
			.filter(el => el.tag === "circle" && el.classList.contains("constellation-ring"))
			.map(el => ({ cx: Number(el.getAttribute("cx")), cy: Number(el.getAttribute("cy")), r: Number(el.getAttribute("r")) }));
		expect(rings.length).toBe(2);
		for (const ring of rings) {
			expect(ring.cx).toBe(0);
			expect(ring.cy).toBe(0);
		}
		expect(rings[1].r).toBeGreaterThan(rings[0].r);

		// Radial + orbital tree skeleton edges (at least one orbital arc command " A ")
		const treeEdges = all.filter(el => el.tag === "path" && el.classList.contains("tree-edge"));
		expect(treeEdges.length).toBeGreaterThanOrEqual(frame.threads.length + 6);
		expect(treeEdges.some(el => (el.getAttribute("d") ?? "").includes(" A "))).toBe(true);

		// Member stars are circles with on-node status glyphs, no 180x60 rects, and no overlapping centers
		const memberGroups = all.filter(el => el.dataset.key?.startsWith("member:"));
		expect(memberGroups.length).toBe(frame.members.length);
		const memberStars = memberGroups.map(group => {
			expect(group.children.some(c => c instanceof FakeElement && c.tag === "rect")).toBe(false);
			const circle = walk(group).find(el => el.tag === "circle" && el.classList.contains("member-star"))!;
			expect(circle).toBeDefined();
			const glyph = walk(group).find(el => el.tag === "text" && el.classList.contains("star-glyph"));
			expect(glyph).toBeDefined();
			expect(glyph!.getAttribute("aria-hidden")).toBe("true");
			expect(glyph!.textContent.trim().length).toBeGreaterThan(0);
			return {
				id: group.dataset.key.slice("member:".length),
				cx: Number(circle.getAttribute("cx")),
				cy: Number(circle.getAttribute("cy")),
				r: Number(circle.getAttribute("r")),
				glyph: glyph!.textContent.trim(),
			};
		});
		// Workers orbit ring2; the coordinator sits on the hub at the origin
		for (const star of memberStars) {
			const radius = Math.hypot(star.cx, star.cy);
			if (star.id === COORD.id) expect(radius).toBeCloseTo(0, 0);
			else expect(radius).toBeCloseTo(rings[1].r, 0);
		}
		// Status glyphs differ between statuses so color is never alone
		const statusOf = (id: string) => frame.members.find(m => m.id === id)!.status;
		const glyphOf = (id: string) => memberStars.find(s => s.id === id)!.glyph;
		expect(statusOf("S1")).not.toBe(statusOf("S2"));
		expect(glyphOf("S1")).not.toBe(glyphOf("S2"));
		for (let i = 0; i < memberStars.length; i++) {
			for (let j = i + 1; j < memberStars.length; j++) {
				const a = memberStars[i], b = memberStars[j];
				const dist = Math.hypot(a.cx - b.cx, a.cy - b.cy);
				expect(dist).toBeGreaterThan(a.r + b.r);
			}
		}

		// Lane buttons live in regions and never contain member buttons; thread branch stars orbit ring1 with glyphs
		const laneGroups = all.filter(el => el.dataset.key?.startsWith("lane:"));
		expect(laneGroups.length).toBe(1 + frame.threads.length);
		for (const laneGroup of laneGroups) {
			expect(walk(laneGroup).some(el => el.dataset.key?.startsWith("member:"))).toBe(false);
			if (laneGroup.dataset.key === "lane:coordinator") continue;
			const star = walk(laneGroup).find(el => el.tag === "circle" && el.classList.contains("lane-star"))!;
			expect(star).toBeDefined();
			expect(Math.hypot(Number(star.getAttribute("cx")), Number(star.getAttribute("cy")))).toBeCloseTo(rings[0].r, 0);
			const glyph = walk(laneGroup).find(el => el.tag === "text" && el.classList.contains("star-glyph"));
			expect(glyph?.getAttribute("aria-hidden")).toBe("true");
			expect(glyph!.textContent.trim().length).toBeGreaterThan(0);
		}

		// Network view draws every message
		const networkSeqs = all
			.filter(el => el.dataset.key?.startsWith("message:"))
			.map(el => Number(el.dataset.key.slice("message:".length)));
		expect(networkSeqs).toEqual(frame.messages.map(m => m.seq));

		// Mentions view filters visible edges without moving any star
		api.render(frame, { view: "Mentions", selection: { kind: "member", id: COORD.id } });
		const afterStars = walk(graph)
			.filter(el => el.dataset.key?.startsWith("member:"))
			.map(group => {
				const circle = walk(group).find(el => el.tag === "circle" && el.classList.contains("member-star"))!;
				return { id: group.dataset.key.slice("member:".length), cx: Number(circle.getAttribute("cx")), cy: Number(circle.getAttribute("cy")) };
			});
		expect(afterStars).toEqual(memberStars.map(({ id, cx, cy }) => ({ id, cx, cy })));
		const visibleSeqs = walk(graph)
			.filter(el => el.dataset.key?.startsWith("message:"))
			.map(el => Number(el.dataset.key.slice("message:".length)));
		expect(visibleSeqs).toEqual(frame.messages.filter(m => m.from === COORD.id || m.to === COORD.id).map(m => m.seq));
	});

	test("supports zoom in, zoom out, and fit camera reset via SVG viewBox", async () => {
		const { renderSwarmHtml } = await import("../extensions/omp-swarm/ui.ts");
		const { SwarmStore } = await import(STATE);
		const store = new SwarmStore();
		store.registerMember(COORD);
		store.recordTaskBatch("Wave 1", [{ name: "S1", agent: "synth" }, { name: "S2", agent: "synth" }]);
		const frame = store.getSnapshot();

		const { api } = makeHarness(renderSwarmHtml());
		api.render(frame, { view: "Network", followLive: true, cursor: frame.messages.length });
		const parseBox = () => (api.getViewBox() ?? "").split(/\s+/).map(Number);

		const initial = parseBox();
		expect(initial.length).toBe(4);
		expect(initial[2]).toBeGreaterThan(0);

		api.zoomBy(1.5);
		const zoomedIn = parseBox();
		expect(zoomedIn[2]).toBeLessThan(initial[2]);
		expect(zoomedIn[3]).toBeLessThan(initial[3]);

		api.zoomBy(0.5);
		const zoomedOut = parseBox();
		expect(zoomedOut[2]).toBeGreaterThan(zoomedIn[2]);

		api.resetCamera();
		expect(parseBox()).toEqual(initial);
	});

	test("renders side-by-side Graph workspace, zoom controls, Members grid, and preserves Vice & a11y contracts", async () => {
		const { renderSwarmHtml } = await import("../extensions/omp-swarm/ui.ts");
		const html = renderSwarmHtml();
		expect(html).toContain('class="graph-workspace"');
		expect(html).toContain('class="graph-stage"');
		expect(html).toContain('class="graph-side"');
		expect(html).toContain('id="zoom-in"');
		expect(html).toContain('id="zoom-out"');
		expect(html).toContain('id="zoom-fit"');
		expect(html).toContain(".member-grid");
		expect(html).toContain(".constellation-ring");
		expect(html).toContain(".tree-edge");
		expect(html).not.toContain("const NODE_W = 180;");
		expect(html).not.toContain("innerHTML");
	});

	test("renders active and retired Members lists as .member-grid", async () => {
		const { renderSwarmHtml } = await import("../extensions/omp-swarm/ui.ts");
		const { SwarmStore } = await import(STATE);
		const store = new SwarmStore();
		store.registerMember(COORD);
		store.recordTaskBatch("Wave 1", [{ name: "S1", agent: "synth" }, { name: "S2", agent: "synth" }]);
		store.completeMember("S1", "Done S1");
		store.retireMember("S1");
		const frame = store.getSnapshot();
		expect(frame.members.some(m => m.status === "retired")).toBe(true);

		const { document, api } = makeHarness(renderSwarmHtml());
		api.renderMembers(frame);
		for (const id of ["members", "retired-members"]) {
			const list = document.getElementById(id).firstElementChild as FakeElement | null;
			expect(list?.tag).toBe("ul");
			expect(list!.classList.contains("member-grid")).toBe(true);
		}
	});
});
