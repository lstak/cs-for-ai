/* Module 7 widgets: HTTP workbench, HTML/CSS/JS editor, rendering model, REST playground, polling vs push */
(function () {


  // ---------- 1. HTTP workbench ----------
  const SC = {
    'Open a web page': {
      req: 'GET /index.html HTTP/1.1\nHost: example.com\nAccept: text/html\nUser-Agent: Mozilla/5.0 (a browser)',
      res: 'HTTP/1.1 200 OK\nContent-Type: text/html; charset=utf-8\nContent-Length: 1256\nCache-Control: max-age=300\n\n<!doctype html>\n<html>\n  <head><link rel="stylesheet" href="style.css"></head>\n  <body><h1>Hello</h1> ...</body>\n</html>',
      note: ['The <b>request line</b> has the method (GET), the path and the HTTP version. <code>Host</code> says which site, because one server can host many.', '<code>200 OK</code> = success. <code>Content-Type</code> tells the browser how to read the body: HTML.', '<code>Cache-Control: max-age=300</code> lets the browser reuse this page for 5 minutes without asking again.', 'The HTML mentions <code>style.css</code>, so the browser will now make <b>more requests</b> for it, and for scripts and images.'] },
    'Ask an API for data (JSON)': {
      req: 'GET /api/notes/42 HTTP/1.1\nHost: example.com\nAccept: application/json\nAuthorization: Bearer sk-demo-123',
      res: 'HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"id": 42, "text": "Buy milk", "done": false}',
      note: ['Same HTTP, different payload: the body is <b>JSON data</b> for a program, not HTML for a human.', '<code>Authorization</code> carries the API key or token. It only travels safely because the connection is HTTPS (Module 6).', 'The <code>Accept</code> header says what format the client prefers.'] },
    'A page that does not exist': {
      req: 'GET /no-such-page HTTP/1.1\nHost: example.com',
      res: 'HTTP/1.1 404 Not Found\nContent-Type: text/html\n\n<h1>404</h1><p>Page not found.</p>',
      note: ['<code>4xx</code> means the <b>client</b> asked for something wrong. <code>404</code> = no such resource.', 'The server still returns a body (a friendly error page). The status code, not the text, is what programs read.'] },
    'Log in (a cookie is born)': {
      req: 'POST /login HTTP/1.1\nHost: example.com\nContent-Type: application/x-www-form-urlencoded\n\nuser=ada&password=correct-horse',
      res: 'HTTP/1.1 302 Found\nLocation: /dashboard\nSet-Cookie: session=9f3a7c; HttpOnly; Secure; SameSite=Lax; Max-Age=3600',
      note: ['<code>POST</code> sends data in the <b>body</b> (never put passwords in a URL).', '<code>302</code> + <code>Location</code> tells the browser to go to <code>/dashboard</code> next.', '<code>Set-Cookie</code> is how stateless HTTP "remembers" you: the browser will send <code>Cookie: session=9f3a7c</code> on every later request. <code>HttpOnly</code> hides it from JavaScript, <code>Secure</code> keeps it to HTTPS.'] },
    'Send a chat message to an AI API': {
      req: 'POST /v1/chat HTTP/1.1\nHost: api.ai-provider.example\nAuthorization: Bearer sk-...secret...\nContent-Type: application/json\n\n{"model": "some-chat-model", "max_tokens": 100,\n "messages": [{"role": "user", "content": "What is DNS?"}]}',
      res: 'HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"reply": "DNS turns names like example.com into IP addresses.",\n "usage": {"input_tokens": 12, "output_tokens": 14}}',
      note: ['An AI call is just an HTTP <code>POST</code> with a JSON body (Module 6).', 'The <code>usage</code> field reports tokens, which is what you are billed for (Module 12).', 'The whole conversation is in <code>messages</code>: HTTP is stateless, so the app resends it every time.'] },
    'Streaming reply (server-sent events)': {
      req: 'POST /v1/chat HTTP/1.1\nHost: api.ai-provider.example\nAuthorization: Bearer sk-...secret...\nContent-Type: application/json\n\n{"model": "some-chat-model", "stream": true,\n "messages": [{"role": "user", "content": "What is DNS?"}]}',
      res: 'HTTP/1.1 200 OK\nContent-Type: text/event-stream\n\ndata: {"token": "DNS"}\n\ndata: {"token": " turns"}\n\ndata: {"token": " names"}\n\n...   (the connection stays open; more chunks arrive as the model writes)\n\ndata: [DONE]',
      note: ['<code>"stream": true</code> asks the server to keep the response open.', '<code>text/event-stream</code> = server-sent events: each <code>data:</code> line arrives as soon as that token exists (Module 10, "streaming back").', 'One request, many pieces of response. This is how a chat UI shows words as they are produced.'] },
    'Wrong API key': {
      req: 'POST /v1/chat HTTP/1.1\nHost: api.ai-provider.example\nAuthorization: Bearer sk-wrong\nContent-Type: application/json\n\n{"messages": [...]}',
      res: 'HTTP/1.1 401 Unauthorized\nContent-Type: application/json\n\n{"error": "invalid API key"}',
      note: ['<code>401</code> = "I don\'t know who you are". (<code>403</code> would mean "I know who you are, but you may not do this".)', 'A program should read the <b>status code</b>, not guess from the text.'] },
    'Too many requests': {
      req: 'POST /v1/chat HTTP/1.1\nHost: api.ai-provider.example\nAuthorization: Bearer sk-...secret...\n...',
      res: 'HTTP/1.1 429 Too Many Requests\nRetry-After: 20\nContent-Type: application/json\n\n{"error": "rate limit exceeded"}',
      note: ['<code>429</code> = rate limit. <code>Retry-After: 20</code> says how long to wait: 20 seconds.', 'A well-behaved client waits, then retries with growing delays ("exponential backoff"), instead of hammering the server.'] },
  };
  const reqEl = $('#http-req'), resEl = $('#http-res'), noteEl = $('#http-note');
  function showHttp(k) {
    const s = SC[k];
    reqEl.textContent = s.req; resEl.textContent = s.res;
    noteEl.innerHTML = '<b>What to notice</b><ul>' + s.note.map(n => `<li>${n}</li>`).join('') + '</ul>';
  }
  const hsel = h('select', {}, Object.keys(SC).map(k => h('option', { value: k }, k)));
  hsel.onchange = () => showHttp(hsel.value);
  $('#http-ctl').append(h('label', { class: 'ctl' }, h('span', {}, 'Scenario'), hsel));
  showHttp(Object.keys(SC)[0]);

  // ---------- 2. HTML + CSS + JS editor ----------
  const DEF = {
    html: '<h2>Mini chat</h2>\n<div id="log"></div>\n<input id="msg" placeholder="Type something">\n<button id="send">Send</button>',
    css: 'body { font-family: sans-serif; padding: 12px; }\nh2 { color: #3b5bdb; }\n#log div { background: #e7f5ff; margin: 4px 0; padding: 6px 12px;\n           border-radius: 12px; width: fit-content; }\nbutton { background: #3b5bdb; color: white; border: 0; padding: 6px 12px; border-radius: 6px; }',
    js: "document.getElementById('send').onclick = () => {\n  const box = document.getElementById('msg');\n  const bubble = document.createElement('div');\n  bubble.textContent = box.value;          // text, not HTML (safe)\n  document.getElementById('log').append(bubble);\n  box.value = '';\n};",
  };
  const area = (key, label) => {
    const t = h('textarea', { rows: 8, spellcheck: 'false', style: { width: '100%', fontFamily: 'monospace', fontSize: '12.5px', boxSizing: 'border-box' } });
    t.value = DEF[key];
    return { key, t, el: h('div', {}, h('b', {}, label), t) };
  };
  const A = { html: area('html', 'HTML (structure)'), css: area('css', 'CSS (looks)'), js: area('js', 'JavaScript (behaviour)') };
  const useCss = h('input', { type: 'checkbox', checked: true }), useJs = h('input', { type: 'checkbox', checked: true });
  const frameHost = $('#web-frame');
  function runWeb() {
    const doc = '<!doctype html><html><head><meta charset="utf-8">' + (useCss.checked ? '<style>' + A.css.t.value + '</style>' : '') + '</head><body>' +
      A.html.t.value + (useJs.checked ? '<scr' + 'ipt>' + A.js.t.value + '</scr' + 'ipt>' : '') + '</body></html>';
    frameHost.innerHTML = '';
    // sandbox="allow-scripts" without allow-same-origin: the preview cannot reach this page, cookies or storage
    frameHost.append(h('iframe', { sandbox: 'allow-scripts', srcdoc: doc, style: { width: '100%', height: '230px', border: '1px solid #868e96', borderRadius: '6px', background: 'white' } }));
  }
  $('#web-edit').append(A.html.el, A.css.el);
  $('#web-edit').parentElement && $('#web-edit').after(h('div', { style: { margin: '8px 0' } }, A.js.el));
  $('#web-ctl').append(h('button', { class: 'primary', onclick: runWeb }, 'Run'),
    h('label', {}, useCss, ' use CSS'), h('label', {}, useJs, ' use JavaScript'),
    h('button', { onclick: () => { for (const k of Object.keys(A)) A[k].t.value = DEF[k]; useCss.checked = useJs.checked = true; runWeb(); } }, 'Reset'));
  useCss.onchange = useJs.onchange = runWeb;
  runWeb();

  // ---------- 3. Rendering model: SSR vs CSR/SPA vs static ----------
  const R = { rtt: 100, bw: 20, js: 800, dev: 'Laptop', render: 80, data: 100 };
  const DEV = { 'Laptop': 1, 'Mid-range phone': 3, 'Old phone': 6 };
  const rnOut = $('#rn-out');
  function drawRender() {
    const t = kb => kb * 8 / R.bw;                       // ms to transfer kb kilobytes
    const exec = R.js * 0.4 * DEV[R.dev];                 // ms to parse and run the JS bundle
    const conn = 2 * R.rtt;                               // TCP + TLS handshakes (Module 6)
    const HTML = 30, SHELL = 3, JSON_KB = 2;
    const serverWork = R.render + R.data * 0.3;           // server sits next to its database: fast data access
    const rows = {
      'Server-side rendering (SSR)': { first: conn + R.rtt + serverWork + t(HTML), nextClick: R.rtt + serverWork + t(HTML) + 40 },
      'Client-side rendering (SPA)': { first: conn + R.rtt + t(SHELL) + t(R.js) + exec + R.rtt + R.data + t(JSON_KB) + 30, nextClick: R.rtt + R.data + t(JSON_KB) + 30 },
      'Static page from a CDN': { first: 0.4 * (conn + R.rtt) + t(HTML), nextClick: 0.4 * R.rtt + t(HTML) + 40 },
    };
    rows['Server-side rendering (SSR)'].inter = rows['Server-side rendering (SSR)'].first + t(R.js) + exec;
    rows['Client-side rendering (SPA)'].inter = rows['Client-side rendering (SPA)'].first;
    rows['Static page from a CDN'].inter = rows['Static page from a CDN'].first + t(R.js) + exec;
    const min = k => Math.min(...Object.values(rows).map(r => r[k]));
    const fmt = (v, m) => `<td style="${v === m ? 'font-weight:700;color:var(--ok,#0ca678)' : ''}">${fmtTime(v / 1000)}</td>`;
    rnOut.innerHTML = '<table><tr><th>Approach</th><th>First content</th><th>Interactive</th><th>Next click</th></tr>' +
      Object.entries(rows).map(([k, r]) => `<tr><td>${k}</td>${fmt(r.first, min('first'))}${fmt(r.inter, min('inter'))}${fmt(r.nextClick, min('nextClick'))}</tr>`).join('') + '</table>' +
      `<div>Bold = fastest in that column. JavaScript to download and run: <b>${R.js} KB</b> → ${fmtTime(t(R.js) / 1000)} download + ${fmtTime(exec / 1000)} to run on this device.</div>` +
      '<div><b>Reading it:</b> SSR and static pages show content first because the browser needs no JavaScript to display them, but they re-fetch a whole page per click. The SPA pays upfront (download and run the JavaScript, then fetch data) and is then quickest on later clicks. On slow phones and networks the upfront cost grows, which is why many sites render the first view on the server and "hydrate" it.</div>';
  }
  const rsel = h('select', {}, Object.keys(DEV).map(k => h('option', { value: k }, k)));
  rsel.onchange = () => { R.dev = rsel.value; drawRender(); };
  $('#rn-ctl').append(
    slider('Round-trip time', 10, 400, 10, R.rtt, v => { R.rtt = v; drawRender(); }, v => v + ' ms').el,
    slider('Bandwidth', 1, 200, 1, R.bw, v => { R.bw = v; drawRender(); }, v => v + ' Mbit/s').el,
    slider('JavaScript bundle', 50, 3000, 50, R.js, v => { R.js = v; drawRender(); }, v => v + ' KB').el,
    slider('Server render time', 10, 500, 10, R.render, v => { R.render = v; drawRender(); }, v => v + ' ms').el,
    slider('Data lookup', 10, 500, 10, R.data, v => { R.data = v; drawRender(); }, v => v + ' ms').el,
    h('label', { class: 'ctl' }, h('span', {}, 'Device'), rsel));
  drawRender();

  // ---------- 4. REST playground ----------
  let notes = [{ id: 1, text: 'Learn HTTP' }, { id: 2, text: 'Build a chat app' }], nextId = 3;
  const KEY = 'demo-key';
  function serve(method, path, bodyText, hasKey) {
    const m = path.match(/^\/notes(?:\/(\d+))?\/?$/);
    if (!m) return [404, { error: 'no such path: ' + path }];
    const id = m[1] ? +m[1] : null;
    if (method !== 'GET' && !hasKey) return [401, { error: 'missing or invalid API key' }];
    let body = null;
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      try { body = JSON.parse(bodyText || 'null'); } catch { return [400, { error: 'body is not valid JSON' }]; }
      if (!body || typeof body.text !== 'string' || !body.text.trim()) return [400, { error: 'field "text" (non-empty string) is required' }];
    }
    if (id === null) {
      if (method === 'GET') return [200, notes];
      if (method === 'POST') { const n = { id: nextId++, text: body.text }; notes.push(n); return [201, n]; }
      return [405, { error: method + ' is not allowed on /notes' }];
    }
    const n = notes.find(x => x.id === id);
    if (!n) return [404, { error: 'note ' + id + ' not found' }];
    if (method === 'GET') return [200, n];
    if (method === 'PUT' || method === 'PATCH') { n.text = body.text; return [200, n]; }
    if (method === 'DELETE') { notes = notes.filter(x => x !== n); return [204, null]; }
    return [405, { error: method + ' is not allowed here' }];
  }
  const rReq = $('#rest-req'), rRes = $('#rest-res'), rPill = $('#rest-pill'), rData = $('#rest-data');
  const mSel = h('select', {}, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(x => h('option', { value: x }, x)));
  const pIn = h('input', { type: 'text', value: '/notes', style: { width: '150px' } });
  const bIn = h('input', { type: 'text', value: '{"text": "New note"}', style: { width: '230px' } });
  const kIn = h('input', { type: 'checkbox', checked: true });
  const STATUS = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 404: 'Not Found', 405: 'Method Not Allowed' };
  function send() {
    const method = mSel.value, path = pIn.value.trim(), hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
    const [code, payload] = serve(method, path, bIn.value, kIn.checked);
    rReq.textContent = `${method} ${path} HTTP/1.1\nHost: api.example.com\n` + (kIn.checked ? `Authorization: Bearer ${KEY}\n` : '') + (hasBody ? `Content-Type: application/json\n\n${bIn.value}` : '');
    rRes.textContent = `HTTP/1.1 ${code} ${STATUS[code]}\n` + (payload === null ? '' : `Content-Type: application/json\n\n${JSON.stringify(payload, null, 1)}`);
    rPill.className = 'pill ' + (code < 300 ? 'ok' : 'warn'); rPill.textContent = code;
    rData.textContent = JSON.stringify(notes);
  }
  const preset = (label, m, p, b) => h('button', { class: 'sm', onclick: () => { mSel.value = m; pIn.value = p; if (b != null) bIn.value = b; send(); } }, label);
  $('#rest-ctl').append(h('label', { class: 'ctl' }, h('span', {}, 'Method'), mSel), h('label', { class: 'ctl' }, h('span', {}, 'Path'), pIn),
    h('label', { class: 'ctl' }, h('span', {}, 'JSON body'), bIn), h('label', {}, kIn, ' send API key'),
    h('button', { class: 'primary', onclick: send }, 'Send'),
    h('div', {}, 'Presets: ', preset('List all', 'GET', '/notes'), preset('Get #1', 'GET', '/notes/1'), preset('Create', 'POST', '/notes', '{"text": "Write a quiz"}'),
      preset('Update #2', 'PATCH', '/notes/2', '{"text": "Build a chat app with streaming"}'), preset('Delete #1', 'DELETE', '/notes/1'),
      preset('Missing #99', 'GET', '/notes/99'), preset('Bad JSON', 'POST', '/notes', '{text: oops'), preset('Wrong path', 'GET', '/note')));
  rData.textContent = JSON.stringify(notes);
  rReq.textContent = 'Press Send or a preset.';

  // ---------- 5. Polling vs push ----------
  const EVENTS = [2.3, 6.1, 6.9, 13.4, 19.8, 24.5], SPAN = 30, PUSH_DELAY = 0.05;
  let poll = 5;
  const wsSvg = $('#ws-svg'), wsBars = $('#ws-bars'), wsOut = $('#ws-out');
  function drawPoll() {
    const polls = []; for (let t = poll; t <= SPAN + 1e-9; t += poll) polls.push(+t.toFixed(3));
    const seen = EVENTS.map(e => polls.find(p => p >= e) ?? Infinity);
    const finite = seen.filter(isFinite);
    const delays = EVENTS.map((e, i) => (isFinite(seen[i]) ? seen[i] - e : SPAN - e));
    const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
    const useful = new Set(finite).size, wasted = polls.length - useful;
    const X = t => 20 + (t / SPAN) * 600;
    wsSvg.innerHTML = '';
    wsSvg.append(sv('line', { x1: 20, y1: 55, x2: 620, y2: 55, stroke: '#868e96' }));
    polls.forEach(p => wsSvg.append(sv('line', { x1: X(p), y1: 40, x2: X(p), y2: 70, stroke: '#3b5bdb', 'stroke-width': 2 })));
    EVENTS.forEach(e => wsSvg.append(sv('circle', { cx: X(e), cy: 55, r: 6, fill: '#f08c00' })));
    wsSvg.append(sv('text', { x: 20, y: 18, 'font-size': 12, fill: 'currentColor' }, 'Orange dots = events on the server · blue ticks = the polling client asks "anything new?"'));
    wsSvg.append(sv('text', { x: 20, y: 98, 'font-size': 12, fill: 'currentColor' }, '0 s'), sv('text', { x: 600, y: 98, 'font-size': 12, fill: 'currentColor' }, '30 s'));
    const maxD = Math.max(avg, 1), maxR = Math.max(polls.length, EVENTS.length);
    renderBars(wsBars, [
      { label: 'Polling: average delay', value: avg / maxD, text: avg.toFixed(1) + ' s', cls: 'bad' },
      { label: 'Push: average delay', value: PUSH_DELAY / maxD, text: '≈ ' + (PUSH_DELAY * 1000) + ' ms', cls: 'ok' },
      { label: 'Polling: requests sent', value: polls.length / maxR, text: String(polls.length), cls: 'bad' },
      { label: 'Push: messages sent', value: EVENTS.length / maxR, text: EVENTS.length + ' (+1 connection)', cls: 'ok' },
    ]);
    wsOut.innerHTML = `Polling every <b>${poll} s</b>: events are noticed <b>${avg.toFixed(1)} s</b> late on average, and <b>${wasted}</b> of ${polls.length} requests came back empty. Poll faster and the delay shrinks, but wasted requests explode. Push (server-sent events or a WebSocket) avoids the trade-off: one open connection, a message only when something happens.`;
  }
  $('#ws-ctl').append(slider('Polling interval', 0.5, 15, 0.5, poll, v => { poll = v; drawPoll(); }, v => v + ' s').el);
  drawPoll();

  Quiz.mount('#quiz', [
    { q: 'What is the difference between the Internet and the Web?', options: ['They are the same thing', 'The Internet is the global network that carries packets; the Web is one service on it, built on URLs, HTTP and HTML', 'The Web is faster', 'The Internet is only for email'], answer: 1, why: 'Email, SSH and games also use the Internet but are not the Web.' },
    { q: 'HTTP is "stateless". What does this mean in practice?', options: ['The server cannot be reached', 'The server treats each request on its own; sites use cookies or tokens (and apps resend context) so you stay "logged in"', 'HTTP has no status codes', 'Requests have no body'], answer: 1, why: 'Cookies, Authorization headers and re-sent chat history are the workarounds that give the Web its memory.' },
    { q: 'Your program receives HTTP 429. What does it mean and what should you do?', options: ['The server crashed; give up', 'You are sending too many requests; wait (see Retry-After) and retry with increasing delays', 'The page does not exist', 'Your password is wrong'], answer: 1, why: '429 = rate limited. 404 is not found, 401 is not authenticated, 5xx is a server problem.' },
    { q: 'What do HTML, CSS and JavaScript do, respectively?', options: ['Behaviour, structure, looks', 'Structure and content, looks, behaviour', 'Looks, behaviour, structure', 'They all do the same thing'], answer: 1, why: 'House analogy: HTML = walls and rooms, CSS = paint and furniture, JS = lights and doors.' },
    { q: 'What is the main difference between server-side and client-side rendering?', options: ['SSR uses HTML; CSR does not', 'In SSR the server builds the page HTML; in CSR the browser builds it with JavaScript, usually after fetching JSON from an API', 'CSR is always faster', 'SSR works without a network'], answer: 1, why: 'SSR shows content sooner and suits search engines; CSR/SPAs feel app-like after the first load but pay an upfront cost.' },
    { q: 'What is a single-page application (SPA)?', options: ['A website with only one page of content', 'An app that loads once, then uses JavaScript to update the page and fetch small JSON responses without full reloads', 'A very short HTML file', 'A password manager'], answer: 1, why: 'Gmail and most chat apps work this way.' },
    { q: 'Which statement about REST is correct?', options: ['URLs are verbs and HTTP methods are nouns', 'URLs name resources (nouns like /notes/42) and HTTP methods are the actions (GET, POST, PATCH, DELETE)', 'REST requires XML', 'REST APIs must keep session state on the server'], answer: 1, why: 'Resources as nouns, methods as verbs, status codes for results, stateless requests.' },
    { q: 'Why does a chat app stream a model reply with server-sent events (or a WebSocket) instead of polling?', options: ['Polling is not possible', 'Streaming delivers each token the moment it exists on one open connection; polling adds delay and many wasted requests', 'Streaming is encrypted and polling is not', 'Polling uses more GPU'], answer: 1, why: 'Push avoids the delay-versus-wasted-requests trade-off (like interrupts vs polling in Module 9).' },
    { q: 'What is the key difference between SSE and a WebSocket?', options: ['SSE is two-way, WebSocket is one-way', 'SSE is one-way (server → client) over a normal HTTP response; a WebSocket is a two-way channel after an HTTP upgrade (101)', 'They are identical', 'SSE needs no internet'], answer: 1, why: 'Use SSE for streaming replies and feeds; WebSockets for two-way, low-latency interaction (chat rooms, games, live voice).' },
    { q: 'A developer puts the AI provider API key in the web page\'s JavaScript. What is the problem?', options: ['None, JavaScript is private', 'Anyone can read it with developer tools and use (and bill) it; the key belongs on the server, which calls the provider on the browser\'s behalf', 'It makes the page slower', 'It breaks CSS'], answer: 1, why: 'Everything sent to a browser is visible to its user. Keep secrets server-side.' },
  ]);
})();
