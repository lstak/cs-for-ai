/* Shared runtime: navigation, progress tracking, quiz, tiny DOM helpers. No dependencies. */
const MODULES = [
  { id: 'm1', file: 'm1-bits.html',        title: 'Bits, bytes & numbers',      blurb: 'How everything becomes 0s and 1s, and why floats are weird.' },
  { id: 'm2', file: 'm2-memory.html',      title: 'Memory & storage',           blurb: 'Registers to disk: the hierarchy that explains most slowness.' },
  { id: 'm3', file: 'm3-cpu-gpu.html',     title: 'CPU vs GPU',                 blurb: 'Why AI runs on GPUs, and when it should not.' },
  { id: 'm4', file: 'm4-os.html',          title: 'The operating system',       blurb: 'Processes, scheduling, virtual memory, and OOM kills.' },
  { id: 'm5', file: 'm5-software.html',    title: 'From code to hardware',      blurb: 'What really happens when Python runs a line.' },
  { id: 'm6', file: 'm6-networking.html',  title: 'Networking',                 blurb: 'Packets, DNS, TCP, HTTP, and why latency matters.' },
  { id: 'm7', file: 'm7-web.html',         title: 'How the Web works',          blurb: 'HTTP, HTML/CSS/JS, servers, rendering, REST APIs and WebSockets.' },
  { id: 'm8', file: 'm8-data.html',        title: 'Data: storage & manipulation', blurb: 'CSV, JSON, Parquet, SQL, Postgres and NoSQL, and when to use which.' },
  { id: 'm9', file: 'm9-peripherals.html', title: 'Peripherals & I/O',          blurb: 'Interrupts, buses, and getting sensor data in.' },
  { id: 'm10', file: 'm10-ai-request.html',  title: 'Life of an AI request',      blurb: 'Capstone: follow one chat message through every layer.' },
  { id: 'm11', file: 'm11-ai-magic.html',    title: 'How AI "magic" works',       blurb: 'Tokens, next-word prediction, embeddings, and what training really is.' },
  { id: 'm12', file: 'm12-cloud.html',      title: 'The cloud',                  blurb: 'Renting computers: VMs, storage, regions, API vs. your own GPU, and costs.' },
  { id: 'm13', file: 'm13-agents.html',     title: 'AI agents, tools & MCP',     blurb: 'The agentic loop, what tools are, and how MCP plugs them in.' },
];

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) { if (k == null || k === false) continue; e.append(k.nodeType ? k : document.createTextNode(k)); }
  return e;
}
const SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, ...kids) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
  for (const k of kids.flat()) { if (k == null) continue; e.append(k.nodeType ? k : document.createTextNode(k)); }
  return e;
}

/** Human-readable duration from seconds. */
function fmtTime(t) {
  const u = (v, d) => v.toFixed(v < 10 ? d : 0);
  if (t < 1e-6) return u(t * 1e9, 1) + ' ns';
  if (t < 1e-3) return u(t * 1e6, 1) + ' µs';
  if (t < 1)    return u(t * 1e3, 1) + ' ms';
  if (t < 60)   return u(t, 1) + ' s';
  if (t < 3600) return u(t / 60, 1) + ' min';
  if (t < 86400) return u(t / 3600, 1) + ' hours';
  if (t < 86400 * 365) return u(t / 86400, 1) + ' days';
  return u(t / (86400 * 365), 1) + ' years';
}
function fmtBytes(b) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; while (b >= 1000 && i < units.length - 1) { b /= 1000; i++; }
  return (b < 10 ? b.toFixed(1) : b.toFixed(0)) + ' ' + units[i];
}

/** Labelled range slider. Returns {el, get, set}. */
function slider(label, min, max, step, value, onInput, fmt = v => v) {
  const out = h('b', {}, fmt(value));
  const input = h('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => { out.textContent = fmt(+input.value); onInput(+input.value); });
  return { el: h('label', { class: 'ctl' }, h('span', {}, label + ': ', out), input), get: () => +input.value,
           set: v => { input.value = v; out.textContent = fmt(v); } };
}

/** Horizontal bar rows. rows: [{label,value(0..1),text,cls}] */
function renderBars(el, rows) {
  el.innerHTML = '';
  for (const r of rows) {
    el.append(h('div', { class: 'barrow' },
      h('span', { class: 'lbl' }, r.label),
      h('div', { class: 'track' }, h('div', { class: 'fill ' + (r.cls || ''), style: { width: Math.max(0.5, Math.min(100, r.value * 100)) + '%' } })),
      h('span', { class: 'val' }, r.text)));
  }
}

const Progress = {
  key: 'cs4ai-progress-v3',
  get() { try { return JSON.parse(localStorage.getItem(this.key)) || {}; } catch { return {}; } },
  set(id, v) { const p = this.get(); p[id] = v; try { localStorage.setItem(this.key, JSON.stringify(p)); } catch {} },
  done(id) { return !!this.get()[id]; },
};

/** Multiple-choice quiz. items: [{q, options:[...], answer:index, why}] */
const Quiz = {
  mount(sel, items) {
    const root = typeof sel === 'string' ? $(sel) : sel;
    root.classList.add('quiz');
    root.append(h('h2', {}, 'Check your understanding'));
    const correct = new Set();
    items.forEach((it, qi) => {
      const why = h('div', { class: 'why', hidden: true }, it.why);
      const opts = it.options.map((o, oi) => {
        const b = h('button', { class: 'opt' }, o);
        b.addEventListener('click', () => {
          if (b.classList.contains('right')) return;
          if (oi === it.answer) { b.classList.add('right'); correct.add(qi); why.hidden = false;
            if (correct.size === items.length) { Progress.set(document.body.dataset.module, true); Layout.refresh(); } }
          else { b.classList.add('wrong'); }
        });
        return b;
      });
      root.append(h('div', { class: 'q' }, h('b', {}, `${qi + 1}. ${it.q}`), h('div', { class: 'opts' }, opts), why));
    });
    root.append(h('p', { class: 'lead' }, 'Answer all correctly to mark this module complete.'));
  },
};

const Layout = {
  init() {
    const id = document.body.dataset.module;
    const main = $('main');
    const side = h('nav', { id: 'side' });
    const wrap = h('div', { id: 'layout' });
    main.replaceWith(wrap); wrap.append(side, main);
    document.body.append(h('button', { id: 'menu', onclick: () => side.classList.toggle('open') }, '☰ Modules'));
    this.side = side; this.id = id;
    if (id) this.pager(main);
    $$('pre').forEach(pre => {
      const b = h('button', { class: 'copy' }, 'copy');
      b.onclick = () => { navigator.clipboard?.writeText(pre.innerText.replace(/\ncopy$|^copy\n?/g, '')); b.textContent = 'copied'; setTimeout(() => b.textContent = 'copy', 1200); };
      pre.append(b);
    });
    this.refresh();
  },
  refresh() {
    const side = this.side, p = Progress.get();
    const n = MODULES.filter(m => p[m.id]).length;
    side.innerHTML = '';
    side.append(
      h('a', { class: 'brand', href: 'index.html' }, 'How Computers Work'),
      h('div', { class: 'sub' }, `A crash course for AI practitioners · ${n}/${MODULES.length} done`),
      h('div', { class: 'bar' }, h('i', { style: { width: (n / MODULES.length * 100) + '%' } })),
      h('ol', {}, MODULES.map((m, i) => h('li', {}, h('a', {
        href: m.file, class: (m.id === this.id ? 'current ' : '') + (p[m.id] ? 'done' : '') },
        h('span', { class: 'num' }, p[m.id] ? '✓' : i + 1), m.title)))),
      h('div', { class: 'sub', style: { marginTop: '18px' } }, 'Stuck? Ask Claude with the ', h('code', {}, 'cs-tutor'), ' skill (see home page).'));
  },
  pager(main) {
    const i = MODULES.findIndex(m => m.id === this.id);
    const prev = MODULES[i - 1], next = MODULES[i + 1];
    main.append(h('div', { class: 'pager' },
      prev ? h('a', { href: prev.file }, '← ' + prev.title) : h('a', { href: 'index.html' }, '← Course home'),
      next ? h('a', { href: next.file }, next.title + ' →') : h('a', { href: 'index.html' }, 'Finish → Course home')));
  },
};
document.addEventListener('DOMContentLoaded', () => Layout.init());
