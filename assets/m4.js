/* Module 4 widgets: scheduler + memory/OOM */
(function () {
  // ---------- Scheduler ----------
  const COLORS = ['#3b5bdb', '#0ca678', '#f08c00'], NAMES = ['A', 'B', 'C'];
  let bursts = [8, 3, 5], algo = 'fifo', quantum = 2, cs = 0.5;
  function simulate() {
    const rem = [...bursts], seg = [], finish = [], first = [];
    let time = 0, last = -1;
    const sw = i => { if (last !== -1 && last !== i && cs > 0) { seg.push({ p: -1, s: time, e: time + cs }); time += cs; } };
    const run = (i, d) => { sw(i); if (first[i] == null) first[i] = time; seg.push({ p: i, s: time, e: time + d }); time += d; rem[i] -= d; last = i; };
    if (algo === 'fifo') for (let i = 0; i < 3; i++) { run(i, rem[i]); finish[i] = time; }
    else { const q = [0, 1, 2]; while (q.length) { const i = q.shift(); run(i, Math.min(quantum, rem[i])); rem[i] > 0 ? q.push(i) : (finish[i] = time); } }
    return { seg, finish, first, total: time };
  }
  const g = $('#sch-gantt'), out = $('#sch-out');
  function drawSched() {
    const { seg, finish, first, total } = simulate();
    g.innerHTML = '';
    for (const s of seg) g.append(h('div', { style: { width: ((s.e - s.s) / total * 100) + '%', background: s.p < 0 ? 'repeating-linear-gradient(45deg,#868e96,#868e96 3px,#adb5bd 3px,#adb5bd 6px)' : COLORS[s.p] }, title: s.p < 0 ? 'context switch' : NAMES[s.p] }, s.p < 0 ? '' : NAMES[s.p]));
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    out.innerHTML = `<div><b>All finished at:</b> ${total.toFixed(1)} units (grey = time lost to context switches)</div>
      <div><b>Average finish time:</b> ${avg(finish).toFixed(1)}</div>
      <div><b>Average wait before first running (responsiveness):</b> ${avg(first).toFixed(1)}</div>
      <div><b>Switches:</b> ${seg.filter(s => s.p < 0).length}</div>`;
  }
  const ctl = $('#sch-ctl');
  const alg = h('select', {}, h('option', { value: 'fifo' }, 'First come, first served'), h('option', { value: 'rr' }, 'Round robin'));
  alg.onchange = () => { algo = alg.value; qs.el.style.opacity = algo === 'rr' ? 1 : .4; drawSched(); };
  const qs = slider('Time slice', 1, 8, 1, quantum, v => { quantum = v; drawSched(); }, v => v + ' units');
  qs.el.style.opacity = .4;
  ctl.append(h('label', { class: 'ctl' }, h('span', {}, 'Scheduling policy'), alg), qs.el,
    slider('Switch cost', 0, 2, 0.5, cs, v => { cs = v; drawSched(); }, v => v + ' units').el,
    ...NAMES.map((n, i) => slider(`Job ${n} needs`, 1, 12, 1, bursts[i], v => { bursts[i] = v; drawSched(); }, v => v + ' units').el));
  drawSched();

  // ---------- Memory / OOM ----------
  const RAM = 16, SWAP = 8, PROGS = [['Browser', 3, '#3b5bdb'], ['Jupyter notebook', 2, '#0ca678'], ['Load 7B model (fp16)', 14, '#f08c00'], ['DataLoader worker', 1.5, '#9c36b5'], ['Video call', 1, '#1098ad']];
  let procs = [], uid = 1; const logLines = [];
  const bar = $('#mem-bar'), state = $('#mem-state'), txt = $('#mem-txt'), logEl = $('#mem-log');
  const used = () => procs.reduce((a, p) => a + p.gb, 0);
  const log = m => { logLines.unshift(m); logLines.length = Math.min(logLines.length, 4); };
  function addProc(name, gb, color) {
    procs.push({ id: uid++, name, gb, color });
    while (used() > RAM + SWAP) {
      const big = procs.reduce((a, b) => (b.gb > a.gb ? b : a)); procs = procs.filter(p => p !== big);
      log(`💀 OOM killer terminated "${big.name}" (${big.gb} GB). You see only: Killed`);
    }
    drawMem();
  }
  function drawMem() {
    bar.innerHTML = '';
    const total = RAM + SWAP;
    for (const p of procs) bar.append(h('div', { style: { width: (p.gb / total * 100) + '%', background: p.color }, title: `${p.name} ${p.gb} GB (click to close)`, onclick: () => { procs = procs.filter(x => x !== p); drawMem(); } }, p.gb >= 2 ? p.name.split(' ')[0] : ''));
    bar.append(h('div', { style: { position: 'absolute', left: (RAM / total * 100) + '%', top: 0, bottom: 0, width: '2px', background: 'var(--bad)', cursor: 'default' } }));
    const u = used();
    state.className = 'pill ' + (u <= RAM ? 'ok' : 'warn');
    state.textContent = u <= RAM ? 'Healthy' : 'Swapping: everything crawls';
    txt.textContent = `${u.toFixed(1)} GB used of ${RAM} GB RAM` + (u > RAM ? ` (+${(u - RAM).toFixed(1)} GB spilled to disk swap, right of the red line)` : '');
    logEl.innerHTML = logLines.map(l => `<div>${l}</div>`).join('');
  }
  $('#mem-ctl').append(...PROGS.map(([n, gb, c]) => h('button', { onclick: () => addProc(n, gb, c) }, `+ ${n} (${gb} GB)`)),
    h('button', { onclick: () => { procs = []; logLines.length = 0; drawMem(); } }, 'Reset'));
  drawMem();

  Quiz.mount('#quiz', [
    { q: 'What is the difference between a program and a process?', options: ['None', 'A program is a file of instructions; a process is a running instance with its own memory', 'A process is always faster', 'A program only runs on GPUs'], answer: 1, why: 'Run the same program twice and you get two processes.' },
    { q: 'You start a second copy of a 14 GB local chat-model server on a 16 GB laptop. What is most likely to happen?', options: ['It shares the first copy\'s memory for free', 'Each process has its own memory, so RAM runs out: heavy swapping and then the OOM killer', 'Nothing, the OS compresses it', 'The GPU takes over automatically'], answer: 1, why: 'Separate processes have separate memory (isolation). Two copies of the weights do not fit.' },
    { q: 'Your local chatbot prints just "Killed" while loading a model. What most likely happened?', options: ['A Python syntax error', 'The OS OOM killer terminated it because the machine ran out of RAM (and swap)', 'The GPU overheated', 'The network dropped'], answer: 1, why: 'Out-of-memory in system RAM is handled by the kernel, which kills a process without a Python traceback. Try a smaller or quantised model.' },
    { q: 'What is the downside of a very short time slice in round robin scheduling?', options: ['Processes start later', 'More context switches, so more time wasted on switching', 'Processes run in parallel', 'RAM fills up'], answer: 1, why: 'Every switch costs time that does no useful work.' },
    { q: 'You run Ubuntu inside WSL2 on a Windows laptop. Which statement is true?', options: ['It is Windows pretending to be Linux (an emulator), so Linux programs may behave differently', 'It is a real Linux kernel running in a lightweight virtual machine, so your shell and Linux tools work as on a Linux server', 'It only works without a GPU', 'It is macOS inside Windows'], answer: 1, why: 'WSL2 runs a genuine Linux kernel in a lightweight VM. For speed, keep your project files inside the Linux home folder rather than under /mnt/c.' },
    { q: 'Which pair of operating systems share the most Unix-style conventions (paths with /, similar shell commands, same permission model)?', options: ['Windows and macOS', 'macOS and Linux', 'Windows and Linux', 'None of them'], answer: 1, why: 'macOS and Linux both follow Unix/POSIX conventions; Windows comes from a different lineage.' },
  ]);
})();
