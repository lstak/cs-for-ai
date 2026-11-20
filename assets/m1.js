/* Module 1 widgets: bit flipper + float inspector */
(function () {
  // ---------- Bit flipper ----------
  const root = $('#w-bits');
  const bits = [0, 1, 0, 0, 0, 0, 0, 1];
  const row = h('div', { class: 'bitrow' });
  const out = h('div', { class: 'readout' });
  const presets = h('div', { class: 'controls' }, [['A (65)', 65], ['255', 255], ['0', 0], ['128', 128]].map(([t, v]) =>
    h('button', { class: 'sm', onclick: () => { for (let i = 0; i < 8; i++) bits[i] = (v >> (7 - i)) & 1; render(); } }, 'Set ' + t)));
  function render() {
    row.innerHTML = '';
    bits.forEach((b, i) => {
      const place = 2 ** (7 - i);
      row.append(h('button', { class: 'bit' + (b ? ' on' : ''), 'aria-label': `bit worth ${place}`, onclick: () => { bits[i] ^= 1; render(); } },
        h('span', { class: 'bitval' }, b), h('span', { class: 'place' }, place)));
    });
    const u = bits.reduce((a, b) => a * 2 + b, 0), sg = u > 127 ? u - 256 : u;
    const ch = u >= 32 && u < 127 ? `'${String.fromCharCode(u)}'` : '(not a printable character)';
    const terms = bits.map((b, i) => b ? 2 ** (7 - i) : null).filter(x => x != null);
    out.innerHTML = `<div><b>Unsigned number:</b> ${u} <span style="color:var(--muted)">= ${terms.join(' + ') || '0'}</span></div>
      <div><b>Signed (two's complement):</b> ${sg}</div><div><b>As an ASCII character:</b> ${ch}</div>
      <div><b>Hex:</b> 0x${u.toString(16).padStart(2, '0').toUpperCase()}</div>`;
  }
  root.append(row, presets, out); render();

  // ---------- Float helpers ----------
  const dv = new DataView(new ArrayBuffer(4));
  const f32bits = x => { dv.setFloat32(0, x); return dv.getUint32(0); };
  const bitsF32 = u => { dv.setUint32(0, u >>> 0); return dv.getFloat32(0); };
  const toBf16 = x => {
    let u = f32bits(x); if (Number.isNaN(x)) return 0x7FC0;
    u = (u + 0x7FFF + ((u >>> 16) & 1)) >>> 0; return u >>> 16;          // round to nearest even
  };
  const fromBf16 = b => bitsF32((b << 16) >>> 0);
  const toFp16 = x => {
    const u = f32bits(x), sign = (u >>> 31) & 1, exp = (u >>> 23) & 0xFF; let man = u & 0x7FFFFF;
    if (exp === 0xFF) return (sign << 15) | 0x7C00 | (man ? 0x200 : 0);
    const e = exp - 127 + 15;
    if (e >= 31) return (sign << 15) | 0x7C00;                           // overflow -> inf
    if (e <= 0) {                                                        // subnormal / underflow
      if (e < -10) return sign << 15;
      man |= 0x800000; const sh = 14 - e; let hh = man >> sh; const rem = man & ((1 << sh) - 1), half = 1 << (sh - 1);
      if (rem > half || (rem === half && (hh & 1))) hh++; return (sign << 15) | hh;
    }
    let hh = man >> 13; const rem = man & 0x1FFF;
    if (rem > 0x1000 || (rem === 0x1000 && (hh & 1))) hh++;
    return (sign << 15) + (e << 10) + hh;                                // carry propagates into exponent
  };
  const fromFp16 = b => { const s = b >> 15 ? -1 : 1, e = (b >> 10) & 31, m = b & 1023;
    if (e === 0) return s * m * 2 ** -24; if (e === 31) return m ? NaN : s * Infinity; return s * (1 + m / 1024) * 2 ** (e - 15); };
  const FORMATS = {
    fp32: { e: 8, m: 23, enc: x => f32bits(x), dec: bitsF32, total: 32 },
    fp16: { e: 5, m: 10, enc: toFp16, dec: fromFp16, total: 16 },
    bf16: { e: 8, m: 7, enc: toBf16, dec: fromBf16, total: 16 },
  };
  const roundTo = (fmt, x) => FORMATS[fmt].dec(FORMATS[fmt].enc(x));
  const show = v => Number.isInteger(v) || !Number.isFinite(v) ? String(v) : v.toPrecision(17);

  // ---------- Float inspector ----------
  const w = $('#w-float');
  const input = h('input', { type: 'text', value: '0.1', size: 12, 'aria-label': 'number' });
  const fmtSel = h('select', {}, Object.keys(FORMATS).map(k => h('option', { value: k }, k)));
  const bitsEl = h('div', { class: 'fbits' }), info = h('div', { class: 'readout' });
  const presetRow = h('div', { class: 'controls' }, [['0.1', '0.1'], ['0.3', '0.3'], ['2049', '2049'], ['70000', '70000'], ['0.00000001', '1e-8'], ['3.14159265', '3.14159265']].map(([t, v]) =>
    h('button', { class: 'sm', onclick: () => { input.value = v; upd(); } }, t)));
  function upd() {
    const F = FORMATS[fmtSel.value], x = parseFloat(input.value);
    if (Number.isNaN(x)) { info.textContent = 'Please type a number.'; bitsEl.innerHTML = ''; return; }
    const pat = F.enc(x), str = (pat >>> 0).toString(2).padStart(F.total, '0'), stored = F.dec(pat);
    bitsEl.innerHTML = '';
    [...str].forEach((c, i) => bitsEl.append(h('span', { class: i === 0 ? 's' : i <= F.e ? 'e' : 'm' }, c)));
    const err = Number.isFinite(stored) ? Math.abs(stored - x) : null;
    info.innerHTML = `<div><b>You typed:</b> ${x}</div><div><b>Actually stored:</b> <span class="mono">${show(stored)}</span></div>
      <div><b>Error:</b> ${err == null ? '<span class="pill bad">overflow → ' + stored + '</span>' : err === 0 ? '<span class="pill ok">exact</span>' : '<span class="pill warn">' + err.toExponential(2) + '</span>'}</div>
      <div><b>Hex pattern:</b> <span class="mono">0x${(pat >>> 0).toString(16).toUpperCase().padStart(F.total / 4, '0')}</span></div>`;
  }
  input.addEventListener('input', upd); fmtSel.addEventListener('change', upd);
  w.append(h('div', { class: 'controls' }, h('label', {}, 'Number: ', input), h('label', {}, 'Format: ', fmtSel)), presetRow, bitsEl,
    h('div', { class: 'legend' }, h('i', { style: { background: '#e0313166' } }), 'sign', h('i', { style: { background: '#3b5bdb66' } }), 'exponent', h('i', { style: { background: '#0ca67866' } }), 'mantissa'), info);
  upd();

  // ---------- Accumulation demo ----------
  const w2 = h('div', { class: 'widget' }, h('h4', {}, 'Interactive: why accumulators stay in fp32'),
    h('p', { class: 'hint' }, 'Start at 2048 and add 1, a thousand times. What do you expect?'));
  const res = h('div', { class: 'readout' });
  w2.append(h('div', { class: 'controls' }, h('button', { class: 'primary', onclick: () => {
    let a32 = 2048, a16 = 2048, bf = 2048;
    for (let i = 0; i < 1000; i++) { a32 = roundTo('fp32', a32 + 1); a16 = roundTo('fp16', a16 + 1); bf = roundTo('bf16', bf + 1); }
    res.innerHTML = `<div><b>fp32:</b> ${a32} <span class="pill ok">correct</span></div><div><b>fp16:</b> ${a16} <span class="pill bad">stuck: spacing between fp16 numbers near 2048 is 2, so 2049 rounds back to 2048</span></div>
      <div><b>bf16:</b> ${bf} <span class="pill bad">stuck even earlier (spacing is 16 near 2048)</span></div>`;
  } }, 'Run 1000 additions')), res);
  w.parentElement.after(w2);


  // ---------- Image as numbers ----------
  (function () {
    const root = $('#w-img'), N = 8, LEVELS = [0, 85, 170, 255];
    let px = Array(N * N).fill(0);
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${N}, 30px)`, gap: '2px' } });
    const nums = h('div', { class: 'mono', style: { whiteSpace: 'pre', fontSize: '13px' } });
    const note = h('div', { class: 'readout' });
    const cells = px.map((_, i) => h('div', { style: { width: '30px', height: '30px', cursor: 'pointer', border: '1px solid #868e96' },
      onclick: () => { px[i] = LEVELS[(LEVELS.indexOf(px[i]) + 1) % LEVELS.length]; draw(); } }));
    grid.append(...cells);
    function draw() {
      cells.forEach((c, i) => c.style.background = `rgb(${px[i]},${px[i]},${px[i]})`);
      nums.textContent = Array.from({ length: N }, (_, r) => px.slice(r * N, r * N + N).map(v => String(v).padStart(3, ' ')).join(' ')).join('\n');
      const bright = px.filter(v => v > 0).length;
      note.innerHTML = `<b>What a model receives:</b> a flat list of ${N * N} numbers, row after row: [${px.slice(0, 10).join(', ')}, …]. ${bright} of them are not black. One byte each, so this image is ${N * N} bytes. A real 224×224 colour photo is ${(224 * 224 * 3).toLocaleString('en-US')} numbers.`;
    }
    const T = i => { const r = Math.floor(i / N), c = i % N; return (r === 1 && c >= 1 && c <= 6) || (r >= 2 && r <= 6 && (c === 3 || c === 4)) ? 255 : 0; };
    root.append(h('div', { class: 'twocol' }, h('div', {}, grid), nums),
      h('div', { class: 'controls' },
        h('button', { onclick: () => { px = px.map(() => 0); draw(); } }, 'Clear'),
        h('button', { onclick: () => { px = px.map(v => 255 - v); draw(); } }, 'Invert'),
        h('button', { onclick: () => { px = px.map((_, i) => T(i)); draw(); } }, 'Draw a "T"'),
        h('button', { onclick: () => { px = px.map(v => Math.min(255, v + 85)); draw(); } }, 'Brighten')),
      note);
    draw();
  })();

  Quiz.mount('#quiz', [
    { q: 'How many different values can one byte represent?', options: ['8', '128', '256', '1024'], answer: 2, why: '8 bits → 2⁸ = 256 patterns.' },
    { q: 'Why does 0.1 + 0.2 not equal 0.3 in Python?', options: ['Python has a bug', 'Neither 0.1 nor 0.2 can be stored exactly in binary, so tiny rounding errors add up', 'Python only supports integers', 'The CPU is too slow'], answer: 1, why: 'Same reason 1/3 cannot be written exactly in decimal. Compare floats with math.isclose.' },
    { q: 'Which format keeps the same range as fp32 but has less precision?', options: ['fp16', 'bf16', 'int8', 'fp64'], answer: 1, why: 'bf16 uses 8 exponent bits like fp32, but only 7 mantissa bits.' },
    { q: 'Roughly how much memory do the weights of a 10B-parameter model need in fp16?', options: ['5 GB', '10 GB', '20 GB', '40 GB'], answer: 2, why: '10 billion × 2 bytes = 20 GB (and training needs far more than the weights alone).' },
    { q: 'How does a model "see" a 224 × 224 colour photo?', options: ['As a picture, like a human', 'As a list of 224 × 224 × 3 = 150,528 numbers (red, green, blue per pixel)', 'As a short text description', 'As a single number'], answer: 1, why: 'Every kind of data is turned into numbers first. Pixels are numbers from 0 to 255.' },
    { q: 'What does quantising a model (for example from 16-bit to 4-bit) do?', options: ['Makes it smarter', 'Stores each weight in fewer bits, so the model is about 4× smaller with a small loss in precision', 'Translates it to another language', 'Adds more parameters'], answer: 1, why: 'Fewer bits per number means less memory, which is how large models run on small devices.' },
  ]);
})();
