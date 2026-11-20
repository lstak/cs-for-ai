/* Module 9 widgets: polling vs interrupts + camera bandwidth */
(function () {
  // ---------- Polling vs interrupts ----------
  const T = 100; let interval = 8, events = [];
  const gen = () => { const s = new Set(); while (s.size < 6) s.add(3 + Math.floor(Math.random() * (T - 12))); events = [...s].sort((a, b) => a - b); draw(); };
  const svg = $('#int-svg'), X = 20, W = 600, sx = t => X + t / T * W;
  function draw() {
    svg.replaceChildren();
    const lane = (y, title) => { svg.append(sv('text', { x: X, y: y - 38, 'font-size': 13, 'font-weight': 700 }, title), sv('line', { x1: X, x2: X + W, y1: y, y2: y, stroke: 'currentColor', 'stroke-opacity': .3 })); };
    lane(60, 'Polling: CPU checks the device every ' + interval + ' ticks'); lane(140, 'Interrupts: device taps the CPU on the shoulder');
    // polling
    const checks = []; for (let t = interval; t < T; t += interval) checks.push(t);
    let handled = 0, wasted = 0, delays = [];
    const pending = [...events];
    for (const c of checks) {
      const ready = pending.filter(e => e <= c);
      if (ready.length) { ready.forEach(e => { delays.push(c - e); svg.append(sv('line', { x1: sx(e), x2: sx(c), y1: 60, y2: 60, stroke: '#e03131', 'stroke-width': 4, 'stroke-opacity': .5 })); }); pending.splice(0, ready.length); handled += ready.length; }
      else wasted++;
      svg.append(sv('rect', { x: sx(c) - 3, y: 52, width: 6, height: 16, rx: 2, fill: ready.length ? '#2f9e44' : '#868e96' }));
    }
    delays.push(...pending.map(() => T));
    events.forEach(e => { svg.append(sv('text', { x: sx(e), y: 40, 'text-anchor': 'middle', 'font-size': 16, fill: '#f08c00' }, '★'), sv('text', { x: sx(e), y: 120, 'text-anchor': 'middle', 'font-size': 16, fill: '#f08c00' }, '★'), sv('rect', { x: sx(e) - 3, y: 132, width: 6, height: 16, rx: 2, fill: '#2f9e44' })); });
    const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
    $('#poll-out').innerHTML = `<b>Polling</b><div>Checks made: ${checks.length}</div><div>Wasted checks (nothing there): <span class="pill ${wasted > checks.length / 2 ? 'bad' : 'warn'}">${wasted}</span></div><div>Average delay to notice an event: <span class="pill ${avg > 3 ? 'bad' : 'ok'}">${avg.toFixed(1)} ticks</span></div>`;
    $('#irq-out').innerHTML = `<b>Interrupts</b><div>Handler runs: ${events.length} (once per event)</div><div>Wasted checks: <span class="pill ok">0</span></div><div>Average delay: <span class="pill ok">~0 ticks</span></div>`;
  }
  $('#int-ctl').append(slider('Polling interval', 1, 25, 1, interval, v => { interval = v; draw(); }, v => v + ' ticks').el, h('button', { class: 'primary', onclick: gen }, '🎲 New random events'));
  gen();

  // ---------- Camera bandwidth ----------
  const IFACE = [['USB 2.0', 40], ['Gigabit Ethernet', 115], ['SATA SSD', 550], ['USB 3.0', 400], ['10 Gb Ethernet', 1150], ['MIPI CSI-2 (4 lanes)', 1000], ['NVMe SSD', 3500], ['PCIe 4.0 ×16', 25000]];
  const RES = { '640×480': [640, 480], '720p': [1280, 720], '1080p': [1920, 1080], '4K': [3840, 2160] };
  let res = '1080p', fps = 30, cams = 1, bpp = 3;
  const need = $('#bw-need'), bars = $('#bw-bars');
  function bw() {
    const [w, hh] = RES[res], mb = w * hh * bpp * fps * cams / 1e6;
    need.innerHTML = `<div>Frame size: <b>${(w * hh * bpp / 1e6).toFixed(1)} MB</b> · Required throughput: <span class="stat">${mb.toFixed(0)} MB/s</span> <span style="color:var(--muted)">(${(mb * 8 / 1000).toFixed(2)} Gbit/s)</span></div>`;
    const sorted = [...IFACE].sort((a, b) => a[1] - b[1]), mx = Math.log10(30000), mn = Math.log10(20);
    renderBars(bars, sorted.map(([n, c]) => ({ label: n, value: (Math.log10(c) - mn) / (mx - mn), text: `${c} MB/s ${c >= mb ? '✓' : '✗'}`, cls: c >= mb ? 'ok' : 'bad' })));
  }
  const rs = h('select', {}, Object.keys(RES).map(k => h('option', { value: k, selected: k === res }, k))); rs.onchange = () => { res = rs.value; bw(); };
  const bs = h('select', {}, [['3', 'RGB, 3 bytes/pixel'], ['1', 'Grayscale, 1 byte/pixel'], ['1.5', 'YUV420 (typical raw), 1.5 B/px']].map(([v, t]) => h('option', { value: v }, t))); bs.onchange = () => { bpp = +bs.value; bw(); };
  $('#bw-ctl').append(h('label', { class: 'ctl' }, h('span', {}, 'Resolution'), rs), h('label', { class: 'ctl' }, h('span', {}, 'Pixel format'), bs),
    slider('Frame rate', 5, 120, 5, fps, v => { fps = v; bw(); }, v => v + ' fps').el, slider('Cameras', 1, 8, 1, cams, v => { cams = v; bw(); }).el);
  bw();

  Quiz.mount('#quiz', [
    { q: 'What is the main advantage of interrupts over polling?', options: ['They are always faster to program', 'The CPU does not waste time checking, and reacts promptly when the event occurs', 'They use more memory', 'They work only for keyboards'], answer: 1, why: 'The device signals the CPU only when needed.' },
    { q: 'What does DMA allow?', options: ['Devices to move data to/from RAM without the CPU copying each byte', 'The CPU to run faster', 'Programs to share variables', 'Encrypted network traffic'], answer: 0, why: 'Direct Memory Access frees the CPU from the byte-by-byte copy.' },
    { q: 'A 1080p RGB camera at 30 fps produces about how much raw data per second?', options: ['~6 MB/s', '~60 MB/s', '~190 MB/s', '~1.9 GB/s'], answer: 2, why: '1920 × 1080 × 3 bytes × 30 ≈ 187 MB/s, which is why cameras usually compress or use faster interfaces.' },
    { q: 'Which describes the order of a voice assistant?', options: ['Speaker → model → microphone', 'Microphone → speech-to-text → language model (maybe with tools) → text-to-speech → speaker', 'Camera → speaker', 'Keyboard → microphone'], answer: 1, why: 'Sound in, text, thinking, text, sound out. Each stage adds delay, so streaming between stages helps.' },
    { q: 'Why might a smart camera run a small AI model on the device instead of uploading all its video?', options: ['It is always more accurate', 'Raw video is a lot of data, replies must be fast, and the footage may be private', 'Cloud servers cannot run models', 'To make the camera heavier'], answer: 1, why: 'Bandwidth, latency and privacy all favour processing at the edge (Modules 6 and 9).' },
    { q: 'What is a driver?', options: ['A program that makes the CPU faster', 'Software that lets the OS talk to a particular device and present it in a uniform way', 'A type of cable', 'A GPU core'], answer: 1, why: 'The OS asks for "a camera"; the driver handles the specific hardware.' },
  ]);
})();
