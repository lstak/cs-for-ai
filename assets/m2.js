/* Module 2 widgets: latency chart, transfer calculator, cache simulator */
(function () {
  // ---------- Latency chart ----------
  const LAT = [
    ['CPU register', 0.3], ['L1 cache', 1], ['L3 cache', 15], ['RAM', 100],
    ['NVMe SSD read', 1e5], ['Network, same datacenter', 5e5], ['Hard disk seek', 1e7], ['Network, across an ocean', 1.5e8],
  ];
  const lat = $('#w-lat'), human = $('#human');
  const lo = Math.log10(0.2), hi = Math.log10(3e8);
  function drawLat() {
    renderBars(lat, LAT.map(([name, ns]) => ({
      label: name, value: (Math.log10(ns) - lo) / (hi - lo),
      text: human.checked ? fmtTime(ns) : fmtTime(ns * 1e-9),   // human scale: pretend ns are seconds
      cls: ns > 1e6 ? 'bad' : ns > 50 ? 'warn' : 'ok',
    })));
  }
  human.addEventListener('change', drawLat); drawLat();

  // ---------- Transfer calculator ----------
  const SRC = [  // name, GB/s sustained
    ['GPU HBM memory', 2000], ['RAM (DDR5)', 50], ['PCIe 4.0 ×16 (CPU↔GPU)', 25], ['NVMe SSD', 3.5],
    ['SATA SSD', 0.5], ['10 Gbit network', 1.1], ['1 Gbit network', 0.11], ['Hard disk', 0.15],
  ];
  const xf = $('#w-xfer');
  let sizeGB = 100;
  function drawX() {
    const tmax = 1000 / 0.11, tmin = 0.01 / 2000;
    renderBars(xf, SRC.map(([n, bw]) => {
      const t = sizeGB / bw;
      return { label: n, value: (Math.log10(t) - Math.log10(tmin)) / (Math.log10(tmax) - Math.log10(tmin)), text: fmtTime(t), cls: t > 600 ? 'bad' : t > 30 ? 'warn' : 'ok' };
    }));
  }
  const sz = slider('Dataset size', 1, 1000, 1, sizeGB, v => { sizeGB = v; drawX(); }, v => v + ' GB');
  $('#xfer-ctl').append(sz.el); drawX();

  // ---------- Cache simulator ----------
  const N = 16, LINE = 8, CAP = 4;
  const grid = $('#w-cache'), stat = $('#cache-stat');
  const cells = Array.from({ length: N * N }, () => { const i = h('i'); grid.append(i); return i; });
  let timer = null;
  function simulate(order) {
    const cache = [], res = []; let hit = 0, miss = 0;
    for (const [r, c] of order) {
      const line = r * (N / LINE) + Math.floor(c / LINE), idx = cache.indexOf(line);
      if (idx >= 0) { hit++; cache.splice(idx, 1); cache.push(line); res.push(1); }
      else { miss++; cache.push(line); if (cache.length > CAP) cache.shift(); res.push(0); }
    }
    return { res, hit, miss };
  }
  function run(byRows) {
    clearInterval(timer); cells.forEach(c => c.className = '');
    const order = []; for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) order.push(byRows ? [a, b] : [b, a]);
    const { res } = simulate(order); let k = 0, hit = 0, miss = 0;
    timer = setInterval(() => {
      for (let s = 0; s < 3 && k < order.length; s++, k++) {
        const [r, c] = order[k]; cells[r * N + c].className = res[k] ? 'hit' : 'miss'; res[k] ? hit++ : miss++;
      }
      stat.innerHTML = `<span style="color:var(--ok)">${hit} hits</span> · <span style="color:var(--bad)">${miss} misses</span>`;
      if (k >= order.length) clearInterval(timer);
    }, 25);
  }
  $('#run-row').onclick = () => run(true); $('#run-col').onclick = () => run(false);

  Quiz.mount('#quiz', [
    { q: 'Which is the fastest memory level that a program can use?', options: ['RAM', 'Registers', 'SSD', 'L3 cache'], answer: 1, why: 'Registers sit inside the CPU core, about 0.3 ns away.' },
    { q: 'What is the difference between latency and bandwidth?', options: ['They are the same thing', 'Latency = delay before the first byte; bandwidth = bytes per second once flowing', 'Latency is for GPUs, bandwidth for CPUs', 'Bandwidth is the delay, latency is the speed'], answer: 1, why: 'A cargo ship: huge bandwidth, huge latency.' },
    { q: 'Why is walking down the columns of a row-major array slower than walking along the rows?', options: ['Columns are longer', 'Each access lands in a different cache line, so nearly every read misses the cache', 'Python is slower on columns', 'The GPU is used for rows only'], answer: 1, why: 'Row-major storage keeps a row\'s numbers adjacent; columns are strided far apart.' },
    { q: 'Why does a local chatbot take several seconds to start before it can answer its first question?', options: ['It is thinking of a good answer', 'The model weights (many GB) must be read from disk into RAM and copied into GPU memory first', 'The keyboard is slow', 'It must download the internet'], answer: 1, why: 'Loading 14 GB from disk at a few GB/s takes seconds. Later questions are fast because the model stays loaded.' },
    { q: 'A 14 GB model fits in your 64 GB of RAM but you get "CUDA out of memory" on a 12 GB GPU. Why?', options: ['RAM is broken', 'GPU memory (VRAM) is separate from RAM; the model plus the conversation must fit in VRAM', 'CUDA has a bug', 'You need more disk space'], answer: 1, why: 'Different memory, different capacity. Use a smaller or quantised (4-bit) model, or a bigger GPU.' },
    { q: 'What is the idea behind "caching" in AI services?', options: ['Deleting old data', 'Keeping something you will need again (a loaded model, a processed prompt) in faster, closer memory so you do not redo the work', 'Encrypting the model', 'Compressing images'], answer: 1, why: 'Fast memory is small and expensive, so services keep the most reused things there.' },
  ]);
})();
