/* Module 11 widgets: next-word machine (toy bigram + temperature) and embedding "meaning map" */
(function () {
  // ---------- Next-word machine ----------
  const CORPUS = 'the cat sat on the mat . the cat chased the mouse . the dog sat on the rug . the dog chased the cat . a cat saw a dog . the mouse ran under the mat . the dog saw the mouse .';
  const words = CORPUS.split(' ');
  const counts = {};
  for (let i = 0; i < words.length - 1; i++) {
    (counts[words[i]] ||= {});
    counts[words[i]][words[i + 1]] = (counts[words[i]][words[i + 1]] || 0) + 1;
  }
  let temp = 1, sentence = ['the'];
  const bars = $('#nw-bars'), text = $('#nw-text'), note = $('#nw-note');

  // probability ∝ count^(1/T): low T sharpens toward the most common word, high T flattens.
  function probs(word) {
    const c = counts[word] || { '.': 1 };
    const w = Object.entries(c).map(([k, v]) => [k, Math.pow(v, 1 / temp)]);
    const tot = w.reduce((a, [, v]) => a + v, 0);
    return w.map(([k, v]) => [k, v / tot]).sort((a, b) => b[1] - a[1]);
  }
  function draw() {
    const last = sentence[sentence.length - 1];
    const p = probs(last);
    text.textContent = sentence.join(' ');
    renderBars(bars, p.map(([w, v]) => ({ label: `"${w}"`, value: v, text: (v * 100).toFixed(0) + '%', cls: '' })));
    note.innerHTML = `<b>Context:</b> the last word is <code>${last}</code>. The machine only looks at that one word. A real LLM looks at thousands of earlier tokens and has billions of learned numbers instead of a counting table.`;
  }
  function pick() {
    const p = probs(sentence[sentence.length - 1]);
    let r = Math.random(), acc = 0, chosen = p[p.length - 1][0];
    for (const [w, v] of p) { acc += v; if (r <= acc) { chosen = w; break; } }
    sentence.push(chosen);
    if (sentence.length > 30) sentence = sentence.slice(-30);
    draw();
  }
  $('#nw-ctl').append(
    slider('Temperature', 0.1, 2, 0.1, temp, v => { temp = v; draw(); }, v => v.toFixed(1)).el,
    h('button', { class: 'primary', onclick: pick }, 'Pick next word'),
    h('button', { onclick: () => { for (let i = 0; i < 10; i++) pick(); } }, 'Pick 10'),
    h('button', { onclick: () => { sentence = ['the']; draw(); } }, 'Reset'));
  draw();

  // ---------- Meaning map ----------
  // Hand-made 2D coordinates (0-10). Real embeddings have hundreds of dimensions and are learned, not drawn.
  const PTS = {
    cat: [1.5, 8.5, 'a'], dog: [2.3, 8.0, 'a'], mouse: [1.2, 7.3, 'a'], lion: [2.8, 9.0, 'a'],
    car: [8.0, 8.5, 'v'], bus: [8.8, 7.8, 'v'], train: [9.0, 8.8, 'v'], bike: [7.5, 7.6, 'v'],
    apple: [1.5, 1.5, 'f'], banana: [2.4, 1.0, 'f'], pizza: [1.0, 2.6, 'f'], bread: [2.3, 2.4, 'f'],
    man: [5.5, 3.5, 'p'], woman: [5.5, 5.5, 'p'], king: [8.0, 3.5, 'p'], queen: [8.0, 5.5, 'p'],
  };
  const COL = { a: '#3b5bdb', v: '#f08c00', f: '#0ca678', p: '#9c36b5' };
  const W = 440, H = 300, X = x => 20 + x * 40, Y = y => 20 + (10 - y) * 26;
  const out = $('#em-out'), host = $('#em-svg');
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const nearest = (pt, exclude, n) => Object.keys(PTS).filter(k => !exclude.includes(k)).sort((a, b) => dist(PTS[a], pt) - dist(PTS[b], pt)).slice(0, n);

  function drawMap(sel, arrow) {
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', style: 'max-width:620px;background:var(--panel,#f8f9fa);border-radius:8px' });
    if (arrow) {
      svg.append(sv('line', { x1: X(arrow.from[0]), y1: Y(arrow.from[1]), x2: X(arrow.to[0]), y2: Y(arrow.to[1]), stroke: '#e03131', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
      svg.append(sv('circle', { cx: X(arrow.to[0]), cy: Y(arrow.to[1]), r: 11, fill: 'none', stroke: '#e03131', 'stroke-width': 2 }));
    }
    for (const [k, [x, y, g]] of Object.entries(PTS)) {
      const c = sv('circle', { cx: X(x), cy: Y(y), r: k === sel ? 8 : 5.5, fill: COL[g], stroke: k === sel ? '#000' : 'none', style: 'cursor:pointer' });
      const t = sv('text', { x: X(x) + 9, y: Y(y) + 4, 'font-size': 12, fill: 'currentColor', style: 'cursor:pointer' }, k);
      c.addEventListener('click', () => choose(k)); t.addEventListener('click', () => choose(k));
      svg.append(c, t);
    }
    host.innerHTML = ''; host.append(svg);
  }
  function choose(k) {
    drawMap(k);
    const nn = nearest(PTS[k], [k], 3);
    out.innerHTML = `<b>${k}</b> is closest to: ${nn.map(n => `<code>${n}</code> (distance ${dist(PTS[k], PTS[n]).toFixed(1)})`).join(', ')}. Words used in similar contexts sit close together.`;
  }
  function analogy(a, b, c, why) {
    // a − b + c, using the coordinates as vectors
    const v = [PTS[a][0] - PTS[b][0] + PTS[c][0], PTS[a][1] - PTS[b][1] + PTS[c][1]];
    const ans = nearest(v, [a, b, c], 1)[0];
    drawMap(null, { from: PTS[a], to: v });
    out.innerHTML = `<b>${a} − ${b} + ${c}</b> lands at (${v[0].toFixed(1)}, ${v[1].toFixed(1)}); the nearest word is <code>${ans}</code>. ${why}`;
  }
  $('#em-ctl').append(
    h('button', { onclick: () => analogy('king', 'man', 'woman', 'The step from <code>man</code> to <code>woman</code> is a direction on the map (male → female); applying it to <code>king</code> lands on <code>queen</code>.') }, 'king − man + woman = ?'),
    h('button', { onclick: () => analogy('queen', 'woman', 'man', 'The same direction, walked backwards (female → male), turns <code>queen</code> into <code>king</code>.') }, 'queen − woman + man = ?'),
    h('button', { onclick: () => analogy('bus', 'car', 'cat', 'Nonsense in, nonsense out: there is no consistent "direction" from <code>car</code> to <code>cat</code>, so the result is just whatever word happens to be nearby. Analogies only work when the relationship is real.') }, 'bus − car + cat = ? (nonsense)'),
    h('button', { onclick: () => { drawMap(); out.textContent = ''; } }, 'Reset'));
  drawMap();
  out.textContent = 'Click a word on the map.';

  Quiz.mount('#quiz', [
    { q: 'What is a language model fundamentally doing when it writes an answer?', options: ['Looking the answer up in a database of facts', 'Repeatedly predicting a probability for the next token, picking one, and appending it', 'Searching the internet', 'Running a list of if/else rules written by engineers'], answer: 1, why: 'Generation is a loop of next-token prediction. Any lookups or searches are extras bolted on (Module 13).' },
    { q: 'You ask the same question twice and get two different answers. Why?', options: ['The model is broken', 'The next token is picked randomly, weighted by probability (controlled by temperature)', 'The server changed the weights between calls', 'Your network is unstable'], answer: 1, why: 'Sampling is random. Lower temperature makes the output more repeatable.' },
    { q: 'Why can a model state a false fact with total confidence?', options: ['It is deliberately lying', 'It produces the most plausible-sounding continuation; nothing in the loop checks truth unless a tool or source is added', 'Its memory is full', 'The tokenizer corrupted the text'], answer: 1, why: 'Plausible and true are different things. This is why grounding with search/tools and verification matter.' },
    { q: 'You teach a chatbot your name in a chat. In a brand-new chat it has forgotten. Why?', options: ['It was a bug', 'The weights are frozen during use; the conversation was only temporary input text (the context window)', 'The server ran out of disk', 'Names cannot be tokenized'], answer: 1, why: 'Inference does not change the weights. Memory features work by saving text and pasting it back into the input.' },
    { q: 'What does an embedding give a model?', options: ['A faster network', 'A list of numbers for each token, where similar meanings are close together', 'A spell-checker', 'A copy of the training data'], answer: 1, why: 'Embeddings turn arbitrary ids into coordinates on a "meaning map".' },
    { q: 'A 7B-parameter model is stored in fp16. Roughly how much memory do just the weights take?', options: ['7 GB', '14 GB', '28 GB', '70 GB'], answer: 1, why: '7 × 10⁹ × 2 bytes = 14 GB (Module 1).' },
  ]);
})();
