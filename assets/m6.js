/* Module 6 widgets: packet loss/retransmit + request waterfall */
(function () {
  // ---------- Packets ----------
  let msg = 'Hello from the other side of the internet!', size = 6, loss = 25;
  const input = h('input', { type: 'text', value: msg, size: 34, 'aria-label': 'message' });
  const mkChip = (p, cls) => h('span', { class: 'chip ' + (cls || '') }, h('small', {}, '#' + p.seq), JSON.stringify(p.data).slice(1, -1) || ' ');
  function send() {
    msg = input.value; const pk = [];
    for (let i = 0; i * size < msg.length; i++) pk.push({ seq: i, data: msg.slice(i * size, (i + 1) * size) });
    const arr = pk.map(p => ({ ...p, lost: Math.random() * 100 < loss }));
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    const missing = pk.filter(p => arr.find(a => a.seq === p.seq).lost);
    $('#pk-sent').replaceChildren(...pk.map(p => mkChip(p)));
    $('#pk-arr').replaceChildren(...arr.map(p => mkChip(p, p.lost ? 'lost' : '')));
    $('#pk-re').replaceChildren(...(missing.length ? missing.map(p => mkChip(p, 're')) : [h('span', { class: 'pill ok' }, 'none needed')]));
    $('#pk-final').textContent = msg;
  }
  $('#pk-ctl').append(h('label', { class: 'ctl' }, h('span', {}, 'Message'), input), slider('Packet size', 2, 20, 1, size, v => { size = v; send(); }, v => v + ' chars').el,
    slider('Packet loss', 0, 60, 5, loss, v => { loss = v; send(); }, v => v + '%').el, h('button', { class: 'primary', onclick: send }, 'Send ✉'));
  send();

  // ---------- Request waterfall ----------
  const PLACES = { 'Same city (50 km)': 50, 'Same continent (1,500 km)': 1500, 'Across an ocean (6,000 km)': 6000, 'Opposite side of the planet (15,000 km)': 15000 };
  let place = 'Across an ocean (6,000 km)', https = true, dnsCached = false, step = 0, timer = null;
  const svg = $('#req-svg'), out = $('#req-out');
  const rttSrv = () => 2 * PLACES[place] / 200 + 4;   // ms: fibre 200 km/ms, plus ~4 ms of equipment
  const RTT_DNS = 12;
  function msgs() {
    const rs = rttSrv(), m = [];
    if (!dnsCached) m.push({ f: 0, t: 1, label: 'DNS: “where is api.example.com?”', ms: RTT_DNS / 2, ph: 'DNS' }, { f: 1, t: 0, label: 'DNS: “93.184.216.34”', ms: RTT_DNS / 2, ph: 'DNS' });
    m.push({ f: 0, t: 2, label: 'TCP SYN', ms: rs / 2, ph: 'TCP' }, { f: 2, t: 0, label: 'TCP SYN-ACK', ms: rs / 2, ph: 'TCP' }, { f: 0, t: 2, label: 'TCP ACK (+ start)', ms: rs / 2, ph: 'TCP' });
    if (https) m.push({ f: 0, t: 2, label: 'TLS ClientHello', ms: rs / 2, ph: 'TLS' }, { f: 2, t: 0, label: 'TLS ServerHello + keys', ms: rs / 2, ph: 'TLS' });
    m.push({ f: 0, t: 2, label: 'HTTP GET /predict', ms: rs / 2, ph: 'HTTP' }, { f: 2, t: 0, label: '200 OK + data  (server thinks 20 ms)', ms: rs / 2 + 20, ph: 'HTTP' });
    return m;
  }
  const X = [70, 320, 570], PCOL = { DNS: '#9c36b5', TCP: '#3b5bdb', TLS: '#f08c00', HTTP: '#0ca678' };
  function draw() {
    const M = msgs(), H = 50, y0 = 50, rowH = Math.min(26, 250 / M.length);
    svg.replaceChildren();
    ['Your laptop', 'DNS resolver', 'Server'].forEach((n, i) => {
      svg.append(sv('text', { x: X[i], y: 20, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14 }, n),
        sv('line', { x1: X[i], x2: X[i], y1: 30, y2: 320, stroke: 'currentColor', 'stroke-opacity': .25, 'stroke-dasharray': '4 4' }));
    });
    let t = 0;
    M.forEach((m, i) => {
      t += m.ms; if (i >= step) return;
      const y = y0 + i * rowH, col = PCOL[m.ph], x1 = X[m.f], x2 = X[m.t], d = x2 > x1 ? -8 : 8;
      svg.append(sv('line', { x1, x2, y1: y, y2: y, stroke: col, 'stroke-width': 2.5 }),
        sv('path', { d: `M${x2},${y} l${d},-5 l0,10 z`, fill: col }),
        sv('text', { x: (x1 + x2) / 2, y: y - 4, 'text-anchor': 'middle', 'font-size': 11 }, m.label),
        sv('text', { x: x1 < x2 ? x2 - 4 : x2 + 4, y: y + 12, 'text-anchor': x1 < x2 ? 'end' : 'start', 'font-size': 10, 'fill-opacity': .7 }, `${t.toFixed(0)} ms`));
    });
    const phases = {}; let total = 0;
    M.slice(0, step).forEach(m => { phases[m.ph] = (phases[m.ph] || 0) + m.ms; total += m.ms; });
    out.innerHTML = `<div><b>Server round trip (RTT):</b> ${rttSrv().toFixed(0)} ms (light in fibre is the floor)</div>
      <div><b>Elapsed:</b> <span class="stat">${total.toFixed(0)} ms</span> ${Object.entries(phases).map(([k, v]) => `<span class="pill" style="color:${PCOL[k]}">${k} ${v.toFixed(0)} ms</span>`).join(' ')}</div>
      <div style="color:var(--muted)">Reusing the connection (keep-alive) would skip DNS, TCP and TLS, leaving only the HTTP step.</div>`;
  }
  const reset = () => { clearInterval(timer); step = 0; draw(); };
  const play = () => { reset(); const n = msgs().length; timer = setInterval(() => { step++; draw(); if (step >= n) clearInterval(timer); }, 450); };
  const sel = h('select', {}, Object.keys(PLACES).map(k => h('option', { value: k, selected: k === place }, k)));
  sel.onchange = () => { place = sel.value; reset(); play(); };
  $('#req-ctl').append(h('label', { class: 'ctl' }, h('span', {}, 'Server location'), sel),
    h('label', {}, h('input', { type: 'checkbox', checked: true, onchange: e => { https = e.target.checked; reset(); play(); } }), ' HTTPS'),
    h('label', {}, h('input', { type: 'checkbox', onchange: e => { dnsCached = e.target.checked; reset(); play(); } }), ' DNS cached'),
    h('button', { class: 'primary', onclick: play }, '▶ Play'));
  step = msgs().length; draw();

  Quiz.mount('#quiz', [
    { q: 'What does DNS do?', options: ['Encrypts traffic', 'Translates names like example.com into IP addresses', 'Speeds up Wi-Fi', 'Stores your files'], answer: 1, why: 'The internet\'s phone book.' },
    { q: 'Which protocol would you choose for live video where an occasional lost packet is acceptable but delay is not?', options: ['TCP', 'UDP', 'SSH', 'DNS'], answer: 1, why: 'UDP avoids retransmission delays.' },
    { q: 'A server is 6,000 km away. What is the physical minimum round trip time (fibre ≈ 200 km/ms)?', options: ['~6 ms', '~30 ms', '~60 ms', '~600 ms'], answer: 2, why: '12,000 km round trip ÷ 200 km/ms = 60 ms, and real networks add more.' },
    { q: 'Why do chatbot replies appear word by word?', options: ['The network is slow', 'The model produces one token at a time, and the server streams each piece as soon as it exists', 'To look human', 'Because the answer is typed by a person'], answer: 1, why: 'Generation is a token-by-token loop (Module 11); streaming lets you start reading after the first token.' },
    { q: 'Your app gets HTTP 429 from an AI API. What does it mean and what should you do?', options: ['The API key is wrong; buy a new computer', 'Too many requests (rate limit); wait and retry with increasing delays', 'The model is broken for good', 'Your GPU is too slow'], answer: 1, why: '429 means "slow down". Back off, then retry. (401 would be a bad key.)' },
    { q: 'Where should an AI API key be stored?', options: ['In your code, in a public repository', 'In an environment variable or secrets manager, never in shared code', 'In the chat message', 'On a sticky note'], answer: 1, why: 'Keys are like passwords: anyone with the key can spend your money (Module 12).' },
    { q: 'Why does a chat app re-send the earlier messages with each new question?', options: ['A bug', 'HTTP is stateless and the model has no memory between calls, so the app supplies the conversation each time', 'The network loses messages', 'To increase the bill on purpose'], answer: 1, why: 'The "memory" of a conversation is just the text the app sends back in (Modules 11 and 13).' },
  ]);
})();
