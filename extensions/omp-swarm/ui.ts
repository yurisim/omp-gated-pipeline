export function renderSwarmHtml(): string {
	return String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<link rel="icon" href="data:,">
<title>Swarm | omp</title>
<style>
:root {
	color-scheme: dark;
	--bg: #0d1117;
	--surface: #161b22;
	--border: #30363d;
	--fg: #e6edf3;
	--muted: #8b949e;
	--ok: #3fb950;
	--info: #58a6ff;
	--warn: #d29922;
	--err: #f85149;
	--accent: #d2a8ff;
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 1rem/1.55 system-ui, sans-serif; overflow-wrap: anywhere; }
header { background: var(--surface); border-bottom: 1px solid var(--border); }
.shell { max-inline-size: 80rem; margin-inline: auto; padding-inline: clamp(1rem, 4vw, 2.5rem); }
.heading { padding-block: 1.5rem 1rem; }
h1, h2, h3, p { margin: 0; }
h1 { font-size: clamp(1.5rem, 4vw, 2.25rem); line-height: 1.2; }
h2 { font-size: 1.25rem; }
h3 { font-size: 1.05rem; }
.eyebrow, .muted { color: var(--muted); }
.eyebrow { font: 700 .78rem/1.5 ui-monospace, monospace; letter-spacing: .13em; text-transform: uppercase; }
.row, .controls, .legend { display: flex; align-items: center; flex-wrap: wrap; gap: .55rem .8rem; }
.between { justify-content: space-between; }
.stack { display: grid; gap: .85rem; }
.region { margin-block: 1.4rem; }
.grid { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: .65rem; padding: 1rem; min-inline-size: 0; }
.card > * + * { margin-block-start: .45rem; }
.badge { display: inline-flex; align-items: center; gap: .4em; color: var(--muted); font-weight: 650; }
[data-status="active"], [data-status="done"], [data-status="live"] { color: var(--ok); }
[data-status="running"], [data-status="working"] { color: var(--info); }
[data-status="waiting"], [data-attention-kind="decision"] { color: var(--warn); }
[data-status="blocked"], [data-status="stall"],
[data-attention-kind="failure"], [data-attention-kind="stuck"], [data-attention-kind="error"] { color: var(--err); }
button, input, select { font: inherit; color: inherit; }
button, select, input[type="search"] { background: var(--surface); border: 1px solid var(--muted); border-radius: .4rem; min-block-size: 2.5rem; padding: .3rem .65rem; }
input[type="search"] { inline-size: min(100%, 26rem); }
input[type="search"]::placeholder { color: var(--muted); opacity: 1; }
button:not(:disabled), summary, select { cursor: pointer; }
button:not(:disabled):hover { border-color: var(--accent); }
button:disabled, input:disabled { opacity: .55; }
:focus-visible, .jumpable:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
.jumpable { scroll-margin-block: .75rem; }
button[aria-pressed="true"] { box-shadow: inset 0 0 0 1px currentColor; text-decoration: underline; text-underline-offset: .2em; }
[role="tablist"] { display: flex; overflow-x: auto; gap: .5rem; padding: .25rem; }
[role="tab"] { position: relative; flex: none; border-color: transparent; padding-inline: 1rem; }
[role="tab"][aria-selected="true"] { color: var(--accent); }
[role="tab"][aria-selected="true"]::after { content: ""; position: absolute; inset: auto .4rem 0; border-bottom: 3px solid currentColor; }
progress { display: block; inline-size: 100%; block-size: .7rem; }
progress { accent-color: var(--fg); }
input[type="range"] { accent-color: var(--accent); }
.mono, time, output { font-family: ui-monospace, Consolas, monospace; }
.message { white-space: pre-wrap; }
.count::before { content: " ("; }
.count::after { content: ")"; }
:is(ul, ol):where(.plain) { list-style: none; padding: 0; margin: 0; }
.reel-strip { display: flex; gap: .75rem; overflow-x: auto; padding: .3rem; }
.reel-strip figure { flex: 0 0 min(19rem, 90%); margin: 0; }
.reel-strip img { display: block; inline-size: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: var(--bg); border-radius: .4rem; }
.reel-strip figcaption > * + * { margin-block-start: .45rem; }
summary { font-weight: 650; }
details[open] > summary { margin-block-end: .65rem; }
pre { margin-block: .65rem 0; padding: .75rem; background: var(--bg); border: 1px solid var(--border); border-radius: .4rem; overflow: auto; }
.timeline { display: grid; gap: .55rem; }
#scrub { inline-size: 100%; margin: 0; }
.legend { margin-block: .65rem; color: var(--muted); }
.legend span { display: inline-flex; align-items: center; gap: .4rem; }
.line-key { inline-size: 1.65rem; border-top: 2px solid; }
.line-key.spawn { border-top-style: dashed; }
.line-key.wait { border-top-style: dotted; color: var(--warn); }
.hive-scroll { border: 1px solid var(--border); border-radius: .55rem; overflow: auto; max-block-size: min(70vh, 50rem); }
#hive-svg { display: block; max-inline-size: none; }
.cell, .member-node rect { fill: var(--surface); stroke: var(--border); stroke-width: 2; }
.cell-label, .member-label { fill: var(--fg); font-weight: 650; }
.cell-label { font-size: 17px; }
.cell-status, .member-status { fill: currentColor; font-size: 13px; }
.cell-status:not([data-status]), .member-status:not([data-status]), [data-status="retired"] { color: var(--muted); }
.member-node rect { fill: var(--bg); stroke: var(--muted); }
.member-node, .message-edge { cursor: pointer; }
.member-node:focus-visible rect, .member-node[aria-pressed="true"] rect { stroke: var(--accent); stroke-width: 4; }
.member-node:focus-visible, .message-edge:focus-visible { outline: none; }
.edge-line, .edge-hit { fill: none; }
.edge-line { stroke: var(--muted); stroke-width: 2; }
.edge-hit { stroke: transparent; stroke-width: 12; pointer-events: stroke; }
.edge-spawn .edge-line { stroke-dasharray: 8 5; }
.edge-wait .edge-line { stroke: var(--warn); stroke-dasharray: 2 5; }
.message-edge:is(:hover, :focus-visible, [aria-pressed="true"]) .edge-line { stroke: var(--accent); stroke-width: 4; }
.mention-list { max-block-size: 15rem; overflow: auto; padding: .25rem; }
.mention-list button { text-align: start; }
@media (forced-colors: active) {
	.jumpable:focus { outline-color: Highlight; }
	.cell, .member-node rect { fill: Canvas; stroke: CanvasText; }
	.cell-label, .member-label, .cell-status, .member-status { fill: CanvasText; }
	.edge-line, .edge-spawn .edge-line, .edge-wait .edge-line { stroke: CanvasText; }
	.marker-arrow { fill: CanvasText; }
	.member-node:focus-visible rect, .member-node[aria-pressed="true"] rect,
	.message-edge:is(:hover, :focus-visible, [aria-pressed="true"]) .edge-line { stroke: Highlight; }
}
</style>
</head>
<body>
<header>
	<div class="shell">
		<div class="heading stack">
			<p class="eyebrow">omp / swarm</p>
			<div class="row between">
				<h1 id="goal-title">Swarm</h1>
				<span id="run-status" class="badge" role="status">Connecting…</span>
			</div>
		</div>
		<div id="tabs" role="tablist" aria-label="Swarm views">
			<button type="button" id="tab-Overview" role="tab" aria-selected="true" data-tab="Overview">Overview</button>
			<button type="button" id="tab-Board" role="tab" aria-selected="false" data-tab="Board" tabindex="-1">Board<span id="board-count" class="count">0</span></button>
			<button type="button" id="tab-Members" role="tab" aria-selected="false" data-tab="Members" tabindex="-1">Members<span id="members-count" class="count">0</span></button>
			<button type="button" id="tab-Graph" role="tab" aria-selected="false" data-tab="Graph" tabindex="-1">Graph</button>
		</div>
	</div>
</header>
<main class="shell">
	<section id="panel-Overview" role="tabpanel" aria-labelledby="tab-Overview" tabindex="0">
		<div id="goal-card" class="card region" aria-label="Goal and overall progress">Waiting for swarm state…</div>
		<div class="legend" role="group" aria-label="Status key">
			<span class="badge" data-status="done">Done / active / live</span>
			<span class="badge" data-status="working">Running / working</span>
			<span class="badge" data-status="waiting">Decision / waiting</span>
			<span class="badge" data-status="blocked">Error / failure / blocked / stalled</span>
		</div>
		<section id="attention" class="region stack" hidden>
			<h2>Needs attention</h2>
			<ol id="attention-items" class="plain grid" role="list"></ol>
		</section>
		<section class="region stack" aria-labelledby="threads-title">
			<h2 id="threads-title">Threads</h2>
			<div id="threads" class="grid"></div>
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
			<div id="team" class="grid"></div>
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
		<div class="legend" role="group" aria-label="Message status key">
			<span class="badge" data-status="done">Done</span>
			<span class="badge" data-status="blocked">Blocked / stalled</span>
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
			<div class="row between">
				<output id="playback-position" for="scrub" aria-live="off">No messages yet</output>
				<div id="graph-views" class="controls" role="group" aria-label="Graph view">
					<button type="button" data-view="Hive" aria-pressed="true">Hive</button>
					<button type="button" data-view="Mentions" aria-pressed="false">Mentions</button>
				</div>
			</div>
		</div>
		<div class="hive-scroll" id="hive-scroll">
			<svg id="hive-svg" role="group" aria-label="Swarm hive: select a member or a directed arrow for details"></svg>
		</div>
		<div class="legend" aria-label="Graph legend">
			<span><i class="line-key" aria-hidden="true"></i>Message</span>
			<span><i class="line-key spawn" aria-hidden="true"></i>Spawn</span>
			<span><i class="line-key wait" aria-hidden="true"></i>Waiting for coordinator</span>
		</div>
		<section class="card" aria-labelledby="detail-title">
			<h2 id="detail-title">Selected detail</h2>
			<div id="graph-detail">Select a member or message.</div>
		</section>
		<section id="mentions" class="card" aria-labelledby="mentions-title" hidden>
			<h2 id="mentions-title">Mentions</h2>
			<div id="mention-items" class="stack mention-list"></div>
		</section>
	</section>
</main>
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
let graphView = 'Hive';
let cursor = 0;
let followLive = true;
let playing = false;
let playbackTimer;
let selection;
let centered = false;

// Snapshot fields only enter the DOM as literal text or inert metadata, never parsed markup.
function node(tag, className, text) {
	const el = document.createElement(tag);
	if (className) el.className = className;
	if (text !== undefined) el.textContent = text;
	return el;
}
const muted = text => node('p', 'muted', text);
const label = status => status[0].toUpperCase() + status.slice(1).replaceAll('-', ' ');
const mention = name => name.startsWith('@') ? name : '@' + name;
const showTime = timestamp => {
	const el = node('time', 'muted', dateFormat.format(timestamp));
	el.dateTime = new Date(timestamp).toISOString();
	return el;
};
function badge(status) {
	const el = node('span', 'badge');
	const dot = node('span', '', status === 'retired' || status === 'idle' ? '○' : '●');
	dot.setAttribute('aria-hidden', 'true');
	el.dataset.status = status;
	el.append(dot, label(status));
	return el;
}
function progress(value, total, text) {
	const group = node('div', 'stack');
	const bar = node('progress');
	bar.max = total || 1;
	bar.value = value;
	bar.setAttribute('aria-label', text);
	group.append(node('p', 'mono', text), bar);
	return group;
}
function actionButton(text, activate) {
	const button = node('button', '', text);
	button.type = 'button';
	button.addEventListener('click', activate);
	return button;
}
function messageJump(seq, text = '#' + seq) {
	return retainedSeqs.has(seq) ? actionButton(text, () => jumpToMessage(seq))
		: node('span', 'muted mono', '#' + seq + ' (not in Board)');
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
	if (view !== 'graph') {
		if (member.description) el.append(node('p', '', member.description));
		if (member.now) el.append(muted(member.now));
	}
	if (view !== 'team' && member.lastSeq) {
		const text = clip(member.lastMessage, 180);
		if (view === 'members') {
			const last = node('div', 'row');
			last.append(messageJump(member.lastSeq), node('p', 'message', text));
			el.append(last);
		} else {
			el.append(node('p', 'message', '#' + member.lastSeq + ' · ' + text));
		}
	}
	return el;
}
function renderAttention() {
	const list = byId('attention-items');
	byId('attention').hidden = snapshot.attention.length === 0;
	list.replaceChildren(...snapshot.attention.map(item => {
		const card = node('li', 'card');
		const severity = item.severity === 'med' ? 'Medium' : label(item.severity);
		const kind = node('span', 'badge', severity + ' · ' + label(item.kind));
		kind.dataset.attentionKind = item.kind;
		card.append(kind, node('h3', '', item.title), node('p', 'message', item.why));
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
			item.append(node('span', '', mention(entry.memberId) + ': ' + entry.text + ' '), messageJump(entry.seq));
			return item;
		}));
	}
}
function renderOverview() {
	const goal = byId('goal-card');
	goal.replaceChildren(node('h2', '', 'Goal'), node('p', '', snapshot.goalTitle || 'No goal set yet.'));
	if (snapshot.goalSummary) goal.append(node('p', 'message', snapshot.goalSummary));
	if (snapshot.runningSummary) goal.append(node('p', '', snapshot.runningSummary));
	goal.append(progress(snapshot.doneTasks, snapshot.totalTasks, snapshot.doneTasks + ' of ' + snapshot.totalTasks + ' tasks done'));
	renderAttention();
	byId('threads').replaceChildren(...(snapshot.threads.length ? snapshot.threads.map(thread => {
		const card = node('article', 'card');
		const title = node('div', 'row between');
		title.append(node('h3', '', thread.title), badge(thread.status));
		card.append(title);
		if (thread.summary) card.append(node('p', 'message', thread.summary));
		card.append(muted(thread.now));
		if (thread.attentionIds.length) card.append(node('span', 'badge', 'Needs attention (' + thread.attentionIds.length + ')'));
		card.append(progress(thread.doneCount, thread.totalCount, thread.doneCount + '/' + thread.totalCount + ' done'));
		return card;
	}) : [muted('No threads yet.')]));
	const team = snapshot.members.filter(member => member.kind === 'main' || member.status !== 'retired');
	byId('team').replaceChildren(...(team.length ? team.map(member => memberCard(member, 'team')) : [muted('No members yet.')]));
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
	const head = node('div', 'row between');
	head.append(node('h3', 'mono', '#' + message.seq + ' · ' + mention(message.from) + ' → ' + mention(message.to)), badge(message.tag));
	card.append(head, showTime(message.timestamp), node('p', 'message', message.text));
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
	const active = node('ul', 'plain stack');
	const retired = node('ul', 'plain stack');
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
		return [{ ...thread, status: count?.blocked ? 'blocked' : count && count.done === count.total ? 'done' : 'running' }];
	});
	return { messages, members: Array.from(members.values()), threads };
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
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		activate();
	});
}
const ROOT3 = Math.sqrt(3);
const NODE_W = 126;
const NODE_H = 46;
const COLUMN_W = NODE_W + 10;
const ROW_H = NODE_H + 10;
function* hexSlots() {
	yield [0, 0];
	for (let ring = 1; ; ring++) {
		let q = ring, r = 0;
		for (const [dq, dr] of [[-1, 1], [-1, 0], [0, -1], [1, -1], [1, 0], [0, 1]]) {
			for (let step = 0; step < ring; step++) {
				yield [q, r];
				q += dq;
				r += dr;
			}
		}
	}
}
function clip(text, length) {
	return text.length <= length ? text : Array.from(text).slice(0, length - 1).join('') + '…';
}
function layoutHive(frame) {
	const people = new Map(frame.members.map(member => [member.id, member]));
	const coordinators = frame.members.filter(member => member.kind === 'main');
	if (!coordinators.length) {
		const id = frame.messages.find(message => message.tag === 'spawn')?.from ?? 'coordinator';
		const coordinator = { id, name: id, role: 'Coordinator', status: 'idle' };
		coordinators.push(coordinator);
		people.set(id, coordinator);
	}
	const center = { title: 'Coordinator', members: coordinators };
	const workers = { title: 'Unassigned workers', members: [] };
	const outside = { title: 'Other participants', members: [] };
	const threads = new Map(frame.threads.map(thread => [thread.id, { title: thread.title, status: thread.status, members: [] }]));
	for (const member of frame.members) {
		if (member.kind !== 'main') (threads.get(member.threadId) ?? workers).members.push(member);
	}
	for (const message of frame.messages) {
		for (const id of [message.from, message.to]) {
			if (people.has(id)) continue;
			const external = { id, name: id, role: 'Unregistered participant', status: 'unregistered' };
			outside.members.push(external);
			people.set(id, external);
		}
	}
	const cells = [center, ...threads.values()];
	if (workers.members.length) cells.push(workers);
	if (outside.members.length) cells.push(outside);
	let radius = 129;
	for (const cell of cells) {
		cell.columns = Math.max(1, Math.ceil(Math.sqrt(cell.members.length / 4)));
		cell.rows = Math.ceil(cell.members.length / cell.columns);
		const halfWidth = cell.columns * COLUMN_W / 2;
		const halfHeight = cell.rows * ROW_H / 2;
		radius = Math.max(radius, halfHeight + 92, halfHeight + 39 + halfWidth / ROOT3, halfWidth * 2 / ROOT3 + 20);
	}
	const slots = hexSlots();
	const points = new Map();
	let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
	for (const cell of cells) {
		const [q, r] = slots.next().value;
		cell.x = ROOT3 * (radius + 6) * (q + r / 2);
		cell.y = 1.5 * (radius + 6) * r;
		xMin = Math.min(xMin, cell.x - ROOT3 * radius / 2 - 16);
		xMax = Math.max(xMax, cell.x + ROOT3 * radius / 2 + 16);
		yMin = Math.min(yMin, cell.y - radius - 16);
		yMax = Math.max(yMax, cell.y + radius + 16);
		cell.members.forEach((member, index) => {
			const row = Math.floor(index / cell.columns);
			const width = Math.min(cell.columns, cell.members.length - row * cell.columns);
			const x = cell.x + (index % cell.columns - (width - 1) / 2) * COLUMN_W;
			const y = cell.y + 23 + (row - (cell.rows - 1) / 2) * ROW_H;
			points.set(member.id, { x, y });
		});
	}
	return { cells, points, people, radius, coordinator: coordinators[0].id, xMin, xMax, yMin, yMax };
}
function edgePath(from, to, bend) {
	if (from === to) {
		const side = from.x + NODE_W / 2;
		return 'M ' + side + ' ' + (from.y - 12) + ' C ' + (side + bend + 16) + ' ' + (from.y - 48) + ' ' +
			(side + bend + 16) + ' ' + (from.y + 48) + ' ' + side + ' ' + (from.y + 12);
	}
	const dx = to.x - from.x, dy = to.y - from.y;
	const distance = Math.hypot(dx, dy);
	const control = { x: (from.x + to.x) / 2 - bend * dy / distance, y: (from.y + to.y) / 2 + bend * dx / distance };
	function boundary(point) {
		const x = control.x - point.x, y = control.y - point.y;
		const scale = 1 / Math.max(Math.abs(x) / (NODE_W / 2 + 2), Math.abs(y) / (NODE_H / 2 + 2));
		return (point.x + x * scale) + ' ' + (point.y + y * scale);
	}
	return 'M ' + boundary(from) + ' Q ' + control.x + ' ' + control.y + ' ' + boundary(to);
}
const messageLabel = message => '#' + message.seq + ' · ' + label(message.tag) + ' · ' + mention(message.from) + ' → ' + mention(message.to);
function selectGraph(kind, id) {
	selection = { kind, id };
	renderGraph();
}
function drawHive(frame, layout, messages) {
	const { cells, points, people, radius, coordinator, xMin, xMax, yMin, yMax } = layout;
	const root = byId('hive-svg');
	const oldKey = root.contains(document.activeElement) ? document.activeElement.dataset.key : undefined;
	const width = xMax - xMin, height = yMax - yMin;
	const scale = Math.max(.78, Math.min(1.25, (byId('hive-scroll').clientWidth || width) / width));
	root.setAttribute('viewBox', [xMin, yMin, width, height].join(' '));
	root.setAttribute('width', Math.ceil(width * scale));
	root.setAttribute('height', Math.ceil(height * scale));
	const marker = svg('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 10, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' });
	marker.append(svg('path', { class: 'marker-arrow', d: 'M0 0 L10 5 L0 10 Z', fill: 'var(--muted)' }));
	const defs = svg('defs', {});
	defs.append(marker);
	const regions = svg('g', {});
	const arrows = svg('g', {});
	const nodes = svg('g', {});
	let focusTarget;
	for (const cell of cells) {
		const vertices = Array.from({ length: 6 }, (_, i) => {
			const angle = (i * 60 - 90) * Math.PI / 180;
			return (cell.x + radius * Math.cos(angle)) + ',' + (cell.y + radius * Math.sin(angle));
		});
		const region = svg('g', { 'aria-label': cell.title });
		region.append(svg('polygon', { class: 'cell', points: vertices.join(' ') }),
			svg('text', { x: cell.x, y: cell.y - radius + 53, class: 'cell-label', 'text-anchor': 'middle' }, clip(cell.title, 21)));
		region.append(svg('title', {}, cell.title));
		if (cell.status) region.append(svg('text', { x: cell.x, y: cell.y - radius + 72, class: 'cell-status',
			'text-anchor': 'middle', 'data-status': cell.status }, '● ' + label(cell.status)));
		regions.append(region);
	}
	const parallels = new Map();
	for (const message of messages) {
		const pair = JSON.stringify([message.from, message.to]);
		const index = parallels.get(pair) ?? 0;
		parallels.set(pair, index + 1);
		const path = edgePath(points.get(message.from), points.get(message.to), 15 + 75 * index / (index + 4));
		const edge = svg('g', { class: 'message-edge' + (message.tag === 'spawn' ? ' edge-spawn' : '') });
		edge.append(svg('path', { class: 'edge-line', d: path, 'marker-end': 'url(#arrow)' }),
			svg('path', { class: 'edge-hit', d: path }), svg('title', {}, messageLabel(message)));
		const key = 'message:' + message.seq;
		const pressed = selection ? selection.kind === 'message' && selection.id === message.seq : message.seq === frame.messages.at(-1)?.seq;
		graphChoice(edge, key, messageLabel(message), pressed, () => selectGraph('message', message.seq));
		if (oldKey === key) focusTarget = edge;
		arrows.append(edge);
	}
	for (const member of people.values()) {
		if (member.status !== 'waiting' || member.id === coordinator) continue;
		const wait = svg('g', { class: 'edge-wait' });
		wait.append(svg('title', {}, mention(member.name) + ' is waiting for the coordinator'),
			svg('path', { class: 'edge-line', d: edgePath(points.get(member.id), points.get(coordinator), -25), 'marker-end': 'url(#arrow)' }));
		arrows.append(wait);
	}
	for (const member of people.values()) {
		const { x, y } = points.get(member.id);
		const group = svg('g', { class: 'member-node' });
		const name = mention(member.name);
		const status = label(member.status);
		group.append(svg('rect', { x: x - NODE_W / 2, y: y - NODE_H / 2, width: NODE_W, height: NODE_H, rx: 8 }),
			svg('text', { x, y: y - 3, class: 'member-label', 'text-anchor': 'middle' }, clip(name, 13)),
			svg('text', { x, y: y + 15, class: 'member-status', 'data-status': member.status, 'text-anchor': 'middle' }, '● ' + status),
			svg('title', {}, name + ' · ' + status));
		const key = 'member:' + member.id;
		graphChoice(group, key, name + ' · ' + status, selection?.kind === 'member' && selection.id === member.id, () => selectGraph('member', member.id));
		if (oldKey === key) focusTarget = group;
		nodes.append(group);
	}
	root.replaceChildren(defs, regions, arrows, nodes);
	focusTarget?.focus({ preventScroll: true });
	if (!centered && !byId('panel-Graph').hidden) {
		const scroller = byId('hive-scroll');
		scroller.scrollLeft = -xMin * scale - scroller.clientWidth / 2;
		scroller.scrollTop = -yMin * scale - scroller.clientHeight / 2;
		centered = true;
	}
}
function renderGraph() {
	const count = snapshot?.messages.length ?? 0;
	renderPlayback(count);
	const frame = snapshot ? (followLive ? snapshot : replayFrame()) : { members: [], threads: [], messages: [] };
	const layout = layoutHive(frame);
	const member = selection?.kind === 'member' ? layout.people.get(selection.id) : undefined;
	const messages = graphView === 'Mentions' && member ? frame.messages.filter(message => message.from === member.id || message.to === member.id) : frame.messages;
	drawHive(frame, layout, messages);
	const message = selection?.kind === 'message' ? frame.messages.find(entry => entry.seq === selection.id) : frame.messages.at(-1);
	byId('graph-detail').replaceChildren(member ? memberCard(member, 'graph') : message ? messageCard(message, false) : muted('Select a member or message.'));
	byId('mentions').hidden = graphView !== 'Mentions';
	if (graphView === 'Mentions') {
		byId('mentions-title').textContent = member ? 'Mentions of ' + mention(member.name) : 'Mentions';
		const items = byId('mention-items');
		const oldKey = items.contains(document.activeElement) ? document.activeElement.dataset.key : undefined;
		let focusTarget;
		items.replaceChildren();
		for (const entry of messages) {
			const button = node('button', '', messageLabel(entry));
			button.type = 'button';
			button.dataset.key = String(entry.seq);
			button.setAttribute('aria-pressed', String(!member && message?.seq === entry.seq));
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
window.addEventListener('resize', () => { if (tab === 'Graph') renderGraph(); });

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
		centered = false;
	}
	snapshot = next;
	retainedSeqs = new Set(next.messages.map(message => message.seq));
	if (followLive || cursor === 0) cursor = count;
	byId('goal-title').textContent = next.goalTitle || 'Swarm';
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
