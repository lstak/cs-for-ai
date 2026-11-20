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


  // ---------- OS layers diagram (CLI path and GUI path meeting at the system calls) ----------
  (function () {
    const BOX = {
      you:   { x: 20,  y: 8,   w: 720, h: 40,  c: '#868e96', t: 'You', s: 'keyboard · mouse · screen' },
      term:  { x: 20,  y: 70,  w: 350, h: 52,  c: '#1098ad', t: 'Terminal', s: 'the window that shows text' },
      desk:  { x: 390, y: 70,  w: 350, h: 52,  c: '#9c36b5', t: 'Desktop & window system', s: 'windows · icons · mouse pointer' },
      shell: { x: 20,  y: 144, w: 350, h: 52,  c: '#0ca678', t: 'Shell', s: 'bash · zsh · PowerShell' },
      gui:   { x: 390, y: 144, w: 350, h: 126, c: '#be4bdb', t: 'GUI applications', s: 'file manager · browser · VS Code · Jupyter' },
      cmd:   { x: 20,  y: 218, w: 350, h: 52,  c: '#f08c00', t: 'Commands (programs)', s: 'ls · cat · grep · python · git' },
      api:   { x: 20,  y: 292, w: 720, h: 52,  c: '#e03131', t: 'System-call interface = the OS API', s: 'open · read · write · fork · exec · socket …' },
      kern:  { x: 20,  y: 366, w: 720, h: 46,  c: '#495057', t: 'Kernel', s: 'processes · memory · files · drivers · network stack' },
      hw:    { x: 20,  y: 430, w: 720, h: 40,  c: '#868e96', t: 'Hardware', s: 'CPU · RAM · SSD · GPU · display · keyboard · network card' },
    };
    const INFO = {
      you: 'You interact through <b>hardware</b>: keyboard, mouse or touch, and a screen (Module 9). Everything else is software reacting to what you do.',
      term: 'The <b>terminal</b> (terminal emulator) is an ordinary graphical program that draws a window of text. It sends the keys you press to the shell and shows the text that comes back. It has no idea what <code>ls</code> means. Examples: GNOME Terminal, iTerm2, Windows Terminal, the terminal pane in VS Code. (The name comes from old physical text terminals.)',
      shell: 'The <b>shell</b> reads the line you typed, understands it (splits it into a command and arguments, expands wildcards like <code>*.csv</code>, sets up pipes and redirection), finds the program via <code>PATH</code> and asks the OS to run it. It is also a small scripting language. Examples: bash and zsh (Linux, macOS, WSL2), PowerShell and cmd.exe (Windows). A few commands such as <code>cd</code> are built into the shell itself.',
      cmd: '<b>Commands</b> are ordinary programs, usually small and single-purpose: <code>ls</code> lists, <code>cat</code> prints, <code>grep</code> filters lines. Each runs as a process (section 2), reads <i>standard input</i>, writes <i>standard output</i>, and talks to the OS only through system calls. <code>python train.py</code> is a command too: a program that runs your program.',
      desk: 'The <b>desktop and window system</b> draws windows, icons and the pointer, and turns mouse and keyboard events into messages for the right window ("the user clicked this button"). Examples: the Windows desktop, macOS (Finder and the window server), GNOME or KDE on Linux. It is itself a program that uses the OS API and the GPU.',
      gui: '<b>GUI applications</b> are programs like commands, but they draw windows and react to clicks instead of reading and writing a text stream: a file manager, a browser, VS Code, a Jupyter notebook in a browser tab. To read a file or send data over the network they make the <b>same system calls</b> as a command does.',
      api: 'The <b>system-call interface</b> is the OS API: a fixed list of requests programs may make (<code>open</code>, <code>read</code>, <code>write</code>, <code>fork</code>, <code>execve</code>, <code>socket</code>, <code>chdir</code>…). A system call switches the CPU from user mode to kernel mode (Module 3) so the kernel can do something privileged on the program\'s behalf. Programs usually reach it through a library (the C library, Python\'s <code>os</code> module) rather than directly. Linux, macOS and Windows each have their own list, one reason software is not automatically portable between them.',
      kern: 'The <b>kernel</b> carries out the requests: it schedules processes (section 3), manages virtual memory (section 4), runs the file system, talks to devices through drivers, and runs the network protocols (Module 6). It checks permissions on every request.',
      hw: '<b>Hardware</b> does the physical work: the CPU runs instructions, RAM and the SSD hold data (Module 2), the GPU draws pixels and multiplies matrices (Module 3), and the network card sends signals. Only the kernel (and its drivers) talks to it directly.',
    };
    const TRACE = {
      cli: [
        { on: ['you'], t: '1. You type <code>ls</code> and press Enter. The keyboard raises an interrupt (Module 9) and the OS delivers the key presses to the terminal program.' },
        { on: ['term'], t: '2. The <b>terminal</b> receives the characters and passes them to the shell. (Later it will also draw whatever text comes back.)' },
        { on: ['shell'], t: '3. The <b>shell</b> reads the line, finds the program file <code>/usr/bin/ls</code> by searching the folders in <code>PATH</code>, and asks the OS to start it as a new process (<code>fork</code> + <code>execve</code>).' },
        { on: ['cmd'], t: '4. <code>ls</code> runs. It decides to "read the current folder" and does that by calling the OS: <code>openat()</code>, then <code>getdents64()</code> to read the directory entries.' },
        { on: ['api'], t: '5. Each call crosses the <b>system-call interface</b>: the CPU switches from user mode to kernel mode (Module 3). This is the only door to the hardware.' },
        { on: ['kern', 'hw'], t: '6. The <b>kernel</b> checks permissions, consults the file system and its cache in RAM, and if needed asks the SSD driver to read blocks (Module 2).' },
        { on: ['api', 'cmd'], t: '7. The names travel back up. <code>ls</code> formats them and writes them to its <b>standard output</b> with <code>write()</code>.' },
        { on: ['shell', 'term'], t: '8. The terminal receives the text and draws it; the shell prints a fresh prompt, ready for the next command.' },
        { on: ['you'], t: '9. You read the file names. Every step was a program asking the OS for a service.' },
      ],
      gui: [
        { on: ['you'], t: '1. You double-click the folder "Documents". The mouse button raises an interrupt (Module 9).' },
        { on: ['desk'], t: '2. The <b>desktop and window system</b> works out which window and icon are under the pointer and sends a "double-click on Documents" event to that application.' },
        { on: ['gui'], t: '3. The <b>file manager</b> decides "open this folder", and so it needs the list of files inside.' },
        { on: ['api'], t: '4. It asks the OS for the folder contents with <b>the same system calls</b> <code>ls</code> used: <code>openat()</code> and <code>getdents64()</code>, plus <code>stat()</code> calls for sizes, dates and file types.' },
        { on: ['kern', 'hw'], t: '5. Same kernel, same file system, same disk. The OS does not care whether a command or a window asked.' },
        { on: ['gui'], t: '6. The application turns the list into icons and a layout, using a graphics library.' },
        { on: ['desk', 'hw'], t: '7. It hands the picture to the window system, which combines all open windows and sends the result to the GPU and the display.' },
        { on: ['you'], t: '8. You see the icons. A different look and extra layers for input and drawing, but the same operating-system service underneath.' },
      ],
    };
    const rects = {};
    let mode = null, step = -1, sel = null;
    const svg = sv('svg', { viewBox: '0 0 760 482', width: '100%', role: 'img', 'aria-label': 'Layers of an operating system: terminal, shell and commands on one side, desktop and GUI applications on the other, both on top of the system-call interface, the kernel and the hardware' });
    const txt = (x, y, str, size, bold, anchor, muted) => sv('text', { x, y, 'font-size': size, 'font-weight': bold ? 700 : 400, fill: 'currentColor', 'text-anchor': anchor || 'middle', 'fill-opacity': muted ? 0.65 : 1, style: 'pointer-events:none' }, str);
    for (const [id, b] of Object.entries(BOX)) {
      const g = sv('g', { style: 'cursor:pointer' });
      const r = sv('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 9, fill: b.c, 'fill-opacity': 0.16, stroke: b.c, 'stroke-width': 2 });
      g.append(r, txt(b.x + b.w / 2, b.y + b.h / 2 - 3, b.t, 14, true), txt(b.x + b.w / 2, b.y + b.h / 2 + 13, b.s, 11.5, false));
      g.addEventListener('click', () => { mode = null; step = -1; sel = id; draw(); });
      rects[id] = r; svg.append(g);
    }
    const arrow = (x, y1, y2) => svg.append(sv('line', { x1: x, y1, x2: x, y2: y2 - 5, stroke: '#868e96', 'stroke-width': 2 }), sv('polygon', { points: `${x - 4},${y2 - 7} ${x + 4},${y2 - 7} ${x},${y2}`, fill: '#868e96' }));
    arrow(195, 48, 70); arrow(565, 48, 70); arrow(195, 122, 144); arrow(565, 122, 144); arrow(195, 196, 218);
    arrow(195, 270, 292); arrow(565, 270, 292); arrow(380, 344, 366); arrow(380, 412, 430);
    svg.append(txt(30, 63, 'text path: you type commands', 11.5, false, 'start', true), txt(400, 63, 'graphical path: you point and click', 11.5, false, 'start', true),
      txt(392, 360, 'requests go down, results come back up', 11.5, false, 'start', true));
    $('#stk-svg').append(svg);
    const panel = $('#stk-panel');
    function draw() {
      const active = mode ? TRACE[mode][step].on : [];
      for (const [id, r] of Object.entries(rects)) {
        r.setAttribute('fill-opacity', active.includes(id) ? 0.6 : (!mode && sel === id) ? 0.4 : 0.16);
        r.setAttribute('stroke-width', active.includes(id) || (!mode && sel === id) ? 4 : 2);
      }
      if (mode) panel.innerHTML = TRACE[mode][step].t + (step === TRACE[mode].length - 1 ? '<div style="margin-top:6px"><b>Both paths end in the same system calls.</b> Try the other trace to compare.</div>' : '');
      else if (sel) panel.innerHTML = INFO[sel];
      else panel.textContent = 'Click a layer, or start a trace.';
    }
    const start = m => { mode = m; step = 0; sel = null; draw(); };
    $('#stk-ctl').append(
      h('button', { class: 'primary', onclick: () => start('cli') }, 'Trace: type ls in a terminal'),
      h('button', { class: 'primary', onclick: () => start('gui') }, 'Trace: double-click a folder'),
      h('button', { onclick: () => { if (mode && step < TRACE[mode].length - 1) { step++; draw(); } } }, 'Next step'),
      h('button', { onclick: () => { mode = null; step = -1; sel = null; draw(); } }, 'Reset'));
    draw();
  })();

  // ---------- Mini shell: ls, cat, grep, ... on a pretend file system, with the system calls underneath ----------
  (function () {
    const HOME = '/home/ada';
    const FILES = {
      '/home/ada/notes.txt': 'buy milk\nlearn SQL\nbuy coffee\ncall Bo\n',
      '/home/ada/todo.md': '# Todo\n- finish module 4\n- try grep\n',
      '/home/ada/data/requests.csv': 'id,user,model,tokens,status\n1,ada,small,120,ok\n2,bo,large,800,ok\n3,ada,small,95,ok\n4,cy,large,410,error\n5,bo,small,60,error\n',
      '/home/ada/data/server.log': 'INFO start\nINFO request 1 ok\nERROR timeout request 4\nINFO request 5\nERROR out of memory\nINFO stop\n',
      '/home/ada/models/tiny.gguf': { binary: 4200000000 },
    };
    const DIRS = new Set(['/', '/home', '/home/ada', '/home/ada/data', '/home/ada/models']);
    let cwd = HOME, history = [];
    const parentOf = p => p.slice(0, p.lastIndexOf('/')) || '/';
    const isDir = p => DIRS.has(p), isFile = p => p in FILES;
    const sizeOf = p => { const v = FILES[p]; return typeof v === 'string' ? v.length : v.binary; };
    const resolve = p => {
      if (p === undefined || p === '') return cwd;
      if (p === '~') p = HOME; else if (p.startsWith('~/')) p = HOME + p.slice(1);
      const out = [];
      for (const x of (p.startsWith('/') ? p : cwd + '/' + p).split('/')) { if (!x || x === '.') continue; if (x === '..') out.pop(); else out.push(x); }
      return '/' + out.join('/');
    };
    const listDir = d => [...DIRS, ...Object.keys(FILES)].filter(x => x !== '/' && parentOf(x) === d).map(x => x.split('/').pop()).sort();
    const prompt = () => 'ada@pc:' + (cwd === HOME ? '~' : cwd.startsWith(HOME + '/') ? '~' + cwd.slice(HOME.length) : cwd) + '$ ';

    function tokenize(line) {
      const toks = [], re = /"([^"]*)"|'([^']*)'|(>>|>|\|)|([^\s|>"']+)/g; let m;
      while ((m = re.exec(line))) {
        if (m[3]) toks.push({ op: m[3] });
        else if (m[1] !== undefined) toks.push({ v: m[1], q: true });
        else if (m[2] !== undefined) toks.push({ v: m[2], q: true });
        else toks.push({ v: m[4] });
      }
      return toks;
    }
    function expand(t) {       // wildcard expansion: done by the SHELL, before the command starts
      if (t.q || !t.v.includes('*')) return [t.v];
      const slash = t.v.lastIndexOf('/') + 1, dirPart = t.v.slice(0, slash), pat = t.v.slice(slash);
      const re = new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      const hits = isDir(resolve(dirPart || '.')) ? listDir(resolve(dirPart || '.')).filter(n => re.test(n)) : [];
      return hits.length ? hits.map(n => dirPart + n) : [t.v];
    }
    const lines = s => { const a = s.split('\n'); if (a[a.length - 1] === '') a.pop(); return a; };
    const flagsOf = args => args.filter(a => /^-[a-zA-Z0-9]+$/.test(a) && !/^-\d+$/.test(a));
    const ext = (name, extra) => ['shell: fork() + execve("/usr/bin/' + name + '")'].concat(extra);

    function exec(words, stdin) {
      const cmd = words[0], args = words.slice(1), R = { out: '', err: '', code: 0, hood: [] };
      const rest = args.filter(a => !(/^-[a-zA-Z]+$/.test(a)));
      const fl = flagsOf(args).join('').replace(/-/g, '');
      const readFiles = (names, who) => {
        let text = '', per = [];
        for (const f of names) {
          const p = resolve(f);
          if (isDir(p)) { R.err += `${who}: ${f}: Is a directory\n`; R.code = 1; }
          else if (!isFile(p)) { R.err += `${who}: ${f}: No such file or directory\n`; R.code = who === 'grep' ? 2 : 1; }
          else if (typeof FILES[p] !== 'string') { R.err += `${who}: ${f}: binary file (content not shown in this demo)\n`; R.code = 1; }
          else { text += FILES[p]; per.push([f, FILES[p]]); R.hood.push(`openat("${f}", O_RDONLY) = 3`, 'read(3, …)', 'close(3)'); }
        }
        return { text, per };
      };
      switch (cmd) {
        case 'pwd': R.out = cwd + '\n'; R.hood = ['shell (builtin: no new process)', `getcwd() = "${cwd}"`, 'write(1, …)']; break;
        case 'cd': {
          const p = resolve(args[0] === undefined ? '~' : args[0]);
          R.hood = ['shell (builtin: no new process, because a child cannot change its parent\'s folder)'];
          if (isDir(p)) { cwd = p; R.hood.push(`chdir("${p}") = 0`); } else { R.err = `cd: ${args[0]}: No such file or directory\n`; R.code = 1; R.hood.push(`chdir("${p}") = -1 ENOENT`); }
          break;
        }
        case 'echo': R.out = args.join(' ') + '\n'; R.hood = ['shell (builtin: no new process)', 'write(1, "…")']; break;
        case 'ls': {
          const targets = rest.length ? rest : ['.'], long = fl.includes('l');
          let nstat = 0;
          targets.forEach((a, i) => {
            const p = resolve(a);
            if (!isDir(p) && !isFile(p)) { R.err += `ls: cannot access '${a}': No such file or directory\n`; R.code = 2; return; }
            const names = isDir(p) ? listDir(p) : [p.split('/').pop()];
            if (targets.length > 1) R.out += (i ? '\n' : '') + a + ':\n';
            if (isDir(p)) R.hood.push(`openat("${a}", O_RDONLY|O_DIRECTORY) = 3`, 'getdents64(3, …)  ← the entries of the directory');
            else R.hood.push(`newfstatat("${a}", …)  ← it is a file, so ls just reports on it`);
            if (long) {
              names.forEach(n => {
                const q = isDir(p) ? (p === '/' ? '' : p) + '/' + n : p, d = isDir(q);
                R.out += `${d ? 'drwxr-xr-x' : '-rw-r--r--'} ada ada ${String(d ? 4096 : sizeOf(q)).padStart(10)} ${n}${d ? '/' : ''}\n`; nstat++;
              });
            } else R.out += names.map(n => n + (isDir((p === '/' ? '' : p) + '/' + n) ? '/' : '')).join('  ') + '\n';
          });
          if (nstat) R.hood.push(`newfstatat() × ${nstat}  ← size, owner and permissions of each entry`);
          R.hood.push('write(1, …)'); R.hood = ext('ls', R.hood); break;
        }
        case 'cat': {
          if (!rest.length) { if (stdin === null) { R.err = 'cat: no file given (this demo cannot read the keyboard)\n'; R.code = 1; R.hood = ext('cat', []); break; } R.out = stdin; R.hood = ext('cat', ['read(0, …)  ← stdin (a pipe)', 'write(1, …)']); break; }
          const r = readFiles(rest, 'cat'); R.out = r.text; R.hood = ext('cat', R.hood.concat(['write(1, …)'])); break;
        }
        case 'head': case 'tail': {
          let n = 10; const ni = args.indexOf('-n'); if (ni >= 0 && args[ni + 1]) n = parseInt(args[ni + 1], 10) || 10;
          const dash = args.find(a => /^-\d+$/.test(a)); if (dash) n = Math.abs(parseInt(dash, 10));
          const files = rest.filter(a => a !== args[ni + 1] || ni < 0);
          let text; if (files.length) { text = readFiles(files, cmd).text; } else if (stdin !== null) { text = stdin; R.hood.push('read(0, …)  ← stdin'); } else { R.err = `${cmd}: no file given\n`; R.code = 1; text = ''; }
          const ls = lines(text); R.out = (cmd === 'head' ? ls.slice(0, n) : ls.slice(-n)).map(x => x + '\n').join('');
          R.hood = ext(cmd, R.hood.concat(['write(1, …)'])); break;
        }
        case 'grep': {
          const pat = rest[0]; if (pat === undefined) { R.err = 'grep: no pattern given\n'; R.code = 2; R.hood = ext('grep', []); break; }
          let re; try { re = new RegExp(pat, fl.includes('i') ? 'i' : ''); } catch (e) { re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), fl.includes('i') ? 'i' : ''); }
          const files = rest.slice(1); let sources;
          if (files.length) { sources = readFiles(files, 'grep').per; } else if (stdin !== null) { sources = [['', stdin]]; R.hood.push('read(0, …)  ← stdin (a pipe)'); } else { R.err = 'grep: no input (give a file or pipe something in)\n'; R.code = 2; sources = []; }
          let total = 0;
          for (const [name, text] of sources) {
            const pre = files.length > 1 ? name + ':' : '';
            let cnt = 0;
            lines(text).forEach((l, i) => {
              const hit = re.test(l) !== fl.includes('v'); if (!hit) return; cnt++;
              if (!fl.includes('c')) R.out += pre + (fl.includes('n') ? (i + 1) + ':' : '') + l + '\n';
            });
            if (fl.includes('c')) R.out += pre + cnt + '\n';
            total += cnt;
          }
          if (total === 0 && !R.err) R.code = 1;
          R.hood = ext('grep', R.hood.concat(['write(1, …)  ← only the matching lines'])); break;
        }
        case 'wc': {
          let text; const files = rest;
          if (files.length) text = readFiles(files, 'wc').text; else if (stdin !== null) { text = stdin; R.hood.push('read(0, …)  ← stdin'); } else { R.err = 'wc: no input\n'; R.code = 1; text = ''; }
          const nl = (text.match(/\n/g) || []).length, nw = text.split(/\s+/).filter(Boolean).length;
          R.out = (fl.includes('l') ? nl : `${nl} ${nw} ${text.length}`) + (files.length === 1 ? ' ' + files[0] : '') + '\n';
          R.hood = ext('wc', R.hood.concat(['write(1, …)'])); break;
        }
        case 'sort': {
          let text; if (rest.length) text = readFiles(rest, 'sort').text; else if (stdin !== null) { text = stdin; R.hood.push('read(0, …)  ← stdin'); } else { R.err = 'sort: no input\n'; R.code = 1; text = ''; }
          const ls = lines(text).sort(); if (fl.includes('r')) ls.reverse(); R.out = ls.map(x => x + '\n').join('');
          R.hood = ext('sort', R.hood.concat(['write(1, …)'])); break;
        }
        case 'help': R.out = 'Commands in this demo: pwd, cd, ls [-l], cat, head [-n N], tail [-n N], grep [-i -n -c -v] PATTERN [FILE], wc [-l], sort [-r], echo, clear.\nOperators: | (pipe)  > (write to file)  >> (append)  * (wildcard)\n'; R.hood = ['shell (builtin)']; break;
        default: R.err = `${cmd}: command not found\n`; R.code = 127; R.hood = ['shell: searched every folder in PATH for "' + cmd + '" and found nothing → "command not found" (exit status 127)'];
      }
      return R;
    }
    function runLine(line) {
      const toks = tokenize(line), segs = [[]];
      for (const t of toks) { if (t.op === '|') segs.push([]); else segs[segs.length - 1].push(t); }
      const synt = m => ({ out: '', err: 'shell: syntax error ' + m + '\n', code: 2, hood: [] });
      if (segs.some(s => s.length === 0)) return synt('near "|"');
      let input = null, errAll = '', hood = [], last = { out: '', code: 0 }, prevName = '';
      for (let i = 0; i < segs.length; i++) {
        let seg = segs[i], redirect = null;
        const ri = seg.findIndex(t => t.op === '>' || t.op === '>>');
        if (ri >= 0) { const tgt = seg[ri + 1]; if (!tgt || tgt.op) return synt('near ">"'); redirect = { file: tgt.v, append: seg[ri].op === '>>' }; seg = seg.slice(0, ri).concat(seg.slice(ri + 2)); }
        const words = []; for (const t of seg) { if (t.op) return synt('near unexpected token'); words.push(...expand(t)); }
        if (!words.length) return synt('(missing command)');
        if (i > 0) hood.push(`pipe() + dup2(): stdout of "${prevName}" is connected to stdin of "${words[0]}"`);
        const r = exec(words, input);
        errAll += r.err; last = r; prevName = words[0];
        let rh = r.hood.slice();
        if (redirect) {
          const p = resolve(redirect.file);
          if (!isDir(parentOf(p)) || isDir(p)) { errAll += `shell: ${redirect.file}: cannot write there\n`; last = { out: '', code: 1 }; }
          else {
            FILES[p] = (redirect.append && typeof FILES[p] === 'string' ? FILES[p] : '') + r.out;
            // the shell opens the file and rewires stdout BEFORE the command runs, so these come first
            rh = rh.slice(0, 1).concat([`openat("${redirect.file}", O_WRONLY|O_CREAT|${redirect.append ? 'O_APPEND' : 'O_TRUNC'}) = 3`, 'dup2(3, 1)  ← stdout now goes to the file, not the screen'], rh.slice(1));
            last = { out: '', code: r.code };
          }
        }
        hood.push(`── ${words.join(' ')}`, ...rh.map(x => '   ' + x));
        input = last.out;
      }
      return { out: last.out, err: errAll, code: last.code, hood };
    }
    const outEl = $('#sh-out'), inEl = $('#sh-in'), promptEl = $('#sh-prompt');
    function render() {
      promptEl.textContent = prompt();
      outEl.innerHTML = '';
      history.slice(-6).forEach(e => {
        outEl.append(h('div', { style: { margin: '8px 0', paddingBottom: '6px', borderBottom: '1px dashed #868e96' } },
          h('div', { class: 'mono', style: { fontWeight: '700' } }, e.prompt + e.cmd),
          e.out ? h('div', { class: 'mono', style: { whiteSpace: 'pre-wrap', fontSize: '13px' } }, e.out.replace(/\n$/, '')) : null,
          e.err ? h('div', { class: 'mono', style: { whiteSpace: 'pre-wrap', fontSize: '13px', color: '#e03131' } }, e.err.replace(/\n$/, '')) : null,
          e.code ? h('div', { style: { fontSize: '12px', color: 'var(--muted)' } }, `(exit status ${e.code})`) : null,
          e.hood.length ? h('details', { style: { fontSize: '12.5px', color: 'var(--muted)' } }, h('summary', {}, 'What the OS did underneath'), h('div', { class: 'mono', style: { whiteSpace: 'pre-wrap', fontSize: '12px' } }, e.hood.join('\n'))) : null));
      });
      if (!history.length) outEl.append(h('div', { class: 'readout' }, 'Type a command and press Enter, or use a preset.'));
    }
    function run(cmdLine) {
      const line = (cmdLine !== undefined ? cmdLine : inEl.value).trim(); if (!line) return;
      if (line === 'clear') { history = []; inEl.value = ''; render(); return; }
      const p = prompt(), r = runLine(line);
      history.push({ prompt: p, cmd: line, out: r.out, err: r.err, code: r.code, hood: r.hood });
      inEl.value = ''; render();
    }
    inEl.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
    $('#sh-run').addEventListener('click', () => run());
    $('#sh-clear').addEventListener('click', () => { history = []; render(); });
    ['ls -l', 'cat notes.txt', 'grep -n buy notes.txt', 'grep ERROR data/server.log', 'cat data/server.log | grep ERROR | wc -l', 'grep -c error data/requests.csv', 'ls *.txt', 'cd data', 'echo hello > hello.txt', 'ls -l ~', 'cat missing.txt']
      .forEach(c => $('#sh-presets').append(h('button', { class: 'sm', onclick: () => run(c) }, c)));
    render();
  })();

  Quiz.mount('#quiz', [
    { q: 'What is the difference between a program and a process?', options: ['None', 'A program is a file of instructions; a process is a running instance with its own memory', 'A process is always faster', 'A program only runs on GPUs'], answer: 1, why: 'Run the same program twice and you get two processes.' },
    { q: 'You start a second copy of a 14 GB local chat-model server on a 16 GB laptop. What is most likely to happen?', options: ['It shares the first copy\'s memory for free', 'Each process has its own memory, so RAM runs out: heavy swapping and then the OOM killer', 'Nothing, the OS compresses it', 'The GPU takes over automatically'], answer: 1, why: 'Separate processes have separate memory (isolation). Two copies of the weights do not fit.' },
    { q: 'Your local chatbot prints just "Killed" while loading a model. What most likely happened?', options: ['A Python syntax error', 'The OS OOM killer terminated it because the machine ran out of RAM (and swap)', 'The GPU overheated', 'The network dropped'], answer: 1, why: 'Out-of-memory in system RAM is handled by the kernel, which kills a process without a Python traceback. Try a smaller or quantised model.' },
    { q: 'What is the downside of a very short time slice in round robin scheduling?', options: ['Processes start later', 'More context switches, so more time wasted on switching', 'Processes run in parallel', 'RAM fills up'], answer: 1, why: 'Every switch costs time that does no useful work.' },
    { q: 'What is the "OS API" that programs use to ask the kernel for services?', options: ['The graphical desktop', 'The set of system calls (open, read, write, fork, execve, socket…)', 'The shell', 'The terminal window'], answer: 1, why: 'System calls are the official menu of requests to the kernel. Commands, shells and GUI applications all sit on top of them.' },
    { q: 'What is the difference between a terminal and a shell?', options: ['They are the same program', 'The terminal is the window that sends keystrokes and shows text; the shell is the program that interprets your commands and starts other programs', 'The shell draws windows; the terminal runs programs', 'The terminal is part of the kernel'], answer: 1, why: 'Terminal = the text window. Shell = the command interpreter running inside it (bash, zsh, PowerShell).' },
    { q: 'What does  cat server.log | grep ERROR | wc -l  do?', options: ['Deletes all ERROR lines', 'Prints the log, keeps only lines containing ERROR, and counts them', 'Counts the words in the file', 'Sorts the log by error type'], answer: 1, why: 'Each | connects one command\'s stdout to the next one\'s stdin: print, filter, count lines.' },
    { q: 'A graphical file manager and the command ls both list a folder. What do they have in common?', options: ['Nothing, they use different parts of the computer', 'Both ask the kernel for the directory contents through the same system calls', 'ls is just a GUI', 'Only ls uses the hard disk'], answer: 1, why: 'The GUI adds layers for mouse input and drawing, but the file listing comes from the same OS service.' },
    { q: 'You type  ls *.csv . Who turns *.csv into a list of file names?', options: ['The ls program', 'The shell, before ls starts', 'The kernel', 'The terminal'], answer: 1, why: 'Wildcard expansion (globbing) is done by the shell. ls only sees the resulting list of names.' },
    { q: 'You run a "cd" command through the shell. Why is cd built into the shell rather than being a separate program?', options: ['It was too small to be a program', 'A separate program is a child process and cannot change its parent\'s current folder', 'Because Windows needs it', 'Because it uses the GPU'], answer: 1, why: 'Only the shell process itself can change the shell\'s own working directory.' },
    { q: 'You run Ubuntu inside WSL2 on a Windows laptop. Which statement is true?', options: ['It is Windows pretending to be Linux (an emulator), so Linux programs may behave differently', 'It is a real Linux kernel running in a lightweight virtual machine, so your shell and Linux tools work as on a Linux server', 'It only works without a GPU', 'It is macOS inside Windows'], answer: 1, why: 'WSL2 runs a genuine Linux kernel in a lightweight VM. For speed, keep your project files inside the Linux home folder rather than under /mnt/c.' },
    { q: 'Which pair of operating systems share the most Unix-style conventions (paths with /, similar shell commands, same permission model)?', options: ['Windows and macOS', 'macOS and Linux', 'Windows and Linux', 'None of them'], answer: 1, why: 'macOS and Linux both follow Unix/POSIX conventions; Windows comes from a different lineage.' },
  ]);
})();
