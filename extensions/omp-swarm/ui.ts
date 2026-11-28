export function renderSwarmHtml(): string {
	return String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="data:,">
<title>Swarm | omp</title>
<style>
:root {
	color-scheme: light dark;
	--font-display: 'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
	--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
	--font-mono: ui-monospace, 'Cascadia Mono', Consolas, monospace;
	--in-oklab: ;
	--bg-light: #f4f6fc;
	--dusk-light: #ebeefa;
	--surface-light: #ffffff;
	--surface-2-light: #eef0f9;
	--border-light: #cfd5ea;
	--border-strong-light: #687196;
	--fg-light: #121528;
	--muted-light: #4c5373;
	--ok-light: #166534;
	--info-light: #0369a1;
	--warn-light: #92400e;
	--err-light: #be123c;
	--accent-light: #6d28d9;
	--brand-pink-light: #d9166c;
	--brand-cyan-light: #0e7490;
	--brand-ink-light: #ffffff;
	--bg-dark: #0b0d17;
	--dusk-dark: #101222;
	--surface-dark: #141728;
	--surface-2-dark: #1a1e35;
	--border-dark: #282e50;
	--border-strong-dark: #6a729e;
	--fg-dark: #eef0ff;
	--muted-dark: #9aa0c3;
	--ok-dark: #4ade80;
	--info-dark: #38bdf8;
	--warn-dark: #ffd54d;
	--err-dark: #fb7185;
	--accent-dark: #a78bfa;
	--brand-pink-dark: #ff2a85;
	--brand-cyan-dark: #00f0ff;
	--brand-ink-dark: #0b0d17;
	--bg: var(--bg-light);
	--dusk: var(--dusk-light);
	--surface: var(--surface-light);
	--surface-2: var(--surface-2-light);
	--border: var(--border-light);
	--border-strong: var(--border-strong-light);
	--fg: var(--fg-light);
	--muted: var(--muted-light);
	--ok: var(--ok-light);
	--info: var(--info-light);
	--warn: var(--warn-light);
	--err: var(--err-light);
	--accent: var(--accent-light);
	--brand-pink: var(--brand-pink-light);
	--brand-cyan: var(--brand-cyan-light);
	--brand-ink: var(--brand-ink-light);
	scrollbar-color: var(--border-strong) var(--surface);
	scroll-padding-block-start: 3.25rem;
}
@media (prefers-color-scheme: dark) {
	:root {
		--bg: var(--bg-dark);
		--dusk: var(--dusk-dark);
		--surface: var(--surface-dark);
		--surface-2: var(--surface-2-dark);
		--border: var(--border-dark);
		--border-strong: var(--border-strong-dark);
		--fg: var(--fg-dark);
		--muted: var(--muted-dark);
		--ok: var(--ok-dark);
		--info: var(--info-dark);
		--warn: var(--warn-dark);
		--err: var(--err-dark);
		--accent: var(--accent-dark);
		--brand-pink: var(--brand-pink-dark);
		--brand-cyan: var(--brand-cyan-dark);
		--brand-ink: var(--brand-ink-dark);
	}
}
@supports (color: light-dark(white, black)) {
	:root {
		--bg: light-dark(var(--bg-light), var(--bg-dark));
		--dusk: light-dark(var(--dusk-light), var(--dusk-dark));
		--surface: light-dark(var(--surface-light), var(--surface-dark));
		--surface-2: light-dark(var(--surface-2-light), var(--surface-2-dark));
		--border: light-dark(var(--border-light), var(--border-dark));
		--border-strong: light-dark(var(--border-strong-light), var(--border-strong-dark));
		--fg: light-dark(var(--fg-light), var(--fg-dark));
		--muted: light-dark(var(--muted-light), var(--muted-dark));
		--ok: light-dark(var(--ok-light), var(--ok-dark));
		--info: light-dark(var(--info-light), var(--info-dark));
		--warn: light-dark(var(--warn-light), var(--warn-dark));
		--err: light-dark(var(--err-light), var(--err-dark));
		--accent: light-dark(var(--accent-light), var(--accent-dark));
		--brand-pink: light-dark(var(--brand-pink-light), var(--brand-pink-dark));
		--brand-cyan: light-dark(var(--brand-cyan-light), var(--brand-cyan-dark));
		--brand-ink: light-dark(var(--brand-ink-light), var(--brand-ink-dark));
	}
}
@supports (background: linear-gradient(in oklab, white, black)) {
	:root { --in-oklab: in oklab; }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
::selection { background: var(--brand-pink); color: var(--brand-ink); }
body {
	margin: 0;
	min-block-size: 100vh;
	background-color: var(--bg);
	background-image:
		radial-gradient(circle at 18% 0%, color-mix(in oklab, var(--brand-pink) 13%, transparent), transparent 44%),
		radial-gradient(circle at 86% 6%, color-mix(in oklab, var(--brand-cyan) 11%, transparent), transparent 40%),
		linear-gradient(180deg var(--in-oklab), var(--dusk) 0%, var(--bg) 52%, var(--bg) 100%);
	background-attachment: fixed;
	color: var(--fg);
	font: .72rem/1.38 var(--font-sans);
	overflow-wrap: anywhere;
}
header {
	position: sticky;
	top: 0;
	z-index: 10;
	background: color-mix(in oklab, var(--bg) 84%, transparent);
	backdrop-filter: blur(12px);
	-webkit-backdrop-filter: blur(12px);
	border-bottom: 1px solid color-mix(in oklab, var(--brand-pink) 28%, var(--border));
}
.shell { max-inline-size: 86rem; margin-inline: auto; padding-inline: clamp(.85rem, 2.5vw, 1.5rem); }
main.shell { padding-block: .75rem 1.5rem; }
main > section[role="tabpanel"] { display: grid; gap: .85rem; }
.header-bar {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto minmax(min-content, 1fr);
	grid-template-areas: "heading tabs status";
	align-items: center;
	gap: .35rem .75rem;
	min-block-size: 2.5rem;
	padding-block: .35rem;
}
.heading { grid-area: heading; display: flex; align-items: center; gap: .65rem; min-inline-size: 0; }
.brand-mark {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-inline-size: 1.3rem;
	min-block-size: 1.25rem;
	padding-inline: .35rem;
	border-radius: 5px;
	font-weight: 700;
	font-size: .7rem;
	color: var(--brand-ink);
	background: linear-gradient(135deg var(--in-oklab), var(--brand-pink), var(--brand-cyan));
}
.header-status { grid-area: status; display: flex; justify-content: flex-end; align-items: center; gap: .65rem; }
#run-status { display: inline-flex; align-items: center; gap: .3rem; }
h1, h2, h3, p { margin: 0; }
h1, h2, h3, .brand-mark, .lane-label, .member-label { font-family: var(--font-display); }
h1 { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .86rem; font-weight: 700; letter-spacing: -.01em; }
h2 { font-size: .78rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; text-wrap: balance; color: var(--muted); }
h3 { font-size: .75rem; font-weight: 600; }
.muted { color: var(--muted); }
.row, .controls, .legend { display: flex; align-items: center; flex-wrap: wrap; gap: .35rem .6rem; }
.between { justify-content: space-between; }
.stack { display: grid; gap: .35rem; }
.region { margin-block: 0; }
.grid { display: grid; gap: .5rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); }
.card, .dense-list {
	background: color-mix(in oklab, var(--surface) 92%, transparent);
	border: 1px solid var(--border);
	border-radius: 10px;
	box-shadow: 0 1px 2px color-mix(in oklab, var(--bg) 35%, transparent);
}
.card { padding: .55rem .75rem; min-inline-size: 0; }
.card > * + * { margin-block-start: .3rem; }
.card.jumpable:hover { border-color: color-mix(in oklab, var(--border-strong) 55%, var(--border)); }
.member-grid { display: grid; gap: .55rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); }
.member-grid .card { block-size: 100%; }
.msg-head { padding-block-end: .3rem; border-block-end: 1px solid var(--border); }
.overview-summary { font-size: .74rem; line-height: 1.35; }
#milestone-items, #risk-items { padding-inline-start: 1.1rem; margin: 0; gap: .25rem; }
.dense-list { overflow: hidden; }
.dense-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(6rem, 9rem) 6rem;
	align-items: center;
	gap: .25rem .75rem;
	padding: .36rem .7rem;
}
.dense-row:not(:last-child) { border-bottom: 1px solid var(--border); }
.dense-row:hover { background: color-mix(in oklab, var(--surface-2) 65%, var(--surface)); }
#team .dense-row { grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) 6rem; }
.dense-copy h3 { display: inline; margin-inline-end: .45rem; }
.dense-row > .badge { justify-self: end; }
.dense-empty { padding: .5rem .7rem; }
.badge {
	display: inline-flex;
	align-items: center;
	gap: .4em;
	padding: .08rem .4rem;
	border-radius: 999px;
	color: var(--muted);
	font-size: .67rem;
	font-weight: 600;
	line-height: 1.3;
	white-space: nowrap;
	background: var(--surface-2);
	border: 1px solid var(--border);
}
.badge:where(
	[data-status="active"], [data-status="done"], [data-status="live"],
	[data-status="running"], [data-status="working"], [data-status="waiting"], [data-status="decision"],
	[data-status="blocked"], [data-status="stall"], [data-status="failure"], [data-status="stuck"], [data-status="error"]
) {
	background: color-mix(in oklab, currentColor 14%, var(--surface));
	border-color: color-mix(in oklab, currentColor 38%, transparent);
}
[data-status="active"], [data-status="done"], [data-status="live"] { color: var(--ok); }
[data-status="running"], [data-status="working"] { color: var(--info); }
[data-status="waiting"], [data-status="decision"] { color: var(--warn); }
[data-status="blocked"], [data-status="stall"], [data-status="failure"],
[data-status="stuck"], [data-status="error"] { color: var(--err); }
button, input, select { font: inherit; color: inherit; }
button, select, input[type="search"] {
	background: var(--surface-2);
	border: 1px solid var(--border-strong);
	border-radius: 6px;
	min-block-size: 1.5rem;
	min-inline-size: 1.5rem;
	padding: .12rem .45rem;
	font-size: .72rem;
	transition: border-color 140ms ease, background-color 140ms ease;
}
input[type="search"] { inline-size: min(100%, 26rem); }
input[type="search"]::placeholder { color: var(--muted); opacity: 1; }
button:not(:disabled), summary, select { cursor: pointer; }
button:where(:not(:disabled)):hover {
	border-color: var(--accent);
	background: color-mix(in oklab, var(--accent) 12%, var(--surface-2));
}
button:disabled, input:disabled { color: var(--muted); }
button:disabled { background: var(--surface-2); border-color: var(--border); }
:focus-visible, .jumpable:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
.jumpable { scroll-margin-block: .75rem; }
button[aria-pressed="true"] {
	background: color-mix(in oklab, var(--accent) 16%, var(--surface-2));
	border-color: var(--accent);
	color: var(--fg);
	text-decoration: underline;
	text-underline-offset: .2em;
}
#tabs {
	grid-area: tabs;
	display: flex;
	gap: 3px;
	padding: 3px;
	background: color-mix(in oklab, var(--bg) 75%, var(--surface));
	border: 1px solid color-mix(in oklab, var(--brand-cyan) 20%, var(--border));
	border-radius: 9px;
}
[role="tab"] {
	min-block-size: 1.45rem;
	padding: .12rem .5rem;
	border-color: transparent;
	border-radius: 6px;
	background: transparent;
	color: var(--muted);
	font-size: .72rem;
	font-weight: 500;
	transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
}
[role="tab"][aria-selected="true"] {
	background: var(--surface-2);
	color: var(--fg);
	border: 1px solid color-mix(in oklab, var(--brand-cyan) 42%, var(--border-strong));
	box-shadow: 0 1px 2px color-mix(in oklab, var(--bg) 50%, transparent);
}
.progress { display: flex; align-items: center; gap: .4rem; white-space: nowrap; }
progress {
	appearance: none;
	display: block;
	inline-size: 100%;
	min-inline-size: 0;
	block-size: .45rem;
	border: 1px solid color-mix(in oklab, var(--brand-cyan) 28%, var(--border-strong));
	border-radius: 999px;
	overflow: hidden;
	background: var(--surface-2);
	accent-color: var(--brand-cyan);
}
progress::-webkit-progress-bar { background: var(--surface-2); }
progress::-webkit-progress-value {
	background: linear-gradient(90deg var(--in-oklab), var(--brand-pink), var(--brand-cyan));
	border-radius: 999px;
}
progress::-moz-progress-bar {
	background: linear-gradient(90deg var(--in-oklab), var(--brand-pink), var(--brand-cyan));
	border-radius: 999px;
}
#header-progress progress { inline-size: clamp(2.25rem, 5vw, 4.5rem); }
input[type="range"] { accent-color: var(--accent); }
.mono, time, output { font-family: var(--font-mono); }
.md-inline { min-inline-size: 0; white-space: pre-wrap; }
.md { white-space: normal; }
.md > * { margin: 0; }
.md > * + * { margin-block-start: .35rem; }
.md-h { font-size: .74rem; font-weight: 700; }
.md-code { padding: .05em .25em; border-radius: 3px; background: var(--surface-2); }
.md-pre { padding: .35rem .5rem; }
.md-list { padding-inline-start: 1.25rem; }
.md-quote { padding-inline-start: .55rem; border-inline-start: 2px solid var(--border-strong); }
.md-hr { border: 0; border-block-start: 1px solid var(--border-strong); }
.md-link { color: var(--accent); text-decoration: underline; text-underline-offset: .15em; }
.table-wrapper {
	max-inline-size: 100%;
	max-block-size: 18rem;
	overflow: auto;
	border: 1px solid var(--border);
	border-radius: 5px;
}
.md table { inline-size: 100%; border-spacing: 0; }
.md th, .md td {
	padding: .2rem .4rem;
	border-block-end: 1px solid var(--border);
	text-align: start;
	vertical-align: top;
}
.md thead th {
	position: sticky;
	inset-block-start: 0;
	z-index: 1;
	white-space: nowrap;
	background: var(--surface-2);
}
.md tbody tr:last-child td { border-block-end: 0; }
.count::before { content: " ("; }
.count::after { content: ")"; }
:is(ul, ol):where(.plain) { list-style: none; padding: 0; margin: 0; }
.reel-strip { display: flex; gap: .45rem; overflow-x: auto; padding: .25rem; }
.reel-strip figure { flex: 0 0 min(19rem, 90%); margin: 0; }
.reel-strip img { display: block; inline-size: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: var(--bg); border-radius: .4rem; }
.reel-strip figcaption > * + * { margin-block-start: .35rem; }
summary { font-weight: 650; min-block-size: 1.45rem; padding-block: .15rem; }
details[open] > summary { margin-block-end: .35rem; }
.page-footer { padding-block: 0 1rem; }
.status-key-disclosure summary { cursor: pointer; font-size: .7rem; width: fit-content; min-block-size: 1.35rem; padding-block: .15rem; }
.status-key-disclosure[open] > .row { margin-block-start: .6rem; }
pre { margin-block: .45rem 0; padding: .55rem; background: var(--dusk); border: 1px solid var(--border); border-radius: 8px; overflow: auto; }
.timeline { display: flex; align-items: center; flex-wrap: wrap; gap: .25rem .55rem; }
.timeline > .controls { gap: .25rem; }
.timeline > :first-child { margin-block-start: 0; }
.timeline > * + * { margin-block-start: 0; }
#scrub { flex: 1 1 8rem; min-inline-size: min(100%, 8rem); min-block-size: 1.9rem; margin: 0; }
#graph-views { flex-wrap: nowrap; gap: 2px; padding: 2px; background: var(--dusk); border: 1px solid var(--border); border-radius: 8px; }
#graph-views button:not([aria-pressed="true"], :hover) { border-color: transparent; background: transparent; color: var(--muted); }
.legend { margin-block-start: .55rem; color: var(--muted); }
.legend span { display: inline-flex; align-items: center; gap: .4rem; }
.line-key { inline-size: 1.65rem; border-top: 2px solid; }
.line-key.spawn { border-top-style: dashed; }
.line-key.wait { border-top-style: dotted; color: var(--warn); }
.line-key.peer { border: 0; block-size: 2px; color: color-mix(in oklab, var(--brand-cyan) 65%, var(--muted)); }
.line-key.peer path { stroke: currentColor; stroke-width: 2; }
.graph-workspace, .graph-side { display: grid; gap: .75rem; min-inline-size: 0; }
.graph-stage { position: relative; min-inline-size: 0; }
.graph-scroll {
	border: 1px solid color-mix(in oklab, var(--brand-cyan) 22%, var(--border));
	border-radius: 12px;
	background: var(--dusk);
	background: radial-gradient(circle at 50% 45%, color-mix(in oklab, var(--surface) 75%, var(--dusk)), var(--dusk) 78%);
	block-size: clamp(24rem, 62vh, 44rem);
	overflow: hidden;
	touch-action: none;
}
#graph-svg { display: block; inline-size: 100%; block-size: 100%; cursor: grab; user-select: none; }
#graph-svg.panning, #graph-svg.panning * { cursor: grabbing; }
.zoom-controls { position: absolute; inset-block-start: .5rem; inset-inline-end: .5rem; display: flex; gap: .25rem; }
.zoom-controls button { background: var(--surface); }
.constellation-ring, .tree-edge { fill: none; vector-effect: non-scaling-stroke; pointer-events: none; }
.constellation-ring { stroke: var(--border); stroke-width: 1; }
.tree-edge { stroke: var(--border-strong); stroke-width: 1; }
.lane-node, .member-node, .message-edge { cursor: pointer; }
.lane-star, .member-star, .star-glyph { color: var(--muted); }
:is(.lane-star, .member-star, .star-glyph):is([data-status="active"], [data-status="done"]) { color: var(--ok); }
:is(.lane-star, .member-star, .star-glyph):is([data-status="running"], [data-status="working"]) { color: var(--info); }
:is(.lane-star, .member-star, .star-glyph)[data-status="waiting"] { color: var(--warn); }
:is(.lane-star, .member-star, .star-glyph)[data-status="blocked"] { color: var(--err); }
.lane-star, .member-star {
	fill: var(--surface);
	fill: color-mix(in oklab, currentColor 14%, var(--surface));
	stroke: currentColor;
	stroke-width: 1.75px;
}
.star-glyph { fill: currentColor; font: 700 12px var(--font-sans); pointer-events: none; }
.lane-halo, .member-halo { fill: none; stroke-width: 1.75px; vector-effect: non-scaling-stroke; pointer-events: none; }
.member-halo[data-working="true"] { stroke: var(--info); stroke-dasharray: 2 3; }
.lane-node:is(:hover, :focus-visible, [aria-pressed="true"]) .lane-halo,
.member-node:is(:hover, :focus-visible, [aria-pressed="true"]) .member-halo { stroke: var(--accent); stroke-width: 2px; stroke-dasharray: none; }
.lane-node:focus-visible .lane-halo, .member-node:focus-visible .member-halo { stroke-dasharray: 4 2; }
:is(.lane-node, .member-node, .message-edge):is(:focus, :focus-visible) { outline: none; }
.lane-label, .member-label { fill: var(--fg); font-weight: 650; }
.lane-label { font-size: 12px; paint-order: stroke fill; stroke: var(--dusk); stroke-width: 4px; stroke-linejoin: round; }
.member-label { font-size: 11px; }
.member-desc { fill: var(--muted); font-size: 9.5px; }
.edge-line, .edge-hit { fill: none; }
.edge-line { stroke: var(--muted); stroke-width: 2; }
.edge-hit { stroke: transparent; stroke-width: 24; vector-effect: non-scaling-stroke; pointer-events: stroke; cursor: pointer; }
.message-edge > .edge-line { pointer-events: stroke; }
.message-edge > .edge-trunk { pointer-events: none; }
.edge-spawn .edge-line { stroke-dasharray: 8 5; }
.edge-peer .edge-line { stroke: color-mix(in oklab, var(--brand-cyan) 65%, var(--muted)); }
.edge-wait .edge-line { stroke: var(--warn); stroke-dasharray: 2 5; }
.message-edge:is(:hover, .pointer-hover, :focus-visible, [aria-pressed="true"]) .edge-line { stroke: var(--accent); stroke-width: 4; }
.message-edge:focus-visible .edge-line { stroke-width: 6; }
.trunk-highlights { pointer-events: none; }
.trunk-highlights .edge-line { stroke: var(--accent); stroke-width: 4; }
.trunk-highlights .edge-line[data-focus-visible="true"] { stroke-width: 6; }
.mention-list { max-block-size: 15rem; overflow: auto; padding: .25rem; }
.mention-list button { text-align: start; }
.lane-detail > * + * { margin-block-start: .45rem; }
.lane-member-row { display: grid; gap: .25rem; padding: .36rem .7rem; }
.lane-member-row:not(:last-child) { border-bottom: 1px solid var(--border); }
.lane-member-row:hover { background: color-mix(in oklab, var(--surface-2) 55%, transparent); }
.lane-member-link { font-weight: 650; }
.lane-member-last { align-items: baseline; }
.lane-member-last .message { flex: 1; }
.lane-close { font-size: 1rem; line-height: 1; }
@media (min-width: 60rem) {
	.graph-workspace { grid-template-columns: minmax(0, 1fr) 23rem; grid-template-rows: minmax(0, 1fr); }
	.graph-side { align-content: start; contain: size; overflow: auto; }
	body:has(> main > #panel-Graph:not([hidden])) { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-block-size: 100dvh; }
	main.shell:has(> #panel-Graph:not([hidden])) { display: grid; }
	#panel-Graph { grid-template-rows: auto minmax(0, 1fr); }
	.graph-stage { display: grid; grid-template-rows: minmax(24rem, 1fr) auto; }
	.graph-scroll { block-size: auto; contain: size; }
}
main.shell:has(> #panel-Graph:not([hidden])) { max-inline-size: none; margin-inline: 0; }
@media (max-width: 42rem) {
	:root { scroll-padding-block-start: 7rem; }
	.header-bar { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "heading status" "tabs tabs"; }
	#tabs > button { flex: 1; min-inline-size: 0; padding-inline: .35rem; }
	.dense-row, #team .dense-row { grid-template-columns: minmax(0, 1fr) auto; }
	.dense-row > .badge { grid-column: 2; grid-row: 1; }
	.dense-details { grid-column: 1 / -1; }
	.dense-details.progress { inline-size: min(100%, 9rem); }
}
@media (pointer: coarse) {
	button, select, input[type="search"], [role="tab"], summary, .status-key-disclosure summary, #scrub { min-block-size: 2.5rem; }
	button, select { min-inline-size: 2.5rem; }
	.edge-hit { stroke-width: 40; }
}
@media (prefers-reduced-motion: reduce) {
	*, *::before, *::after { transition: none !important; animation: none !important; }
}
@media (forced-colors: active) {
	:root { scrollbar-color: auto; }
	body { background-image: none; }
	.graph-scroll { background: Canvas; border-color: CanvasText; }
	.card, .dense-list, [role="tab"][aria-selected="true"] { box-shadow: none; }
	header { backdrop-filter: none; -webkit-backdrop-filter: none; background: Canvas; }
	.brand-mark { background: Canvas; color: CanvasText; border: 1px solid CanvasText; }
	.badge { background: Canvas; border: 1px solid CanvasText; }
	.md-link { color: LinkText; }
	.md-pre, .md-quote, .md-hr, .table-wrapper, .md th, .md td { border-color: CanvasText; }
	.md thead th { background: Canvas; }
	:focus-visible, .jumpable:focus { outline-color: Highlight; }
	[role="tab"][aria-selected="true"], button[aria-pressed="true"] { border-color: Highlight; }
	progress { appearance: auto; }
	progress::-webkit-progress-value { background: Highlight; }
	progress::-moz-progress-bar { background: Highlight; }
	.lane-star, .member-star { fill: Canvas; stroke: CanvasText; }
	.constellation-ring, .tree-edge { stroke: CanvasText; }
	.star-glyph, .lane-label, .member-label, .member-desc { fill: CanvasText; }
	.lane-label { stroke: Canvas; }
	.edge-line, .edge-wait .edge-line { stroke: CanvasText; }
	.edge-peer .edge-line, .line-key.peer path { stroke: CanvasText; stroke-dasharray: 7 3 2 3; }
	.marker-arrow { fill: CanvasText; }
	.member-halo[data-working="true"] { stroke: CanvasText; }
	.lane-node:is(:hover, :focus-visible, [aria-pressed="true"]) .lane-halo,
	.member-node:is(:hover, :focus-visible, [aria-pressed="true"]) .member-halo,
	.message-edge:is(:hover, .pointer-hover, :focus-visible, [aria-pressed="true"]) .edge-line,
	.trunk-highlights .edge-line { stroke: Highlight; }
}
</style>
</head>
<body>
<header>
	<div class="shell header-bar">
		<div class="heading">
			<span class="brand-mark" aria-hidden="true">S</span>
			<h1 id="goal-title">Swarm</h1>
		</div>
		<div id="tabs" role="tablist" aria-label="Swarm views">
			<button type="button" id="tab-Overview" role="tab" aria-controls="panel-Overview" aria-selected="true" data-tab="Overview">Overview</button>
			<button type="button" id="tab-Board" role="tab" aria-controls="panel-Board" aria-selected="false" data-tab="Board" tabindex="-1">Board<span id="board-count" class="count">0</span></button>
			<button type="button" id="tab-Members" role="tab" aria-controls="panel-Members" aria-selected="false" data-tab="Members" tabindex="-1">Members<span id="members-count" class="count">0</span></button>
			<button type="button" id="tab-Graph" role="tab" aria-controls="panel-Graph" aria-selected="false" data-tab="Graph" tabindex="-1">Graph</button>
		</div>
		<div class="header-status">
			<div id="header-progress"></div>
			<span id="run-status" class="muted" role="status">Connecting…</span>
		</div>
	</div>
</header>
<main class="shell">
	<section id="panel-Overview" role="tabpanel" aria-labelledby="tab-Overview" tabindex="0">
		<p id="overview-summary" class="overview-summary muted" hidden></p>
		<section id="attention" class="region stack" hidden>
			<h2>Needs attention</h2>
			<ol id="attention-items" class="plain grid" role="list"></ol>
		</section>
		<section class="region stack" aria-labelledby="threads-title">
			<h2 id="threads-title">Threads</h2>
			<ul id="threads" class="plain dense-list" role="list"></ul>
		</section>
		<section id="reel" class="region stack" hidden>
			<h2>Progress reel</h2>
			<div id="reel-items" class="reel-strip"></div>
		</section>
		<section id="milestones" class="region stack" hidden>
			<h2>Milestones &amp; Risks</h2>
			<div class="grid">
				<div id="milestone-group" class="card">
					<h3>Milestones</h3>
					<ul id="milestone-items" class="stack"></ul>
				</div>
				<div id="risk-group" class="card">
					<h3>Risks</h3>
					<ul id="risk-items" class="stack"></ul>
				</div>
			</div>
		</section>
		<section class="region stack" aria-labelledby="team-title">
			<h2 id="team-title">The team</h2>
			<ul id="team" class="plain dense-list" role="list"></ul>
		</section>
	</section>
	<section id="panel-Board" class="region stack" role="tabpanel" aria-labelledby="tab-Board" hidden>
		<div class="controls">
			<label for="board-search">Search messages</label>
			<input type="search" id="board-search" placeholder="Name, tag or message text">
		</div>
		<div id="filters" class="controls" role="group" aria-label="Message tags">
			<button type="button" data-tag="all" aria-pressed="true">All</button>
			<button type="button" data-tag="spawn" aria-pressed="false">Spawn</button>
			<button type="button" data-tag="done" aria-pressed="false">Done</button>
			<button type="button" data-tag="blocked" aria-pressed="false">Blocked</button>
			<button type="button" data-tag="owner-edit" aria-pressed="false">Owner edit</button>
			<button type="button" data-tag="stall" aria-pressed="false">Stall</button>
		</div>
		<div id="board"></div>
	</section>
	<section id="panel-Members" class="region stack" role="tabpanel" aria-labelledby="tab-Members" hidden>
		<div class="controls">
			<label for="member-search">Search members</label>
			<input type="search" id="member-search" placeholder="Name, role, model or status">
		</div>
		<div id="members"></div>
		<details id="retired" class="card">
			<summary id="retired-count">RETIRED 0</summary>
			<div id="retired-members"></div>
		</details>
	</section>
	<section id="panel-Graph" class="region stack" role="tabpanel" aria-labelledby="tab-Graph" hidden>
		<div class="card timeline">
			<div class="controls">
				<button type="button" id="first" aria-label="First message">|&lt;</button>
				<button type="button" id="previous" aria-label="Previous message">&lt;</button>
				<button type="button" id="play" aria-label="Play replay">▶</button>
				<button type="button" id="next" aria-label="Next message">&gt;</button>
				<button type="button" id="follow" aria-pressed="true">Live: on</button>
				<label for="speed">Speed</label>
				<select id="speed"><option value="1">1x</option><option value="2">2x</option><option value="4">4x</option><option value="8">8x</option></select>
			</div>
			<input id="scrub" type="range" min="1" max="1" value="1" aria-label="Replay position">
			<output id="playback-position" for="scrub" aria-live="off">No messages yet</output>
			<div id="graph-views" class="controls" role="group" aria-label="Graph view">
				<button type="button" data-view="Network" aria-pressed="true">Network</button>
				<button type="button" data-view="Mentions" aria-pressed="false">Mentions</button>
			</div>
		</div>
		<div class="graph-workspace">
			<div class="graph-stage">
				<div class="zoom-controls" role="group" aria-label="Constellation zoom">
					<button type="button" id="zoom-in" aria-label="Zoom in">+</button>
					<button type="button" id="zoom-out" aria-label="Zoom out">&minus;</button>
					<button type="button" id="zoom-fit" aria-label="Fit constellation to view">Fit</button>
				</div>
				<div class="graph-scroll" id="graph-scroll">
					<svg id="graph-svg" role="group" aria-label="Swarm constellation: select a lane, member, or directed arrow for details"></svg>
				</div>
				<div class="legend" role="group" aria-label="Graph legend">
					<span><i class="line-key" aria-hidden="true"></i>Message</span>
					<span><svg class="line-key peer" aria-hidden="true" viewBox="0 0 28 2"><path d="M0 1 H28"></path></svg>Peer message</span>
					<span><i class="line-key spawn" aria-hidden="true"></i>Spawn</span>
					<span><i class="line-key wait" aria-hidden="true"></i>Waiting for coordinator</span>
				</div>
			</div>
			<aside class="graph-side" aria-label="Graph details">
				<section class="card" aria-labelledby="detail-title">
					<h2 id="detail-title">Selected detail</h2>
					<div id="graph-detail">Select a lane, member, or message.</div>
				</section>
				<section id="mentions" class="card" aria-labelledby="mentions-title" hidden>
					<h2 id="mentions-title">Mentions</h2>
					<div id="mention-items" class="stack mention-list"></div>
				</section>
			</aside>
		</div>
	</section>
</main>
<footer class="shell page-footer">
	<details class="status-key-disclosure">
		<summary class="muted">Status key</summary>
		<div id="status-key" class="row" role="group" aria-label="Status key" data-status-key></div>
	</details>
</footer>
<noscript><p class="shell">JavaScript is required to read the local swarm state.</p></noscript>
<script>
'use strict';
const byId = id => document.getElementById(id);
const tabs = Array.from(byId('tabs').querySelectorAll('button'));
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });
const openedPayloads = new Set();
let snapshot;
let retainedSeqs = new Set();
let reelCards = [];
let tab = 'Overview';
let boardTag = 'all';
let connection = 'Connecting…';
let graphView = 'Network';
let cursor = 0;
let followLive = true;
let playing = false;
let playbackTimer;
let selection;

// Snapshot text is never parsed as HTML. Markdown uses only the elements defined below.
function node(tag, className, text) {
	const el = document.createElement(tag);
	if (className) el.className = className;
	if (text !== undefined) el.textContent = text;
	return el;
}

function renderInline(text) {
	// Use a hex escape for backticks inside the page's raw template literal.
	const tokens = /(?<!\x60)(\x60+)(?!\x60)([^\r\n]+?)(?<!\x60)\1(?!\x60)|\[([^[\]\r\n]+)\]\(|\\([\\\x60*_[\]~])|(\*+|_+|~+)/g;
	const fragment = document.createDocumentFragment();
	const parts = [{ content: fragment }];
	const current = () => parts.at(-1).content;
	const appendText = value => { if (value) current().append(document.createTextNode(value)); };
	const word = /[\p{L}\p{M}\p{N}_]/u;
	function finish() {
		const { marks, content } = parts.pop();
		appendText(marks);
		current().append(content);
	}

	let end = 0;
	for (let match; (match = tokens.exec(text)); ) {
		appendText(text.slice(end, match.index));
		end = tokens.lastIndex;
		const [, , code, linkLabel, escaped, marks] = match;
		if (code !== undefined) {
			current().append(node('code', 'md-code mono', code));
		} else if (linkLabel !== undefined) {
			const close = linkEnd(text, end);
			if (close === -1) {
				appendText(match[0]);
				continue;
			}
			const url = text.slice(end, close);
			end = tokens.lastIndex = close + 1;
			if (/^https?:\/\//i.test(url) && URL.canParse(url)) {
				const link = node('a', 'md-link');
				link.href = url;
				link.target = '_blank';
				link.rel = 'noopener noreferrer';
				link.append(renderInline(linkLabel));
				current().append(link);
			} else {
				appendText(text.slice(match.index, end));
			}
		} else if (escaped !== undefined) {
			appendText(escaped);
		} else {
			const marker = marks[0];
			if (marker === '~' ? marks.length !== 2 : marks.length > 3) {
				appendText(marks);
				continue;
			}
			const before = text[match.index - 1] ?? '';
			const after = text[end] ?? '';
			const canClose = before && !/\s/.test(before) && (marker !== '_' || !word.test(after));
			const canOpen = after && !/\s/.test(after) && (marker !== '_' || !word.test(before));
			let remaining = marks.length;
			// Code and links are already atomic, so their contents cannot close pending emphasis.
			while (canClose && remaining) {
				const opener = parts.findLastIndex(part => part.marks?.[0] === marker);
				if (opener === -1) break;
				while (parts.length - 1 > opener) finish();
				const part = parts[opener];
				// A triple run can open either strong or emphasis on the inside.
				const size = remaining >= 2 && part.marks.length >= 2 ? 2 : 1;
				const el = node(marker === '~' ? 'del' : size === 2 ? 'strong' : 'em');
				el.append(part.content);
				if (size === part.marks.length) parts.pop();
				else part.marks = part.marks.slice(size);
				current().append(el);
				remaining -= size;
			}
			if (canOpen && remaining) {
				parts.push({ marks: marker.repeat(remaining), content: document.createDocumentFragment() });
			} else if (remaining) {
				appendText(marker.repeat(remaining));
			}
		}
	}
	appendText(text.slice(end));
	while (parts.length > 1) finish();
	return fragment;
}
function linkEnd(text, start) {
	let depth = 0;
	for (let i = start; i < text.length && !/\s/.test(text[i]); i++) {
		if (text[i] === '(') depth++;
		else if (text[i] === ')') {
			if (depth === 0) return i;
			depth--;
		}
	}
	return -1;
}

const mdFence = /^ {0,3}(\x60{3,})[^\x60]*$/;
const mdFenceEnd = /^ {0,3}(\x60{3,})[ \t]*$/;
const mdHeading = /^ {0,3}(#{1,6})(?:[ \t]+(.*)|$)/;
const mdRule = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const mdList = /^ {0,3}(?:([-+*])|(\d{1,9})\.)[ \t]+(.*)$/;
const mdQuote = /^ {0,3}>[ \t]?(.*)$/;

function tableCells(line) {
	const text = line.trim();
	const cells = [];
	let start = 0;
	for (const { 0: token, index } of text.matchAll(/\\.|\||$/g)) {
		if (token.length > 1) continue;
		if (index > start || (token === '|' && index > 0)) {
			cells.push(text.slice(start, index).trim().replace(/\\\|/g, '|'));
		}
		start = index + 1;
	}
	return cells;
}
function tableAlignments(line) {
	if (!line?.includes('|') || !/^[ \t|:-]+$/.test(line)) return;
	const cells = tableCells(line);
	if (!cells.length || !cells.every(cell => /^:?-+:?$/.test(cell))) return;
	return cells.map(cell => {
		const left = cell.startsWith(':');
		if (cell.endsWith(':')) return left ? 'center' : 'right';
		return left ? 'left' : '';
	});
}
function appendTableRow(section, cells, alignments, tag) {
	const row = node('tr');
	for (const [index, align] of alignments.entries()) {
		const cell = node(tag);
		if (tag === 'th') cell.scope = 'col';
		if (align) cell.style.textAlign = align;
		cell.append(renderInline(cells[index] ?? ''));
		row.append(cell);
	}
	section.append(row);
}

function renderMarkdown(text) {
	const message = node('div', 'message md');
	const lines = text.split(/\r\n?|\n/);
	let paragraph;
	for (let i = 0; i < lines.length; ) {
		const line = lines[i++];
		if (!line.trim()) {
			paragraph = undefined;
			continue;
		}
		const fence = mdFence.exec(line);
		const heading = mdHeading.exec(line);
		const listItem = mdList.exec(line);
		const quoteLine = mdQuote.exec(line);
		const alignments = tableAlignments(lines[i]);
		const headers = alignments && tableCells(line);
		if (fence) {
			const start = i;
			while (i < lines.length && (mdFenceEnd.exec(lines[i])?.[1].length ?? 0) < fence[1].length) i++;
			const pre = node('pre', 'md-pre');
			pre.append(node('code', 'mono', lines.slice(start, i).join('\n')));
			message.append(pre);
			if (i < lines.length) i++;
		} else if (heading) {
			const title = node('h' + Math.max(4, heading[1].length), 'md-h');
			title.append(renderInline((heading[2] ?? '').replace(/(?:^|[ \t]+)#+[ \t]*$/, '')));
			message.append(title);
		} else if (mdRule.test(line)) {
			message.append(node('hr', 'md-hr'));
		} else if (listItem) {
			const ordered = listItem[2] !== undefined;
			const list = node(ordered ? 'ol' : 'ul', 'md-list');
			if (ordered) list.start = Number(listItem[2]);
			for (let item = listItem; item; ) {
				const li = node('li');
				li.append(renderInline(item[3]));
				list.append(li);
				const next = mdList.exec(lines[i] ?? '');
				if (!next || (next[2] !== undefined) !== ordered || mdRule.test(lines[i])) break;
				item = next;
				i++;
			}
			message.append(list);
		} else if (quoteLine) {
			const quote = node('blockquote', 'md-quote');
			quote.append(renderInline(quoteLine[1]));
			for (let next; (next = mdQuote.exec(lines[i] ?? '')); i++) {
				quote.append(node('br'), renderInline(next[1]));
			}
			message.append(quote);
		} else if (headers && headers.length === alignments.length) {
			const wrapper = node('div', 'table-wrapper');
			wrapper.tabIndex = 0;
			wrapper.setAttribute('role', 'region');
			wrapper.setAttribute('aria-label', 'Markdown table');
			const table = node('table');
			const head = node('thead');
			const body = node('tbody');
			appendTableRow(head, headers, alignments, 'th');
			for (i++; lines[i]?.trim(); i++) {
				const row = lines[i];
				if (mdFence.test(row) || mdHeading.test(row) || mdRule.test(row) || mdList.test(row) || mdQuote.test(row)) break;
				appendTableRow(body, tableCells(row), alignments, 'td');
			}
			table.append(head, body);
			wrapper.append(table);
			message.append(wrapper);
		} else {
			if (paragraph) paragraph.append(node('br'));
			else {
				paragraph = node('p');
				message.append(paragraph);
			}
			paragraph.append(renderInline(line));
			continue;
		}
		paragraph = undefined;
	}
	return message;
}

const muted = text => node('p', 'muted', text);
const label = status => status[0].toUpperCase() + status.slice(1).replaceAll('-', ' ');
const mention = name => name.startsWith('@') ? name : '@' + name;
const showTime = timestamp => {
	const el = node('time', 'muted', dateFormat.format(timestamp));
	el.dateTime = new Date(timestamp).toISOString();
	return el;
};
function statusGlyph(status) {
	switch (status) {
		case 'done': case 'active': case 'live': return '✓';
		case 'running': case 'working': return '●';
		case 'waiting': case 'decision': return '▲';
		case 'blocked': case 'stall': case 'failure': case 'stuck': case 'error': return '✕';
		default: return '○';
	}
}
function badge(status, text = label(status)) {
	const el = node('span', 'badge');
	const glyph = node('span', '', statusGlyph(status));
	glyph.setAttribute('aria-hidden', 'true');
	el.dataset.status = status;
	el.append(glyph, text);
	return el;
}
const statusKey = [
	['done', 'Done / active / live'],
	['working', 'Running / working'],
	['waiting', 'Decision / waiting'],
	['blocked', 'Error / failure / blocked / stalled / stuck'],
	['idle', 'Idle / retired'],
];
byId('status-key').append(...statusKey.map(([status, text]) => badge(status, text)));
function progress(value, total, name) {
	const group = node('div', 'progress');
	const count = node('span', 'mono', value + '/' + total);
	count.setAttribute('aria-hidden', 'true');
	const bar = node('progress');
	bar.max = total || 1;
	bar.value = value;
	bar.setAttribute('aria-label', name + ': ' + value + ' of ' + total + ' tasks done');
	group.append(count, bar);
	return group;
}
function actionButton(text, activate) {
	const button = node('button', '', text);
	button.type = 'button';
	button.addEventListener('click', activate);
	return button;
}
function messageJump(seq, text = '#' + seq, focusKey) {
	if (!retainedSeqs.has(seq)) return node('span', 'muted mono', '#' + seq + ' (not in Board)');
	const button = actionButton(text, () => jumpToMessage(seq));
	if (focusKey) button.dataset.key = focusKey;
	return button;
}
function memberCard(member, view) {
	const el = node('article', 'card');
	const title = node('div', 'row between');
	title.append(node('h3', '', mention(member.name)), badge(member.status));
	el.append(title, muted([member.role, member.model].filter(Boolean).join(' · ')));
	if (view === 'members') {
		el.id = 'member-' + member.id;
		el.classList.add('jumpable');
		el.tabIndex = -1;
	}
	if (member.description) el.append(node('p', '', member.description));
	if (view !== 'graph' && member.now) el.append(muted(member.now));
	if (member.lastSeq) {
		const lastMessage = node('div', 'message md-inline');
		lastMessage.append(renderInline(clip(member.lastMessage, 180)));
		if (view === 'members') {
			const last = node('div', 'row');
			last.append(messageJump(member.lastSeq), lastMessage);
			el.append(last);
		} else {
			lastMessage.prepend(document.createTextNode('#' + member.lastSeq + ' · '));
			el.append(lastMessage);
		}
	}
	return el;
}
function laneCard(lane, frame) {
	const card = node('article', 'card lane-detail');
	card.dataset.lane = lane.id;
	const header = node('div', 'row between');
	const title = node('div', 'row');
	title.append(node('h3', '', lane.title));
	if (lane.status) title.append(badge(lane.status));
	const controls = node('div', 'row');
	const close = actionButton('×', () => {
		pendingGraphFocusKey = 'lane:' + lane.id;
		selection = undefined;
		renderGraph();
	});
	close.className = 'lane-close';
	close.setAttribute('aria-label', 'Close lane details');
	close.dataset.key = 'close';
	const memberCount = lane.members.length;
	controls.append(lane.totalCount > 0 ? progress(lane.doneCount, lane.totalCount, lane.title)
		: node('span', 'muted', memberCount + (memberCount === 1 ? ' member' : ' members')), close);
	header.append(title, controls);
	card.append(header);

	const detail = [lane.summary, lane.now].filter(Boolean).join(' · ');
	if (detail) card.append(muted(detail));
	if (lane.attentionIds.length && frame.attention?.length) {
		const attention = node('div', 'lane-attention stack');
		for (const item of frame.attention) {
			if (!lane.attentionIds.includes(item.id)) continue;
			const entry = node('div', 'card');
			const heading = node('div', 'row');
			const severity = item.severity === 'med' ? 'Medium' : label(item.severity);
			heading.append(badge(item.kind, severity + ' · ' + label(item.kind)), node('strong', '', item.title));
			const why = node('div', 'message md-inline');
			why.append(renderInline(item.why));
			entry.append(heading, why);
			if (item.seq !== null) entry.append(messageJump(item.seq, 'Jump to #' + item.seq, 'jump:attention:' + item.id));
			attention.append(entry);
		}
		if (attention.childElementCount) card.append(attention);
	}

	const members = node('ul', 'plain dense-list lane-members');
	members.setAttribute('role', 'list');
	if (!lane.members.length) members.append(node('li', 'dense-empty muted', 'No members in this lane yet.'));
	for (const member of lane.members) {
		const row = node('li', 'lane-member-row');
		const top = node('div', 'row between');
		const identity = node('div', 'row');
		const memberKey = 'member:' + member.id;
		const link = actionButton(mention(member.name), () => {
			pendingGraphFocusKey = memberKey;
			selectGraph('member', member.id);
		});
		link.dataset.key = memberKey;
		link.className = 'lane-member-link';
		const description = [member.description !== member.name ? member.description : '', member.role, member.model]
			.filter(Boolean).join(' · ');
		identity.append(link, node('span', 'muted', description));
		top.append(identity, badge(member.status));
		row.append(top);
		if (member.lastSeq) {
			const last = node('div', 'row lane-member-last');
			const lastMessage = node('div', 'message md-inline');
			lastMessage.append(renderInline(clip(member.lastMessage, 180)));
			last.append(messageJump(member.lastSeq, undefined, 'jump:member:' + member.id), lastMessage);
			row.append(last);
		}
		members.append(row);
	}
	card.append(members);
	return card;
}
function renderAttention() {
	const list = byId('attention-items');
	byId('attention').hidden = snapshot.attention.length === 0;
	list.replaceChildren(...snapshot.attention.map(item => {
		const card = node('li', 'card');
		const severity = item.severity === 'med' ? 'Medium' : label(item.severity);
		const kind = badge(item.kind, severity + ' · ' + label(item.kind));
		const why = node('div', 'message md-inline');
		why.append(renderInline(item.why));
		card.append(kind, node('h3', '', item.title), why);
		const actions = node('div', 'row');
		if (item.seq !== null) actions.append(messageJump(item.seq, 'Jump to #' + item.seq));
		if (item.memberId !== null) {
			actions.append(actionButton('Inspect ' + mention(item.memberId), () => jumpToMember(item.memberId)));
		}
		if (actions.childElementCount) card.append(actions);
		return card;
	}));
}
function renderReel() {
	const strip = byId('reel-items');
	byId('reel').hidden = snapshot.reel.length === 0;
	const cards = snapshot.reel.map((frame, index) => {
		const previous = reelCards[index];
		const canJump = retainedSeqs.has(frame.seq);
		if (previous?.path === frame.path && previous.seq === frame.seq && previous.caption === frame.caption &&
			previous.timestamp === frame.timestamp && previous.canJump === canJump) return previous;
		const figure = node('figure', 'card');
		const image = node('img');
		image.loading = 'lazy';
		if (index > 0) image.fetchPriority = 'low';
		image.alt = frame.caption;
		image.src = '/api/reel/' + index;
		const caption = node('figcaption');
		caption.append(node('p', '', frame.caption), messageJump(frame.seq));
		figure.append(image, caption);
		if (previous) previous.figure.replaceWith(figure);
		else strip.append(figure);
		return { ...frame, canJump, figure };
	});
	for (let index = cards.length; index < reelCards.length; index++) reelCards[index].figure.remove();
	reelCards = cards;
}
function renderMilestones() {
	const { milestones, risks } = snapshot;
	byId('milestones').hidden = !milestones.length && !risks.length;
	for (const [name, entries] of [['milestone', milestones], ['risk', risks]]) {
		byId(name + '-group').hidden = entries.length === 0;
		byId(name + '-items').replaceChildren(...entries.map(entry => {
			const item = node('li');
			const text = node('span', '', mention(entry.memberId) + ': ');
			text.append(renderInline(entry.text.replace(/^#{1,6}\s+/, '')), document.createTextNode(' '));
			item.append(text, messageJump(entry.seq));
			return item;
		}));
	}
}
function renderOverview() {
	const overviewSummary = byId('overview-summary');
	const summary = [snapshot.goalSummary, snapshot.runningSummary === 'Idle' ? '' : snapshot.runningSummary].filter(Boolean).join(' · ');
	overviewSummary.textContent = summary;
	overviewSummary.hidden = !summary;
	renderAttention();
	byId('threads').replaceChildren(...(snapshot.threads.length ? snapshot.threads.map(thread => {
		const row = node('li', 'dense-row');
		const title = node('div', 'dense-copy');
		title.append(node('h3', '', thread.title));
		const detail = [thread.summary, thread.now];
		if (thread.attentionIds.length) detail.push('Needs attention (' + thread.attentionIds.length + ')');
		title.append(node('span', 'muted', detail.filter(Boolean).join(' · ')));
		const meter = progress(thread.doneCount, thread.totalCount, thread.title);
		meter.classList.add('dense-details');
		row.append(title, meter, badge(thread.status));
		return row;
	}) : [node('li', 'dense-empty muted', 'No threads yet.')]));
	const team = snapshot.members.filter(member => member.kind === 'main' || member.status !== 'retired');
	byId('team').replaceChildren(...(team.length ? team.map(member => {
		const row = node('li', 'dense-row');
		const title = node('div', 'dense-copy');
		title.append(node('h3', '', mention(member.name)), node('span', 'muted', [member.role, member.model].filter(Boolean).join(' · ')));
		row.append(title, node('div', 'dense-details muted', [member.description, member.now].filter(Boolean).join(' · ')), badge(member.status));
		return row;
	}) : [node('li', 'dense-empty muted', 'No members yet.')]));
	renderReel();
	renderMilestones();
}
function messageCard(message, inBoard) {
	const card = node('article', 'card');
	if (inBoard) {
		card.id = 'msg-' + message.seq;
		card.classList.add('jumpable');
		card.tabIndex = -1;
	}
	const head = node('div', inBoard ? 'row between msg-head' : 'row between');
	head.append(node('h3', 'mono', '#' + message.seq + ' · ' + mention(message.from) + ' → ' + mention(message.to)), badge(message.tag));
	card.append(head, showTime(message.timestamp), renderMarkdown(message.text));
	if (message.jsonPayload !== null) {
		const details = node('details');
		details.append(node('summary', '', 'JSON payload'), node('pre', 'mono', JSON.stringify(message.jsonPayload, null, 2)));
		if (inBoard) {
			details.open = openedPayloads.has(message.seq);
			details.addEventListener('toggle', () => {
				if (details.open) openedPayloads.add(message.seq);
				else openedPayloads.delete(message.seq);
			});
		}
		card.append(details);
	}
	return card;
}
function renderBoard() {
	const search = byId('board-search').value.trim().toLowerCase();
	const names = new Map(snapshot.members.map(member => [member.id, mention(member.name)]));
	const feed = node('ul', 'plain stack');
	for (const message of snapshot.messages) {
		if (boardTag !== 'all' && message.tag !== boardTag) continue;
		if (search && ![mention(message.from), mention(message.to), names.get(message.from), names.get(message.to), '#' + message.seq,
			label(message.tag), message.text].some(value => value?.toLowerCase().includes(search))) continue;
		const item = node('li');
		item.append(messageCard(message, true));
		feed.append(item);
	}
	byId('board').replaceChildren(feed.childElementCount ? feed : muted('No matching messages.'));
}
function renderMembers() {
	const search = byId('member-search').value.trim().toLowerCase();
	const active = node('ul', 'plain member-grid');
	const retired = node('ul', 'plain member-grid');
	active.setAttribute('role', 'list');
	retired.setAttribute('role', 'list');
	let retiredCount = 0;
	for (const member of snapshot.members) {
		if (member.status === 'retired') retiredCount++;
		if (search && ![member.id, mention(member.name), member.role, member.model, member.status, member.description, member.now, member.lastMessage]
			.some(value => value.toLowerCase().includes(search))) continue;
		const item = node('li');
		item.append(memberCard(member, 'members'));
		(member.status === 'retired' ? retired : active).append(item);
	}
	byId('members').replaceChildren(active.childElementCount ? active : muted('No matching active members.'));
	byId('retired-count').textContent = 'RETIRED ' + retiredCount;
	byId('retired-members').replaceChildren(retired.childElementCount ? retired : muted('No matching retired members.'));
}

function stopPlayback() {
	playing = false;
	clearTimeout(playbackTimer);
}
function seek(position) {
	const count = snapshot?.messages.length ?? 0;
	stopPlayback();
	followLive = false;
	cursor = count ? Math.min(count, Math.max(1, position)) : 0;
	selection = undefined;
	renderGraph();
}
function schedulePlayback() {
	clearTimeout(playbackTimer);
	if (!playing) return;
	const messages = snapshot.messages;
	if (cursor >= messages.length) {
		stopPlayback();
		return;
	}
	const gap = messages[cursor].timestamp - messages[cursor - 1].timestamp;
	const delay = Math.min(3000, Math.max(250, gap)) / Number(byId('speed').value);
	playbackTimer = setTimeout(() => {
		cursor++;
		selection = undefined;
		schedulePlayback();
		renderGraph();
	}, delay);
}
function renderPlayback(count) {
	const current = snapshot?.messages[cursor - 1];
	const scrub = byId('scrub');
	scrub.max = String(Math.max(1, count));
	scrub.value = String(cursor || 1);
	scrub.disabled = count === 0;
	byId('first').disabled = cursor <= 1;
	byId('previous').disabled = cursor <= 1;
	byId('next').disabled = cursor >= count;
	const play = byId('play');
	play.disabled = count < 2;
	play.textContent = playing ? '⏸' : '▶';
	play.setAttribute('aria-label', playing ? 'Pause replay' : 'Play replay');
	const follow = byId('follow');
	follow.disabled = count === 0;
	follow.setAttribute('aria-pressed', String(followLive));
	follow.textContent = followLive ? 'Live: on' : 'Live: off';
	const elapsed = current ? Math.max(0, (current.timestamp - snapshot.startedAt) / 1000) : 0;
	const position = current ? '#' + current.seq + ' of ' + count + ' · ' + timeFormat.format(current.timestamp) + ' (+' + elapsed.toFixed(1) + 's)' : 'No messages yet';
	byId('playback-position').textContent = position;
	scrub.setAttribute('aria-valuetext', position);
}

function replayFrame() {
	const messages = snapshot.messages.slice(0, cursor);
	const moment = messages.at(-1)?.timestamp ?? snapshot.startedAt;
	const known = new Map(snapshot.members.map(member => [member.id, member]));
	const spawned = new Set(snapshot.messages.filter(message => message.tag === 'spawn').map(message => message.to));
	const members = new Map();
	const results = new Map();
	const visibleThreads = new Set();
	function start(id, status, threadId) {
		const live = known.get(id);
		const member = { ...live, id, name: live?.name ?? id, role: live?.role ?? 'Worker', model: live?.model ?? '',
			kind: live?.kind ?? 'sub', status, threadId, lastSeq: 0, lastMessage: '' };
		members.set(id, member);
		return member;
	}
	for (const member of snapshot.members) {
		if (!spawned.has(member.id) && member.startedAt <= moment) {
			start(member.id, member.kind === 'main' ? 'active' : 'working', member.threadId);
		}
	}
	for (const message of messages) {
		if (message.tag === 'spawn') {
			start(message.to, 'working', message.threadId);
			results.delete(message.to);
			visibleThreads.add(message.threadId);
		}
		if (message.tag === 'done' || message.tag === 'blocked') {
			const member = members.get(message.from);
			if (member) {
				member.status = message.tag;
				results.set(member.id, message.tag);
			}
		}
		for (const id of [message.from, message.to]) {
			const member = members.get(id);
			if (member) {
				member.lastSeq = message.seq;
				member.lastMessage = message.text;
			}
		}
	}
	const counts = new Map();
	for (const member of members.values()) {
		const live = known.get(member.id);
		// No retirement event has a sequence number. On a timestamp tie, keep the message's status.
		if (live?.status === 'retired' && live.endedAt !== null && live.endedAt < moment) member.status = 'retired';
		if (!member.threadId) continue;
		let count = counts.get(member.threadId);
		if (!count) counts.set(member.threadId, count = { total: 0, done: 0, blocked: 0 });
		count.total++;
		if (results.get(member.id) === 'done') count.done++;
		if (results.get(member.id) === 'blocked') count.blocked++;
	}
	const threads = snapshot.threads.flatMap(thread => {
		const count = counts.get(thread.id);
		if (!visibleThreads.has(thread.id) && !count && !(thread.totalCount === 0 && thread.createdAt <= moment)) return [];
		const status = count?.blocked ? 'blocked' : count && count.done === count.total ? 'done' : 'running';
		const now = status === 'blocked' ? 'Blocked (' + count.blocked + ')'
			: status === 'done' ? 'Delivered ' + count.done + (count.done === 1 ? ' task' : ' tasks')
			: count ? (count.total - count.done - count.blocked) + ' working · ' + count.done + '/' + count.total + ' done'
			: '0/0 done';
		return [{ ...thread, status, doneCount: count?.done ?? 0, totalCount: count?.total ?? 0, now }];
	});
	let doneTasks = 0, totalTasks = 0;
	for (const { done, total } of counts.values()) {
		doneTasks += done;
		totalTasks += total;
	}
	return { messages, members: Array.from(members.values()), threads, goalSummary: snapshot.goalSummary,
		runningSummary: '', doneTasks, totalTasks, attention: [] };
}

const svgNS = 'http://www.w3.org/2000/svg';
function svg(tag, attributes, text) {
	const el = document.createElementNS(svgNS, tag);
	for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
	if (text !== undefined) el.textContent = text;
	return el;
}
function graphChoice(el, key, name, pressed, activate) {
	el.setAttribute('tabindex', '0');
	el.setAttribute('role', 'button');
	el.setAttribute('aria-label', name);
	el.setAttribute('aria-pressed', String(pressed));
	el.dataset.key = key;
	el.addEventListener('click', activate);
	el.addEventListener('keydown', event => {
		if (event.key === ' ') event.preventDefault();
		else if (event.key === 'Enter') activate();
	});
	el.addEventListener('keyup', event => {
		if (event.key === ' ') activate();
	});
}
const HUB_R = 26;
const COORD_R = 14;
const BRANCH_R = 15;
const MEMBER_R = 11;
const RING_1 = 132;
const MIN_ARC = 74;
const LABEL_MARGIN = 148;
const TAU = 2 * Math.PI;
const NORTH = -Math.PI / 2;
const SUB_REACH = 112;
const SUB_CONE = TAU / 3;
const LANE_LABEL_W = 190;
// Room beside a sub-tree for its outermost workers' 22-character labels.
const MEMBER_LABEL_W = 150;
function clip(text, length) {
	return text.length <= length ? text : Array.from(text).slice(0, length - 1).join('') + '…';
}
const GROUP_STATUS_ORDER = ['idle', 'done', 'working', 'waiting', 'blocked'];
function layoutConstellation(frame) {
	const people = new Map(frame.members.map(member => [member.id, member]));
	const coordinators = frame.members.filter(member => member.kind === 'main');
	if (!coordinators.length) {
		let id = frame.messages.find(message => message.tag === 'spawn')?.from;
		if (id === undefined) {
			id = 'coordinator';
			while (people.has(id)) id += '-';
		}
		const coordinator = people.get(id) ?? { id, name: id, role: 'Coordinator', status: 'idle' };
		coordinators.push(coordinator);
		people.set(id, coordinator);
	}
	const coordinator = coordinators[0].id;
	const center = { id: 'coordinator', threadId: null, title: 'Coordinator', summary: frame.goalSummary || '',
		status: undefined, doneCount: frame.doneTasks ?? 0, totalCount: frame.totalTasks ?? 0,
		now: frame.runningSummary && frame.runningSummary !== 'Idle' ? frame.runningSummary : '', attentionIds: [], members: coordinators };
	center.x = center.y = center.depth = 0;
	center.r = HUB_R;
	center.angle = NORTH;
	const workers = { id: 'workers', threadId: null, title: 'Unassigned workers', summary: '',
		status: undefined, doneCount: 0, totalCount: 0, now: '', attentionIds: [], members: [] };
	const outside = { id: 'outside', threadId: null, title: 'Other participants', summary: '',
		status: undefined, doneCount: 0, totalCount: 0, now: '', attentionIds: [], members: [] };
	const threads = new Map(frame.threads.map(thread => [thread.id, {
		id: 'thread:' + thread.id, threadId: thread.id, title: thread.title, summary: thread.summary, status: thread.status,
		doneCount: thread.doneCount ?? 0, totalCount: thread.totalCount ?? 0, now: thread.now || '',
		attentionIds: thread.attentionIds ?? [], members: [],
	}]));
	for (const member of frame.members) {
		if (member.kind !== 'main' && member.id !== coordinator) (threads.get(member.threadId) ?? workers).members.push(member);
	}
	for (const message of frame.messages) {
		for (const id of [message.from, message.to]) {
			if (people.has(id)) continue;
			const external = { id, name: id, role: 'Unregistered participant', status: 'unregistered' };
			outside.members.push(external);
			people.set(id, external);
		}
	}
	const lanes = [center, ...threads.values()];
	for (const group of [workers, outside]) {
		if (!group.members.length) continue;
		let priority = 0;
		for (const member of group.members) {
			priority = Math.max(priority, GROUP_STATUS_ORDER.indexOf(member.status));
			if (priority === GROUP_STATUS_ORDER.length - 1) break;
		}
		group.status = GROUP_STATUS_ORDER[priority];
		lanes.push(group);
	}
	const points = new Map();
	points.set(coordinator, { x: 0, y: 0, r: COORD_R, depth: 0, angle: NORTH });
	for (let i = 1; i < coordinators.length; i++) {
		const angle = NORTH + TAU * (i - 1) / (coordinators.length - 1);
		points.set(coordinators[i].id, { x: 46 * Math.cos(angle), y: 46 * Math.sin(angle), r: COORD_R, depth: 1, angle });
	}
	const branches = lanes.slice(1);
	let sumFootprint = 0;
	for (const branch of branches) {
		const n = branch.members.length;
		branch.reach = Math.max(SUB_REACH, n * MIN_ARC / SUB_CONE);
		branch.footprint = Math.max(LANE_LABEL_W, n > 1 ? 2 * branch.reach * Math.sin(SUB_CONE / 2 * (1 - 1 / n)) + MEMBER_LABEL_W : MEMBER_LABEL_W);
		sumFootprint += branch.footprint;
	}
	const ring1 = branches.length ? Math.max(RING_1, branches.length > 1 ? sumFootprint / TAU : 0) : 0;
	const treeEdges = [];
	const branchOf = new Map();
	let start = NORTH;
	for (const branch of branches) {
		const n = branch.members.length;
		if (branches.length === 1) {
			branch.angle = NORTH;
		} else {
			const span = TAU * branch.footprint / sumFootprint;
			branch.angle = start + span / 2;
			start += span;
		}
		const cos = Math.cos(branch.angle), sin = Math.sin(branch.angle);
		branch.x = ring1 * cos;
		branch.y = ring1 * sin;
		branch.r = BRANCH_R;
		branch.depth = 1;
		treeEdges.push('M 0 0 L ' + branch.x + ' ' + branch.y);
		for (let k = 0; k < n; k++) {
			const angle = branch.angle - SUB_CONE / 2 + (k + .5) * SUB_CONE / n;
			const x = branch.x + branch.reach * Math.cos(angle), y = branch.y + branch.reach * Math.sin(angle);
			points.set(branch.members[k].id, { x, y, r: MEMBER_R, depth: 2, angle });
			branchOf.set(branch.members[k].id, branch);
			treeEdges.push('M ' + branch.x + ' ' + branch.y + ' L ' + x + ' ' + y);
		}
	}

	// Count routes over the whole frame so a Mentions filter cannot change the paths.
	const pairs = new Map();
	const routes = new Map();
	function addRoute(fromId, toId) {
		const key = JSON.stringify([fromId, toId]);
		let pair = pairs.get(key);
		if (!pair) pairs.set(key, pair = { from: points.get(fromId), to: points.get(toId), count: 0 });
		return { pair, pairIndex: pair.count++ };
	}
	for (const message of frame.messages) {
		const wave = message.tag === 'spawn' && message.from === coordinator ? branchOf.get(message.to) : undefined;
		routes.set(message.seq, wave ? { tree: wave } : addRoute(message.from, message.to));
	}
	const waitRoutes = new Map();
	for (const member of people.values()) {
		if (member.status === 'waiting' && member.id !== coordinator) waitRoutes.set(member.id, addRoute(member.id, coordinator));
	}
	const outer = Math.max(HUB_R, ring1, ...[...points.values()].map(p => Math.hypot(p.x, p.y) + p.r)) + LABEL_MARGIN;
	return { lanes, branches, points, people, coordinator, ring1, treeEdges,
		bounds: { x: -outer, y: -outer, width: outer * 2, height: outer * 2 }, routes, waitRoutes };
}
function constellationEdgePath(from, to, pairIndex, pairCount) {
	// The hub is painted over the arrows, so use its visible rim for the member at its center.
	const radius = point => point.depth === 0 ? Math.max(point.r, HUB_R) : point.r;
	if (from === to) {
		const rim = radius(from) + 3;
		const reach = rim + 30 + Math.min(54, pairIndex * 9);
		const side = reach * .62;
		const cos = Math.cos(from.angle), sin = Math.sin(from.angle);
		const at = (out, across) => (from.x + cos * out - sin * across) + ' ' + (from.y + sin * out + cos * across);
		return 'M ' + at(rim * .8, -rim * .6) + ' C ' + at(reach, -side) + ' ' + at(reach, side) + ' ' + at(rim * .8, rim * .6);
	}
	const dx = to.x - from.x, dy = to.y - from.y;
	const dist = Math.hypot(dx, dy);
	const maxBend = Math.min(120, dist * .45);
	const bend = Math.max(-maxBend, Math.min(maxBend, (pairIndex - (pairCount - 1) / 2) * 26 + (pairCount === 1 ? 14 : 0)));
	const cx = (from.x + to.x) / 2 - dy * bend / dist;
	const cy = (from.y + to.y) / 2 + dx * bend / dist;
	// Clip each end along its tangent, so even strongly bent arrows clear the star.
	const rim = (point, offset) => {
		const vx = cx - point.x, vy = cy - point.y;
		const scale = (radius(point) + offset) / Math.hypot(vx, vy);
		return (point.x + vx * scale) + ' ' + (point.y + vy * scale);
	};
	return 'M ' + rim(from, 4) + ' Q ' + cx + ' ' + cy + ' ' + rim(to, 6);
}
function spawnTreePaths(hub, wave, to) {
	const dx = wave.x - hub.x, dy = wave.y - hub.y;
	const dist = Math.hypot(dx, dy);
	const ux = dx / dist, uy = dy / dist;
	const hubRim = Math.max(hub.r, HUB_R) + 4;
	const waveRim = wave.r + 4;
	// Offset the trunk so a spawn reads as a route beside the skeleton, not a restyled tree edge.
	const trunk = 'M ' + (hub.x + ux * hubRim - uy * 5) + ' ' + (hub.y + uy * hubRim + ux * 5)
		+ ' L ' + (wave.x - ux * waveRim - uy * 5) + ' ' + (wave.y - uy * waveRim + ux * 5);
	const bx = to.x - wave.x, by = to.y - wave.y;
	const reach = Math.hypot(bx, by);
	const vx = bx / reach, vy = by / reach;
	const memberRim = to.r + 6;
	const branch = 'M ' + (wave.x + vx * waveRim) + ' ' + (wave.y + vy * waveRim)
		+ ' L ' + (to.x - vx * memberRim) + ' ' + (to.y - vy * memberRim);
	return { trunk, branch };
}

let cam = { x: 0, y: 0, zoom: 1, manual: false };
let lastBounds = { x: -320, y: -320, width: 640, height: 640 };
let restoringGraphFocus = false;
function applyCamera(root, bounds) {
	const { clientWidth, clientHeight } = byId('graph-scroll');
	const aspect = clientWidth && clientHeight ? clientWidth / clientHeight : 800 / 540;
	const width = Math.max(bounds.width, bounds.height * aspect) / cam.zoom;
	const height = width / aspect;
	if (!cam.manual) {
		cam.x = bounds.x + bounds.width / 2;
		cam.y = bounds.y + bounds.height / 2;
	}
	root.setAttribute('viewBox', [cam.x - width / 2, cam.y - height / 2, width, height].join(' '));
}
function zoomBy(factor, anchor) {
	const zoom = Math.max(.4, Math.min(3.5, cam.zoom * factor));
	if (zoom === cam.zoom) return;
	if (anchor) {
		const ratio = cam.zoom / zoom;
		cam.x = anchor.x + (cam.x - anchor.x) * ratio;
		cam.y = anchor.y + (cam.y - anchor.y) * ratio;
	}
	cam.zoom = zoom;
	cam.manual = true;
	applyCamera(byId('graph-svg'), lastBounds);
}
function resetCamera() {
	cam = { x: 0, y: 0, zoom: 1, manual: false };
	applyCamera(byId('graph-svg'), lastBounds);
}
function wireGraphCamera(root) {
	let pan;
	let draggedPointerId;
	root.addEventListener('pointerdown', event => {
		if (!event.isPrimary || event.button !== 0) return;
		draggedPointerId = undefined;
		pan = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
	});
	root.addEventListener('pointermove', event => {
		if (pan?.id !== event.pointerId) return;
		const dx = event.clientX - pan.x, dy = event.clientY - pan.y;
		if (!pan.dragging) {
			if (Math.hypot(dx, dy) <= 4) return;
			// Capturing earlier would retarget ordinary star and edge clicks to the SVG.
			root.setPointerCapture(event.pointerId);
			pan.dragging = true;
			draggedPointerId = event.pointerId;
			root.classList.add('panning');
		}
		const scale = root.viewBox.baseVal.width / root.getBoundingClientRect().width;
		cam.x -= dx * scale;
		cam.y -= dy * scale;
		cam.manual = true;
		pan.x = event.clientX;
		pan.y = event.clientY;
		applyCamera(root, lastBounds);
	});
	function endPan(event) {
		if (pan?.id !== event.pointerId) return;
		pan = undefined;
		root.classList.remove('panning');
	}
	root.addEventListener('pointerup', endPan);
	root.addEventListener('pointercancel', endPan);
	root.addEventListener('lostpointercapture', event => { if (event.target === root) endPan(event); });
	root.addEventListener('pointerleave', event => { if (!pan?.dragging) endPan(event); });
	root.addEventListener('click', event => {
		if (draggedPointerId !== undefined && event.detail && (event.pointerId === undefined || event.pointerId === draggedPointerId)) {
			draggedPointerId = undefined;
			event.preventDefault();
			event.stopPropagation();
		}
	}, true);
	root.addEventListener('focusin', event => {
		if (!cam.manual || restoringGraphFocus) return;
		const shape = event.target.querySelector('.lane-star, .member-star, .edge-line');
		if (!shape) return;
		const point = shape.localName === 'circle'
			? { x: shape.cx.baseVal.value, y: shape.cy.baseVal.value }
			: shape.getPointAtLength(shape.getTotalLength() / 2);
		const box = root.viewBox.baseVal;
		if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) return;
		cam.x = point.x;
		cam.y = point.y;
		applyCamera(root, lastBounds);
	});
	root.addEventListener('wheel', event => {
		event.preventDefault();
		const matrix = root.getScreenCTM();
		const anchor = matrix && new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
		const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.clientHeight : 1;
		const delta = Math.max(-160, Math.min(160, event.deltaY * unit));
		zoomBy(Math.exp(-delta * .002), anchor);
	}, { passive: false });
}
const messageLabel = message => '#' + message.seq + ' · ' + label(message.tag) + ' · ' + mention(message.from) + ' → ' + mention(message.to);
let pendingGraphFocusKey;
function selectGraph(kind, id) {
	selection = { kind, id };
	renderGraph();
}
function outwardLabel(point) {
	const cos = Math.cos(point.angle);
	const offset = point.r + 9;
	return { x: point.x + cos * offset, y: point.y + Math.sin(point.angle) * offset,
		'text-anchor': cos > .25 ? 'start' : cos < -.25 ? 'end' : 'middle', 'dominant-baseline': 'central' };
}
function starGlyph(x, y, status) {
	return svg('text', { class: 'star-glyph', x, y, 'data-status': status,
		'text-anchor': 'middle', 'dominant-baseline': 'central', 'aria-hidden': 'true' }, statusGlyph(status));
}
function mentionScope(layout) {
	if (graphView !== 'Mentions') return;
	if (selection?.kind === 'member' && layout.people.has(selection.id)) return new Set([selection.id]);
	if (selection?.kind === 'lane') {
		const lane = layout.lanes.find(entry => entry.id === selection.id);
		if (lane) return new Set(lane.members.map(member => member.id));
	}
}
function drawConstellation(frame, layout, messages) {
	const { lanes, points, people, coordinator, ring1, treeEdges, bounds, routes, waitRoutes } = layout;
	const root = byId('graph-svg');
	const requestedKey = pendingGraphFocusKey;
	pendingGraphFocusKey = undefined;
	const oldKey = requestedKey ?? (root.contains(document.activeElement) ? document.activeElement.dataset.key : undefined);
	lastBounds = bounds;
	applyCamera(root, bounds);
	const defs = svg('defs', {});
	for (const [id, fill] of [['arrow', 'var(--muted)'], ['arrow-peer', 'color-mix(in oklab, var(--brand-cyan) 65%, var(--muted))']]) {
		const marker = svg('marker', { id, viewBox: '0 0 10 10', refX: 10, refY: 5,
			markerWidth: 10, markerHeight: 10, markerUnits: 'userSpaceOnUse', orient: 'auto' });
		marker.append(svg('path', { class: 'marker-arrow', d: 'M0 0 L10 5 L0 10 Z', fill }));
		defs.append(marker);
	}
	const rings = svg('g', { class: 'constellation-rings', 'aria-hidden': 'true' });
	if (ring1 > 0) rings.append(svg('circle', { class: 'constellation-ring', cx: 0, cy: 0, r: ring1 }));
	const tree = svg('g', { class: 'constellation-tree', 'aria-hidden': 'true' });
	for (const d of treeEdges) tree.append(svg('path', { class: 'tree-edge', d }));
	const regions = svg('g', {});
	// Put padded hit areas behind all visible strokes so a neighboring edge cannot mask a line.
	const edgeTargets = svg('g', { 'aria-hidden': 'true' });
	const arrows = svg('g', {});
	// Paint active trunks above overlapping arrows without changing the edges' Tab order.
	const trunkHighlights = svg('g', { class: 'trunk-highlights edge-spawn', 'aria-hidden': 'true' });
	const nodes = svg('g', {});
	let focusTarget;
	for (const lane of lanes) {
		const { x, y, r } = lane;
		const hub = lane.id === 'coordinator';
		const status = hub ? people.get(coordinator).status : lane.status;
		const count = lane.totalCount > 0 ? lane.doneCount + '/' + lane.totalCount : '';
		const text = [clip(lane.title, 22), count].filter(Boolean).join(' · ');
		const position = hub ? { x, y: HUB_R + 16, 'text-anchor': 'middle' } : outwardLabel(lane);
		if (!hub) {
			// Put the horizontal extent of the label along the wave orbit.
			const tangent = (lane.angle * 180 / Math.PI + 180) % 180 - 90;
			position['text-anchor'] = 'middle';
			position.transform = 'rotate(' + tangent + ' ' + position.x + ' ' + position.y + ')';
		}
		const region = svg('g', { class: 'lane-node' });
		region.append(
			svg('title', {}, lane.title),
			svg('circle', { class: 'lane-halo', cx: x, cy: y, r: r + 5 }),
			svg('circle', { class: hub ? 'lane-star lane-coord' : 'lane-star', cx: x, cy: y, r, 'data-status': status }));
		// The coordinator member supplies the hub's centered glyph.
		if (!hub) region.append(starGlyph(x, y, status));
		region.append(svg('text', { class: 'lane-label', ...position }, hub ? lane.title : text));
		const key = 'lane:' + lane.id;
		const memberCount = lane.members.length;
		const name = [hub ? lane.title : text, text.startsWith(lane.title) || hub ? '' : lane.title,
			label(status), memberCount + (memberCount === 1 ? ' member' : ' members')].filter(Boolean).join(' · ');
		graphChoice(region, key, name, selection?.kind === 'lane' && selection.id === lane.id, () => selectGraph('lane', lane.id));
		if (oldKey === key) focusTarget = region;
		regions.append(region);
	}
	for (const message of messages) {
		const route = routes.get(message.seq);
		let path, trunk;
		if (route.tree) {
			const treePaths = spawnTreePaths(points.get(coordinator), route.tree, points.get(message.to));
			trunk = treePaths.trunk;
			path = treePaths.branch;
		} else {
			const { pair: { from, to, count }, pairIndex } = route;
			path = constellationEdgePath(from, to, pairIndex, count);
		}
		const peer = message.from !== coordinator && message.to !== coordinator && message.from !== message.to && message.tag !== 'spawn';
		const edgeClass = message.tag === 'spawn' ? ' edge-spawn' : peer ? ' edge-peer' : '';
		const edge = svg('g', { class: 'message-edge' + edgeClass });
		const name = messageLabel(message);
		if (trunk) edge.append(svg('path', { class: 'edge-line edge-trunk', d: trunk }));
		edge.append(svg('path', { class: 'edge-line', d: path, 'marker-end': peer ? 'url(#arrow-peer)' : 'url(#arrow)' }),
			svg('title', {}, name));
		const key = 'message:' + message.seq;
		const pressed = selection ? selection.kind === 'message' && selection.id === message.seq : message.seq === frame.messages.at(-1)?.seq;
		graphChoice(edge, key, name, pressed, () => selectGraph('message', message.seq));
		let updateTrunkHighlight;
		if (trunk) {
			const highlight = svg('path', { class: 'edge-line edge-trunk', d: trunk });
			let hovered = false, focused = false, focusVisible = false;
			updateTrunkHighlight = () => {
				highlight.setAttribute('display', pressed || hovered || focused || edge.classList.contains('pointer-hover') ? 'inline' : 'none');
				highlight.setAttribute('data-focus-visible', String(focusVisible));
			};
			edge.addEventListener('pointerenter', () => {
				hovered = true;
				updateTrunkHighlight();
			});
			edge.addEventListener('pointerleave', () => {
				hovered = false;
				updateTrunkHighlight();
			});
			edge.addEventListener('focus', () => {
				focused = true;
				focusVisible = edge.matches(':focus-visible');
				updateTrunkHighlight();
			});
			edge.addEventListener('blur', () => {
				focused = focusVisible = false;
				updateTrunkHighlight();
			});
			updateTrunkHighlight();
			trunkHighlights.append(highlight);
		}
		const target = svg('path', { class: 'edge-hit', d: path });
		target.addEventListener('pointerenter', () => {
			edge.classList.add('pointer-hover');
			updateTrunkHighlight?.();
		});
		target.addEventListener('pointerleave', () => {
			edge.classList.remove('pointer-hover');
			updateTrunkHighlight?.();
		});
		target.addEventListener('click', () => {
			edge.focus({ preventScroll: true });
			selectGraph('message', message.seq);
		});
		edgeTargets.append(target);
		if (oldKey === key) focusTarget = edge;
		arrows.append(edge);
	}
	const scope = waitRoutes.size ? mentionScope(layout) : undefined;
	for (const [memberId, { pair: { from, to, count }, pairIndex }] of waitRoutes) {
		if (scope && !scope.has(memberId) && !scope.has(coordinator)) continue;
		const member = people.get(memberId);
		const wait = svg('g', { class: 'edge-wait' });
		wait.append(svg('title', {}, mention(member.name) + ' is waiting for the coordinator'),
			svg('path', { class: 'edge-line', d: constellationEdgePath(from, to, pairIndex, count), 'marker-end': 'url(#arrow)' }));
		arrows.append(wait);
	}
	for (const member of people.values()) {
		const point = points.get(member.id);
		const { x, y, r, depth } = point;
		const group = svg('g', { class: 'member-node' });
		const name = mention(member.name);
		const title = (depth ? clip(name, 22) : name) + ' · ' + label(member.status);
		const description = member.description !== member.name ? member.description : '';
		const halo = { class: 'member-halo', cx: x, cy: y, r: r + 5 };
		if (member.status === 'working') halo['data-working'] = 'true';
		group.append(svg('title', {}, [name + ' · ' + label(member.status), description].filter(Boolean).join(' · ')),
			svg('circle', halo),
			svg('circle', { class: 'member-star', cx: x, cy: y, r, 'data-status': member.status }),
			starGlyph(x, y, member.status));
		if (depth > 0) {
			const position = outwardLabel(point);
			if (description && position['text-anchor'] === 'middle' && y < 0) position.y -= 12;
			group.append(svg('text', { class: 'member-label', ...position }, clip(name, 22)));
			if (description) group.append(svg('text', { class: 'member-desc', ...position, y: position.y + 12 }, clip(description, 26)));
		}
		const key = 'member:' + member.id;
		graphChoice(group, key, title, selection?.kind === 'member' && selection.id === member.id, () => selectGraph('member', member.id));
		if (oldKey === key) focusTarget = group;
		nodes.append(group);
	}
	root.replaceChildren(defs, rings, tree, edgeTargets, arrows, trunkHighlights, regions, nodes);
	if (focusTarget) {
		// Restoring existing focus on a live redraw must not undo a manual pan.
		restoringGraphFocus = !requestedKey;
		focusTarget.focus({ preventScroll: !requestedKey });
		restoringGraphFocus = false;
	}
}
function renderGraph() {
	const count = snapshot?.messages.length ?? 0;
	renderPlayback(count);
	const frame = snapshot ? (followLive ? snapshot : replayFrame()) : { members: [], threads: [], messages: [] };
	const layout = layoutConstellation(frame);
	const member = selection?.kind === 'member' ? layout.people.get(selection.id) : undefined;
	const lane = selection?.kind === 'lane' ? layout.lanes.find(entry => entry.id === selection.id) : undefined;
	const scope = mentionScope(layout);
	const messages = scope ? frame.messages.filter(message => scope.has(message.from) || scope.has(message.to)) : frame.messages;
	drawConstellation(frame, layout, messages);
	const message = selection?.kind === 'message' ? frame.messages.find(entry => entry.seq === selection.id) : frame.messages.at(-1);
	const detail = byId('graph-detail');
	const active = document.activeElement;
	const detailKey = lane && detail.firstElementChild?.dataset.lane === lane.id && detail.contains(active)
		? active.dataset.key : undefined;
	const card = member ? memberCard(member, 'graph') : lane ? laneCard(lane, frame)
		: message ? messageCard(message, false) : muted('Select a lane, member, or message.');
	detail.replaceChildren(card);
	if (detailKey) {
		let focusTarget;
		for (const button of card.querySelectorAll('button[data-key]')) {
			if (button.dataset.key === detailKey) {
				focusTarget = button;
				break;
			}
		}
		if (focusTarget) focusTarget.focus({ preventScroll: true });
		else card.querySelector('.lane-close')?.focus();
	}
	byId('mentions').hidden = graphView !== 'Mentions';
	if (graphView === 'Mentions') {
		byId('mentions-title').textContent = member ? 'Mentions of ' + mention(member.name) : lane ? 'Mentions in ' + lane.title : 'Mentions';
		const items = byId('mention-items');
		const oldKey = items.contains(document.activeElement) ? document.activeElement.dataset.key : undefined;
		let focusTarget;
		items.replaceChildren();
		for (const entry of messages) {
			const button = node('button', '', messageLabel(entry));
			button.type = 'button';
			button.dataset.key = String(entry.seq);
			button.setAttribute('aria-pressed', String(!member && !lane && message?.seq === entry.seq));
			button.addEventListener('click', () => selectGraph('message', entry.seq));
			if (button.dataset.key === oldKey) focusTarget = button;
			items.append(button);
		}
		if (!messages.length) items.append(muted('No mentions at this position.'));
		focusTarget?.focus({ preventScroll: true });
	}
}

const views = { Overview: renderOverview, Board: renderBoard, Members: renderMembers, Graph: renderGraph };
function renderTab() {
	if (!snapshot && tab !== 'Graph') return;
	const active = document.activeElement;
	const jumpId = active?.classList.contains('jumpable') ? active.id : '';
	views[tab]();
	const target = jumpId && byId(jumpId);
	if (target && target !== active) target.focus({ preventScroll: true });
}
function activateTab(next) {
	if (next === tab) return;
	stopPlayback();
	tab = next;
	for (const button of tabs) {
		const selected = button.dataset.tab === tab;
		button.tabIndex = selected ? 0 : -1;
		button.setAttribute('aria-selected', String(selected));
		byId('panel-' + button.dataset.tab).hidden = !selected;
	}
	renderTab();
}
function revealJump(target) {
	target?.focus({ preventScroll: true });
	target?.scrollIntoView({ block: 'start' });
}
function jumpToMessage(seq) {
	if (!retainedSeqs.has(seq)) return;
	activateTab('Board');
	const id = 'msg-' + seq;
	let target = byId(id);
	if (!target) {
		byId('board-search').value = '';
		selectBoardTag('all');
		target = byId(id);
	}
	revealJump(target);
}
function jumpToMember(memberId) {
	activateTab('Members');
	const id = 'member-' + memberId;
	let target = byId(id);
	const search = byId('member-search');
	if (!target && search.value) {
		search.value = '';
		renderMembers();
		target = byId(id);
	}
	const retired = target?.closest('details');
	if (retired) retired.open = true;
	revealJump(target);
}
for (const [index, button] of tabs.entries()) {
	button.addEventListener('click', () => activateTab(button.dataset.tab));
	button.addEventListener('keydown', event => {
		let next;
		if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
		else if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = tabs.length - 1;
		else return;
		event.preventDefault();
		activateTab(tabs[next].dataset.tab);
		tabs[next].focus();
	});
}
function choose(groupId, key, onSelect) {
	const buttons = Array.from(byId(groupId).querySelectorAll('button'));
	function select(value) {
		for (const option of buttons) option.setAttribute('aria-pressed', String(option.dataset[key] === value));
		onSelect(value);
	}
	for (const button of buttons) button.addEventListener('click', () => select(button.dataset[key]));
	return select;
}
const selectBoardTag = choose('filters', 'tag', tag => { boardTag = tag; renderTab(); });
choose('graph-views', 'view', view => { graphView = view; renderGraph(); });
byId('board-search').addEventListener('input', renderTab);
byId('member-search').addEventListener('input', renderTab);
byId('scrub').addEventListener('input', event => seek(event.target.valueAsNumber));
byId('first').addEventListener('click', () => seek(1));
byId('previous').addEventListener('click', () => seek(cursor - 1));
byId('next').addEventListener('click', () => seek(cursor + 1));
byId('speed').addEventListener('change', schedulePlayback);
byId('follow').addEventListener('click', () => {
	if (!followLive) cursor = snapshot.messages.length;
	followLive = !followLive;
	stopPlayback();
	selection = undefined;
	renderGraph();
});
byId('play').addEventListener('click', () => {
	if (playing) stopPlayback();
	else {
		followLive = false;
		if (cursor >= snapshot.messages.length) cursor = 1;
		selection = undefined;
		playing = true;
		schedulePlayback();
	}
	renderGraph();
});
const graphRoot = byId('graph-svg');
wireGraphCamera(graphRoot);
byId('zoom-in').addEventListener('click', () => zoomBy(1.25));
byId('zoom-out').addEventListener('click', () => zoomBy(1 / 1.25));
byId('zoom-fit').addEventListener('click', resetCamera);
window.addEventListener('resize', () => { if (tab === 'Graph') applyCamera(graphRoot, lastBounds); });

function renderConnection() {
	const status = byId('run-status');
	if (!snapshot) {
		status.textContent = connection || 'Connecting…';
		return;
	}
	status.replaceChildren(badge(snapshot.live ? 'live' : 'idle'));
	if (connection) status.append(node('small', 'muted', '· ' + connection));
}
function applySnapshot(next) {
	const count = next.messages.length;
	if (snapshot && (next.startedAt !== snapshot.startedAt || count < snapshot.messages.length)) {
		stopPlayback();
		followLive = true;
		selection = undefined;
		openedPayloads.clear();
		resetCamera();
	}
	snapshot = next;
	retainedSeqs = new Set(next.messages.map(message => message.seq));
	if (followLive || cursor === 0) cursor = count;
	const title = byId('goal-title');
	title.title = title.textContent = next.goalTitle || 'Swarm';
	byId('header-progress').replaceChildren(progress(next.doneTasks, next.totalTasks, 'Overall progress'));
	byId('board-count').textContent = String(count);
	byId('members-count').textContent = String(next.members.filter(member => member.status !== 'retired').length);
	renderConnection();
	renderTab();
}
const events = new EventSource('/api/events');
function receive(event) {
	connection = '';
	applySnapshot(JSON.parse(event.data));
}
events.addEventListener('snapshot', receive);
events.addEventListener('update', receive);
events.addEventListener('error', () => { connection = '○ Reconnecting'; renderConnection(); });
fetch('/api/state').then(response => {
	if (!response.ok) throw new Error('State unavailable');
	return response.json();
}).then(next => {
	// A fast SSE snapshot or update wins over the concurrent, one-shot fetch.
	if (!snapshot) applySnapshot(next);
}).catch(() => { if (!snapshot) { connection = '○ State unavailable'; renderConnection(); } });
</script>
</body>
</html>`;
}
