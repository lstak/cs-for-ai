/* Module 5 widget: software stack stepper */
(function () {
  const LAYERS = ['Your Python code', 'Python interpreter (CPython)', 'Library (NumPy / PyTorch / requests)', 'Compiled code (C / C++ / CUDA kernels)', 'Operating system & drivers', 'Hardware'];
  const EX = {
    'c = a + b   (two ints)': [
      'You write a plain Python statement.',
      'Bytecode is generated; the interpreter loops over it, checking that both are ints.',
      null,
      'The interpreter\'s own C code performs the addition on the Python int objects.',
      null,
      'The CPU executes an ADD instruction in a register. Result goes back to RAM via caches.'],
    'y = x @ w   (PyTorch tensors on GPU)': [
      'One line: a matrix multiply.',
      'The interpreter calls <code>Tensor.__matmul__</code>: a single Python-level call.',
      'PyTorch picks the right implementation (dtype, device, shapes) via its dispatcher.',
      'A pre-compiled CUDA kernel from cuBLAS is <i>queued</i> on the GPU. Python continues without waiting (asynchronous).',
      'The NVIDIA driver submits the work to the GPU through the OS, over PCIe.',
      'Thousands of GPU cores multiply tile by tile, reading from VRAM (HBM).'],
    'reply = model.generate(prompt)   (local chatbot)': [
      'You ask a locally running model to continue some text.',
      'The interpreter calls the library function: just one Python-level call.',
      'The AI library (e.g. transformers/PyTorch) turns the text into token ids (Module 11) and starts the generation loop.',
      'For <b>every new token</b>, compiled GPU kernels (matrix multiplies, Module 3) run through all the layers. The loop repeats until the reply is done.',
      'The driver submits each batch of GPU work; the OS manages the process and its memory (Module 4).',
      'The GPU reads the weights from VRAM and multiplies; the chosen token comes back; the next one begins.'],
    'data = open("f.csv").read()': [
      'You ask for a file\'s contents.',
      'The interpreter calls the built-in <code>open</code> and <code>read</code>.',
      null,
      'Python\'s C code issues a <b>system call</b> (<code>read</code>).',
      'The kernel checks permissions, finds the file via the filesystem, checks the page cache in RAM, and, if missing, asks the SSD driver.',
      'The SSD controller fetches blocks and DMA copies them into RAM.'],
    'r = requests.get(url)': [
      'You fetch a web page / call an API.',
      'The interpreter runs the library code.',
      '<code>requests</code> / <code>urllib3</code> build the HTTP request, handle redirects, TLS.',
      'Python\'s C <code>socket</code> and <code>ssl</code> modules make system calls.',
      'The kernel\'s TCP/IP stack splits data into packets; the network driver hands them to the NIC.',
      'The network card turns bytes into electrical/optical/radio signals (Module 6).'],
  };
  const stk = $('#stk'), note = $('#stk-note'), ctl = $('#stk-ctl');
  let cur = Object.keys(EX)[0], step = -1, timer = null;
  const sel = h('select', {}, Object.keys(EX).map(k => h('option', { value: k }, k)));
  sel.onchange = () => { cur = sel.value; reset(); };
  function nextIdx(from) { for (let i = from + 1; i < LAYERS.length; i++) if (EX[cur][i]) return i; return -1; }
  function draw() {
    stk.innerHTML = '';
    LAYERS.forEach((name, i) => {
      const used = !!EX[cur][i];
      stk.append(h('div', { class: 'layer ' + (!used ? 'skip' : i === step ? 'active' : i < step ? 'past' : '') },
        h('b', {}, `${i + 1}. ${name}`)));
    });
    const lines = $$('.layer', stk);
    if (step >= 0) { const d = h('div', { style: { fontSize: '15px', marginTop: '4px' } }); d.innerHTML = EX[cur][step]; lines[step].append(d); }
    note.innerHTML = step < 0 ? 'Press <b>Step</b> to start the journey.' : nextIdx(step) < 0 ? '✅ Reached the hardware. The result travels back up the same stack.' : 'Layer ' + (step + 1) + ' of ' + LAYERS.length + '.';
  }
  function reset() { clearInterval(timer); step = -1; draw(); }
  function advance() { const n = nextIdx(step); if (n >= 0) { step = n; draw(); return true; } return false; }
  ctl.append(h('label', { class: 'ctl' }, h('span', {}, 'Example'), sel), h('button', { class: 'primary', onclick: () => { clearInterval(timer); if (step >= 0 && nextIdx(step) < 0) step = -1; advance(); } }, 'Step ▶'),
    h('button', { onclick: () => { reset(); advance(); timer = setInterval(() => { if (!advance()) clearInterval(timer); }, 1100); } }, 'Auto-play'), h('button', { onclick: reset }, 'Reset'));
  draw();

  Quiz.mount('#quiz', [
    { q: 'Why is a Python for-loop over a million numbers much slower than the equivalent NumPy call?', options: ['Python cannot do arithmetic', 'The interpreter does extra work per element; NumPy makes one call into optimised compiled code', 'NumPy uses the GPU always', 'Loops are not allowed in Python'], answer: 1, why: 'Per-element interpreter overhead dominates. Vectorise.' },
    { q: 'What is "a model" as a file on your disk?', options: ['A program that runs by itself', 'A big file of learned numbers (weights) plus some configuration; separate software (a framework or inference engine) must run it', 'A database of the training text', 'A video'], answer: 1, why: 'The weights are just numbers. A library or engine knows how to turn them into answers.' },
    { q: 'Which layer is responsible if a chatbot gives a confident but wrong answer, although nothing crashed?', options: ['The operating system', 'The GPU driver', 'None of the computer layers; it is a limitation of the model itself', 'The virtual environment'], answer: 2, why: 'The computer did its job correctly. Wrong answers come from how models work (Module 11).' },
    { q: 'What does a virtual environment solve?', options: ['It makes code faster', 'Different projects can use different, isolated versions of packages', 'It encrypts your code', 'It gives you more RAM'], answer: 1, why: 'Dependency conflicts between projects.' },
    { q: '`torch.cuda.is_available()` returns False on a machine with an NVIDIA GPU. Which layer should you suspect first?', options: ['Your model architecture', 'Driver / CUDA / PyTorch build compatibility', 'The training data', 'The learning rate'], answer: 1, why: 'The GPU stack layers must match: a CPU-only PyTorch build or an old driver is typical.' },
    { q: 'What is a Docker container, roughly?', options: ['A full virtual computer with its own kernel', 'An isolated bundle of an app plus its libraries that shares the host\'s kernel', 'A type of GPU', 'A Python package'], answer: 1, why: 'Lightweight and reproducible; shares the host OS kernel, unlike a full VM.' },
  ]);
})();
