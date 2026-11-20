/* Module 3 widgets: CPU vs GPU race + matmul time calculator */
(function () {
  const G = 40, CELLS = G * G, PX = 6;
  let cpuCores = 8, gpuCores = 512, branchy = false, timer = null;
  const cv = { cpu: $('#cpu-cv'), gpu: $('#gpu-cv') };
  const st = { cpu: { done: 0, ticks: 0, fin: null }, gpu: { done: 0, ticks: 0, fin: null } };
  const cpuRate = () => cpuCores * 4;
  const gpuRate = () => Math.max(1, Math.floor(gpuCores / (branchy ? 32 : 1)));   // divergence: 32 threads share one path at a time
  function draw(k) {
    const c = cv[k].getContext('2d'), s = st[k], css = getComputedStyle(document.body);
    c.clearRect(0, 0, cv[k].width, cv[k].height);
    for (let i = 0; i < CELLS; i++) {
      c.fillStyle = i < s.done ? (k === 'cpu' ? '#3b5bdb' : '#0ca678') : 'rgba(128,128,150,.18)';
      c.fillRect((i % G) * PX, Math.floor(i / G) * PX, PX - 1, PX - 1);
    }
    $('#' + k + '-t').textContent = s.fin ? `Done in ${s.fin} ticks` : `Tick ${s.ticks}: ${s.done}/${CELLS}`;
  }
  function info() {
    $('#cpu-info').textContent = `${cpuCores} cores × 4 = ${cpuRate()} cells/tick`;
    $('#gpu-info').textContent = `${branchy ? gpuCores + ' cores ÷ 32 (divergence)' : gpuCores + ' cores × 1'} = ${gpuRate()} cells/tick`;
  }
  function reset() {
    clearInterval(timer); for (const k of ['cpu', 'gpu']) st[k] = { done: 0, ticks: 0, fin: null };
    $('#race-msg').textContent = ''; info(); draw('cpu'); draw('gpu');
  }
  function start() {
    reset();
    timer = setInterval(() => {
      for (const [k, rate] of [['cpu', cpuRate()], ['gpu', gpuRate()]]) {
        const s = st[k]; if (s.fin) continue;
        s.ticks++; s.done = Math.min(CELLS, s.done + rate); if (s.done >= CELLS) s.fin = s.ticks; draw(k);
      }
      if (st.cpu.fin && st.gpu.fin) {
        clearInterval(timer);
        const [a, b] = [st.cpu.fin, st.gpu.fin];
        $('#race-msg').textContent = a === b ? 'A tie.' : b < a ? `GPU wins, ${(a / b).toFixed(1)}× faster. Same operation everywhere suits it.`
          : `CPU wins, ${(b / a).toFixed(1)}× faster. Threads that disagree on which branch to take force the GPU to run groups one path at a time.`;
      }
    }, 90);
  }
  const ctl = $('#race-ctl');
  const kind = h('select', {}, h('option', { value: 'same' }, 'Same operation on every cell (matrix multiply)'), h('option', { value: 'branchy' }, 'Different decision for every cell (branchy logic)'));
  kind.onchange = () => { branchy = kind.value === 'branchy'; reset(); };
  ctl.append(slider('CPU cores', 1, 32, 1, cpuCores, v => { cpuCores = v; reset(); }).el, slider('GPU cores', 64, 4096, 64, gpuCores, v => { gpuCores = v; reset(); }).el,
    h('label', { class: 'ctl' }, h('span', {}, 'Type of work'), kind), h('button', { class: 'primary', onclick: start }, '▶ Start race'));
  reset();

  // ---------- Matmul time ----------
  let n = 4096;
  const DEV = [['Laptop CPU', 0.2e12, 16], ['Gaming GPU (fp32)', 20e12, 12], ['Data-centre GPU (bf16)', 200e12, 80]];   // FLOP/s, memory GB
  const out = $('#mm-out'), note = $('#mm-note');
  function mm() {
    const flops = 2 * n ** 3, bytes = 3 * n * n * 4;
    const rows = DEV.map(([name, f, mem]) => { const t = flops / f; return { name, t, mem }; });
    const tmax = rows[0].t, tmin = Math.max(1e-9, rows[2].t / 5);
    renderBars(out, rows.map(r => ({ label: r.name, value: (Math.log10(r.t) - Math.log10(tmin)) / (Math.log10(tmax * 1.2) - Math.log10(tmin)), text: fmtTime(r.t), cls: r.t > 10 ? 'bad' : r.t > 0.1 ? 'warn' : 'ok' })));
    note.innerHTML = `<div><b>Work:</b> 2n³ = ${flops.toExponential(2)} FLOPs</div><div><b>Memory for three fp32 n×n matrices:</b> ${fmtBytes(bytes)} ` +
      DEV.map(([nm, , mem]) => `<span class="pill ${bytes / 1e9 <= mem ? 'ok' : 'bad'}">${bytes / 1e9 <= mem ? 'fits' : 'too big'}: ${mem} GB</span>`).join(' ') + `</div>`;
  }
  $('#mm-ctl').append(slider('Matrix size n', 256, 32768, 256, n, v => { n = v; mm(); }, v => `${v} × ${v}`).el);
  mm();

  Quiz.mount('#quiz', [
    { q: 'What are the three basic steps a CPU core repeats for each instruction?', options: ['Read, write, delete', 'Fetch, decode, execute', 'Compile, link, run', 'Send, receive, ack'], answer: 1, why: 'Fetch the instruction, decode it, execute it. Billions of times per second.' },
    { q: 'Why are GPUs well suited to running neural networks (chatbots, image models)?', options: ['They have a higher clock speed than CPUs', 'The work is the same simple operation (matrix math) on huge amounts of data, which thousands of cores can do in parallel', 'They have more disk space', 'They can run Python faster'], answer: 1, why: 'GPU cores are individually slower; the win is massive parallelism on uniform work.' },
    { q: 'You double the matrix size n. About how much more work is a matrix multiply?', options: ['2×', '4×', '8×', '16×'], answer: 2, why: 'Work grows as n³, so 2³ = 8×.' },
    { q: 'Roughly how many operations does a 7B-parameter model need to produce one token?', options: ['7 thousand', '7 million', '14 billion (about 2 per parameter)', '14 trillion'], answer: 2, why: 'Each parameter takes part in about one multiply and one add per token: 2 × 7×10⁹ = 14×10⁹.' },
    { q: 'Why does a 4-bit version of a model usually generate text faster than its 16-bit version on the same GPU?', options: ['4-bit numbers are smarter', 'Each token needs all the weights read from memory, and 4-bit weights are 4× fewer bytes to read', 'The GPU has more cores for 4-bit', 'It uses less electricity only'], answer: 1, why: 'Generation is limited by memory bandwidth: fewer bytes per weight means less to read per token.' },
    { q: 'What does one layer of a neural network mostly compute?', options: ['A database query', 'Weighted sums of its inputs (a matrix multiplication) followed by a small tweak', 'A web request', 'A sort of the input'], answer: 1, why: 'Stacks of weighted sums with simple non-linear tweaks are the whole trick (Module 11).' },
  ]);
})();
