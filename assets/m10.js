/* Module 10 widgets: "follow one chat message" stepper and "timeline of one chat request" model (illustrative numbers) */
(function () {
  // ---------- Stepper ----------
  const STEPS = [
    { t: 'You type a question and press Enter', layer: 'Peripherals · OS', mod: 'Modules 9, 4',
      x: 'The keyboard sends an electrical signal; an <b>interrupt</b> wakes the CPU, and the <b>operating system</b> hands the key to the browser <b>process</b>. The browser draws your text on the screen through the GPU and display.' },
    { t: 'The app builds a request', layer: 'Software · Data', mod: 'Modules 7, 5, 1',
      x: 'App code (JavaScript or Python) packs the <b>whole conversation so far</b> plus settings (model name, maximum length, temperature) into a small <b>JSON</b> text, and adds your secret <b>API key</b>. Text is bytes (UTF-8).' },
    { t: 'Across the network', layer: 'Networking', mod: 'Module 6',
      x: '<b>DNS</b> finds the server\'s address; <b>TCP</b> and <b>TLS</b> handshakes open an encrypted connection (reused if already open); the request travels as <b>packets</b> through routers. Distance costs time: about 1 ms of round trip per 100 km.' },
    { t: 'The provider\'s front door', layer: 'Cloud', mod: 'Modules 12, 4, 5',
      x: 'A <b>load balancer</b> in a data-centre <b>region</b> checks your key and your rate limit (too many requests → <code>429</code>), puts the request in a <b>queue</b> and routes it to a GPU server: a Linux machine running the model inside a <b>container</b>.' },
    { t: 'Text becomes numbers', layer: 'Model input', mod: 'Modules 1, 11',
      x: 'A <b>tokenizer</b> chops the text into tokens and replaces them with integer ids. Each id is looked up to get its <b>embedding</b>, a list of numbers. Token counts decide the bill and whether you exceed the <b>context window</b>.' },
    { t: 'The weights are already waiting', layer: 'Memory', mod: 'Module 2',
      x: 'The model\'s billions of weights were loaded long ago from disk → RAM → <b>GPU memory</b> and stay there between requests. A big model is spread over several GPUs. (A "cold start" that has to load them first adds many seconds.)' },
    { t: 'Reading your prompt ("prefill")', layer: 'GPU compute', mod: 'Module 3',
      x: 'All the prompt tokens are pushed through the layers <b>at the same time</b>: huge matrix multiplications, which is what GPUs are best at. This must finish before the first word can be written, so a longer prompt means a longer wait.' },
    { t: 'Writing the reply, one token at a time', layer: 'GPU + model', mod: 'Modules 3, 11',
      x: 'For <b>each new token</b>: read all the weights from GPU memory, compute probabilities for the next token, <b>sample</b> one (temperature, Module 11), append it, repeat. The cost per token is mostly memory bandwidth, so speed is steady, perhaps tens of tokens per second.' },
    { t: 'Streaming back', layer: 'Networking', mod: 'Module 6',
      x: 'As soon as a token exists, its text is sent back over the still-open connection. You do not wait for the whole answer.' },
    { t: 'Maybe: the model asks for a tool', layer: 'Agent', mod: 'Module 13',
      x: 'If the model emitted a tool request (search, read a file, run code), the <b>app</b> runs it and sends the result back as a new request. Steps 2–9 repeat, then the final answer arrives.' },
    { t: 'Words appear on your screen', layer: 'Browser · Peripherals', mod: 'Modules 7, 9, 4',
      x: 'The JavaScript on the page appends each piece to the <b>DOM</b> (Module 7); the browser repaints and the GPU redraws the screen. In a voice assistant a text-to-speech model turns the same words into audio samples for the speaker.' },
    { t: 'Afterwards', layer: 'Cloud · App', mod: 'Modules 12, 11',
      x: 'The provider counts input and output tokens for your bill and logs usage. The model has <b>not</b> learned from your chat (its weights are frozen). Your app keeps the conversation text, which is the only "memory", and will send it again next time.' },
  ];
  let shown = 0;
  const log = $('#st-log');
  function box(i, s, last) {
    return h('div', { style: { borderLeft: '4px solid ' + (last ? '#f08c00' : '#3b5bdb'), background: 'rgba(128,128,128,.08)', padding: '6px 10px', margin: '6px 0', borderRadius: '4px' } },
      h('div', { style: { fontSize: '12px', fontWeight: '700', color: last ? '#f08c00' : '#3b5bdb' } }, `${i + 1}. ${s.layer} · ${s.mod}`),
      h('div', { style: { fontWeight: '600' } }, s.t),
      (() => { const d = h('div', { style: { fontSize: '14px' } }); d.innerHTML = s.x; return d; })());
  }
  function drawSteps() {
    log.innerHTML = '';
    STEPS.slice(0, shown).forEach((s, i) => log.append(box(i, s, i === shown - 1)));
    if (!shown) log.append(h('div', { class: 'readout' }, 'Press "Next step" to start following the message.'));
  }
  $('#st-ctl').append(
    h('button', { class: 'primary', onclick: () => { if (shown < STEPS.length) { shown++; drawSteps(); } } }, 'Next step'),
    h('button', { onclick: () => { shown = STEPS.length; drawSteps(); } }, 'Show all'),
    h('button', { onclick: () => { shown = 0; drawSteps(); } }, 'Reset'));
  drawSteps();

  // ---------- Timeline model ----------
  const MODELS = { '7B (small)': 7e9, '70B (large)': 70e9, '400B (very large)': 400e9 };
  const FORMATS = { '16-bit (fp16)': 2, '8-bit': 1, '4-bit': 0.5 };
  const GPU_MEM = 64e9;      // usable bytes per GPU after leaving room for the conversation
  const GPU_BW = 1e12;       // usable memory bandwidth per GPU, bytes/s
  const GPU_FLOPS = 150e12;         // 150 TFLOP/s usable per GPU
  const S = { model: '7B (small)', fmt: '16-bit (fp16)', km: 1000, prompt: 1000, answer: 300, queue: 100, reuse: true };
  const bars = $('#tl-bars'), out = $('#tl-out');
  const num = v => Math.round(v).toLocaleString('en-US');

  function drawTl() {
    const params = MODELS[S.model], wbytes = params * FORMATS[S.fmt];
    const gpus = Math.max(1, Math.ceil(wbytes / GPU_MEM));
    const rtt = S.km / 100 / 1000 + 0.02;                    // seconds: ~1 ms per 100 km round trip + 20 ms of equipment
    const setup = S.reuse ? 0 : 0.02 + 2 * rtt;              // DNS (~20 ms) + TCP + TLS (1 RTT each)
    const queue = S.queue / 1000;
    const prefill = S.prompt * 2 * params / (gpus * GPU_FLOPS);
    const perTok = wbytes / (gpus * GPU_BW);
    const write = S.answer * perTok;
    const ttft = setup + rtt + queue + prefill + perTok;
    const total = ttft + (S.answer - 1) * perTok;
    const stages = [
      ['Connection setup', setup], ['Network: request + response', rtt], ['Waiting in the queue', queue],
      ['Reading the prompt (prefill)', prefill], ['Writing the answer', write]];
    const max = Math.max(...stages.map(s => s[1]), 1e-3);
    renderBars(bars, stages.map(([l, v]) => ({ label: l, value: v / max, text: fmtTime(Math.max(v, 1e-6)), cls: '' })));
    out.innerHTML = `<div><b>Hardware needed:</b> weights = ${fmtBytes(wbytes)} → <b>${gpus} GPU${gpus > 1 ? 's' : ''}</b> (80 GB class).</div>
      <div><b>First word appears after ≈ ${fmtTime(ttft)}.</b> Then about <b>${(1 / perTok).toFixed(0)} tokens/s</b> (≈ ${(0.75 / perTok).toFixed(0)} words/s).</div>
      <div><b>Whole answer finished after ≈ ${fmtTime(total)}.</b> Without streaming you would stare at a blank screen for that whole time.</div>`;
  }
  const sel = (label, key, opts) => { const s = h('select', {}, Object.keys(opts).map(o => h('option', { value: o, selected: S[key] === o }, o))); s.onchange = () => { S[key] = s.value; drawTl(); }; return h('label', { class: 'ctl' }, h('span', {}, label), s); };
  $('#tl-ctl').append(sel('Model size', 'model', MODELS), sel('Number format', 'fmt', FORMATS),
    slider('Distance to server', 0, 16000, 500, S.km, v => { S.km = v; drawTl(); }, v => num(v) + ' km').el,
    slider('Prompt length', 50, 100000, 50, S.prompt, v => { S.prompt = v; drawTl(); }, v => num(v) + ' tokens').el,
    slider('Answer length', 20, 2000, 20, S.answer, v => { S.answer = v; drawTl(); }, v => num(v) + ' tokens').el,
    slider('Queue wait (busy server)', 0, 3000, 50, S.queue, v => { S.queue = v; drawTl(); }, v => num(v) + ' ms').el,
    h('label', {}, h('input', { type: 'checkbox', checked: true, onchange: e => { S.reuse = e.target.checked; drawTl(); } }), ' connection already open'));
  drawTl();

  Quiz.mount('#quiz', [
    { q: 'Why can a chatbot start showing words before the whole answer is finished?', options: ['It already knew the answer', 'The model writes one token at a time and the server streams each as soon as it exists', 'The network is faster for short messages', 'Your browser guesses the words'], answer: 1, why: 'Generation is a token-by-token loop, and the open connection lets each piece travel immediately.' },
    { q: 'You paste a 50-page document and the first word takes much longer to appear. Which stage grew?', options: ['DNS lookup', 'Reading the prompt (prefill), because every prompt token must be processed before writing starts', 'The speed of light', 'The keyboard interrupt'], answer: 1, why: 'Prompt processing scales with prompt length (Module 3).' },
    { q: 'Why is a 70B model usually slower to write than a 7B model?', options: ['It thinks harder in a way that cannot be measured', 'Every token requires reading ten times more weights from GPU memory, and it needs several GPUs', 'Its answers are longer', 'It uses a different keyboard'], answer: 1, why: 'Memory bandwidth per token scales with the number of weights (Modules 2 and 3).' },
    { q: 'Which message points to the operating system rather than the network or the model?', options: ['429 Too Many Requests', '"Killed" with no explanation while loading a model', '"Maximum context length exceeded"', 'A confident but wrong answer'], answer: 1, why: 'The OS OOM killer ends a process when RAM is exhausted (Module 4).' },
    { q: 'After you chat, does the model learn from your conversation?', options: ['Yes, immediately and permanently', 'No. Its weights are frozen; your app only stores the text and resends it next time', 'Only if you use the keyboard', 'Only on weekends'], answer: 1, why: 'Inference does not change the weights (Module 11).' },
    { q: 'Training a model compared with simply using it needs…', options: ['The same memory', 'Several times more memory (corrections must be stored) and many GPUs running for days or weeks', 'No GPU', 'Only a web browser'], answer: 1, why: 'Training adds storage for the corrections (Module 1) and loops over huge amounts of data.' },
  ]);
})();
