/* Module 8 widgets: format viewer, size/speed model, rows-vs-columns, query builder, index vs scan, pick-the-storage */
(function () {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = v => Math.round(v).toLocaleString('en-US');
  const mkSel = (label, opts, onchange, value) => {
    const s = h('select', {}, opts.map(o => h('option', { value: o }, o)));
    if (value != null) s.value = value;
    s.onchange = () => onchange(s.value);
    return { el: h('label', { class: 'ctl' }, h('span', {}, label), s), sel: s,
      set(list, keep) { const cur = s.value; s.innerHTML = ''; list.forEach(o => s.append(h('option', { value: o }, o))); s.value = list.includes(cur) && keep !== false ? cur : list[0]; return s.value; } };
  };

  // ---------- 1. Format viewer ----------
  const FLAT = [
    { id: 1, user: 'ada', model: 'small', tokens: 120, latency_ms: 350 },
    { id: 2, user: 'bo', model: 'large', tokens: 800, latency_ms: 2100 },
    { id: 3, user: 'ada', model: 'small', tokens: 95, latency_ms: 300 },
    { id: 4, user: 'cy', model: 'large, v2', tokens: 410, latency_ms: 1500 },
  ];
  const NESTED = [
    { id: 1, user: 'ada', messages: [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello! How can I help?' }] },
    { id: 2, user: 'bo', messages: [{ role: 'user', content: 'What is DNS?' }, { role: 'assistant', content: 'DNS turns names into IP addresses.' }, { role: 'user', content: 'Thanks' }] },
  ];
  const csvCell = v => { const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const toCsv = rows => { const cols = Object.keys(rows[0]); return [cols.join(',')].concat(rows.map(r => cols.map(c => csvCell(r[c])).join(','))).join('\n'); };
  function toParquetView(rows, nested) {
    const cols = Object.keys(rows[0]);
    const lines = ['PAR1                       (a binary file; this is a conceptual view of what is inside)', 'Row group 1'];
    for (const c of cols) {
      const vals = rows.map(r => r[c]);
      if (c === 'messages') { lines.push(`  column "messages"  LIST<STRUCT<role: STRING, content: STRING>>   (nested data stays typed)`); continue; }
      if (typeof vals[0] === 'string') {
        const dict = [...new Set(vals)];
        lines.push(`  column "${c}"`.padEnd(24) + `STRING  dictionary {${dict.map((d, i) => i + ':' + d).join(', ')}}  codes [${vals.map(v => dict.indexOf(v)).join(', ')}]`);
      } else lines.push(`  column "${c}"`.padEnd(24) + `INT     [${vals.join(', ')}]   min=${Math.min(...vals)} max=${Math.max(...vals)}`);
    }
    lines.push('Footer: schema (names + types), row count, per-column min/max statistics, compression codec, column offsets', 'PAR1');
    return lines.join('\n');
  }
  const FNOTE = {
    'Flat table': {
      'CSV': 'Compact and readable. Notice row 4: the value <code>large, v2</code> contains a comma, so it must be wrapped in quotes. Everything is text; nothing says <code>tokens</code> is a number.',
      'JSON': 'Every row repeats the column names (<code>"user"</code>, <code>"model"</code>…). Types are visible: numbers have no quotes. Fine for a few records, wasteful for millions.',
      'JSON Lines': 'One complete JSON object per line. You can append a new line, read the file one line at a time, or split it in pieces without parsing the whole thing.',
      'Parquet': 'Values are stored <b>column by column</b>. Text columns become a small dictionary plus codes, and number columns keep their min/max, so a query for <code>tokens &gt; 500</code> can skip whole chunks. Real files are also compressed.',
    },
    'Nested chat': {
      'CSV': 'CSV has no nesting. The list of messages has to be squeezed into one text cell as a JSON string (with doubled quotes) and parsed again when you read it. This is why CSV is a poor fit for chat data.',
      'JSON': 'Nesting is natural: a chat contains a list of messages. Easy to read and exactly the shape APIs use (Module 7).',
      'JSON Lines': 'One chat per line. This is the usual layout for fine-tuning datasets and conversation logs: simple to stream, append and shuffle.',
      'Parquet': 'Parquet supports nested types too (lists and structs), with a strict schema. Good for large conversation collections you analyse a lot; less convenient for hand editing.',
    },
  };
  let fmDs = 'Flat table', fmFmt = 'CSV';
  function drawFm() {
    const nested = fmDs === 'Nested chat', rows = nested ? NESTED : FLAT;
    const text = fmFmt === 'CSV' ? toCsv(rows) : fmFmt === 'JSON' ? JSON.stringify(rows, null, 2)
      : fmFmt === 'JSON Lines' ? rows.map(r => JSON.stringify(r)).join('\n') : toParquetView(rows, nested);
    $('#fm-out').textContent = text;
    $('#fm-note').innerHTML = `<b>${fmFmt}:</b> ${FNOTE[fmDs][fmFmt]} <span style="color:var(--muted)">(${fmFmt === 'Parquet' ? 'binary on disk; the view above is conceptual' : '≈ ' + text.length + ' characters'})</span>`;
  }
  $('#fm-ctl').append(mkSel('Data', ['Flat table', 'Nested chat'], v => { fmDs = v; drawFm(); }).el, mkSel('Format', ['CSV', 'JSON', 'JSON Lines', 'Parquet'], v => { fmFmt = v; drawFm(); }).el);
  drawFm();

  // ---------- 2. Rows vs columns ----------
  const RC_COLS = ['id', 'user', 'model', 'tokens', 'latency_ms'], RC_ROWS = 12, BLOCK = 6;
  const RC_COLOR = ['#3b5bdb', '#0ca678', '#f08c00', '#9c36b5', '#e03131'];
  const rc = { layout: 'Row-oriented', need: [false, false, false, true, false] };
  function drawRc() {
    const cells = [];
    if (rc.layout === 'Row-oriented') for (let r = 0; r < RC_ROWS; r++) for (let c = 0; c < RC_COLS.length; c++) cells.push({ r, c });
    else for (let c = 0; c < RC_COLS.length; c++) for (let r = 0; r < RC_ROWS; r++) cells.push({ r, c });
    const blocks = [];
    for (let i = 0; i < cells.length; i += BLOCK) blocks.push(cells.slice(i, i + BLOCK));
    const read = blocks.map(b => b.some(x => rc.need[x.c]));
    const grid = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } });
    blocks.forEach((b, bi) => grid.append(h('div', { title: 'block ' + (bi + 1), style: { display: 'flex', gap: '2px', padding: '3px', border: read[bi] ? '2px solid #e03131' : '2px dashed #868e96', borderRadius: '6px', opacity: read[bi] ? 1 : 0.55 } },
      b.map(x => h('div', { title: `${RC_COLS[x.c]}, row ${x.r + 1}`, style: { width: '18px', height: '18px', borderRadius: '3px', background: RC_COLOR[x.c], opacity: rc.need[x.c] ? 1 : 0.28 } })))));
    $('#rc-grid').innerHTML = ''; $('#rc-grid').append(grid);
    const n = read.filter(Boolean).length;
    const needNames = RC_COLS.filter((_, i) => rc.need[i]);
    $('#rc-out').innerHTML = needNames.length === 0 ? 'Tick at least one column.' :
      `<div><b>Query needs:</b> ${needNames.join(', ')} (all ${RC_ROWS} rows).</div><div><b>Blocks that must be read:</b> ${n} of ${blocks.length} (${Math.round(n / blocks.length * 100)}%). ${n === blocks.length ? 'Every block contains something you need, so the whole file is read.' : 'The other blocks are never touched.'}</div>
       <div style="color:var(--muted)">Legend: ${RC_COLS.map((c, i) => `<span style="color:${RC_COLOR[i]}">■</span> ${c}`).join(' · ')}</div>`;
  }
  $('#rc-ctl').append(mkSel('Storage layout', ['Row-oriented', 'Column-oriented'], v => { rc.layout = v; drawRc(); }).el,
    ...RC_COLS.map((c, i) => h('label', {}, h('input', { type: 'checkbox', checked: rc.need[i], onchange: e => { rc.need[i] = e.target.checked; drawRc(); } }), ' ' + c)));
  drawRc();

  // ---------- 3. Size and speed model ----------
  const SZ = { exp: 8, cols: 30, need: 3, store: 'Local SSD' };
  const STORE = { 'Local SSD': 3e9, 'Hard disk': 1.5e8, 'Network share (1 Gbit)': 1.1e8 };
  function drawSz() {
    const rows = Math.pow(10, SZ.exp), cols = SZ.cols, need = Math.min(SZ.need, cols), bw = STORE[SZ.store];
    const F = {
      'CSV':     { bytes: rows * cols * 9,  read: rows * cols * 9,  parse: 3e8 },
      'JSON':    { bytes: rows * cols * 21, read: rows * cols * 21, parse: 1.5e8 },
      'Parquet': { bytes: rows * cols * 2,  read: rows * need * 2,  parse: 1e9 },
    };
    const res = Object.entries(F).map(([k, f]) => ({ k, size: f.bytes, read: f.read, t: f.read / bw + f.read / f.parse }));
    const maxT = Math.max(...res.map(r => r.t));
    const out = $('#sz-out'); out.innerHTML = '';
    const table = h('table', {}, h('tr', {}, h('th', {}, 'Format'), h('th', {}, 'File size'), h('th', {}, 'Bytes read to get ' + need + ' column' + (need > 1 ? 's' : '')), h('th', {}, 'Time (read + parse)')),
      ...res.map(r => h('tr', {}, h('td', {}, r.k), h('td', {}, fmtBytes(r.size)), h('td', {}, fmtBytes(r.read)), h('td', {}, fmtTime(r.t)))));
    const bars = h('div', { class: 'bars' }); out.append(table, bars);
    renderBars(bars, res.map(r => ({ label: r.k, value: r.t / maxT, text: fmtTime(r.t), cls: r.k === 'Parquet' ? 'ok' : 'bad' })));
    out.append(h('div', {}, `${num(rows)} rows × ${cols} columns. CSV and JSON must read and parse every column even if you need ${need}; Parquet reads only the needed columns, compressed. Real results vary with data and software; the shape of the comparison is what matters.`));
  }
  $('#sz-ctl').append(
    slider('Rows', 3, 9, 0.5, SZ.exp, v => { SZ.exp = v; drawSz(); }, v => num(Math.pow(10, v))).el,
    slider('Columns in the table', 5, 100, 5, SZ.cols, v => { SZ.cols = v; drawSz(); }).el,
    slider('Columns your query needs', 1, 20, 1, SZ.need, v => { SZ.need = v; drawSz(); }).el,
    mkSel('Storage', Object.keys(STORE), v => { SZ.store = v; drawSz(); }).el);
  drawSz();

  // ---------- 4. Query builder ----------
  const USERS = { ada: { country: 'NL', plan: 'pro' }, bo: { country: 'US', plan: 'free' }, cy: { country: 'DE', plan: 'pro' }, di: { country: 'US', plan: 'free' } };
  const REQ = [
    [1, 'ada', 'small', 120, 350, 'ok'], [2, 'bo', 'large', 800, 2100, 'ok'], [3, 'ada', 'small', 95, 300, 'ok'], [4, 'cy', 'large', 410, 1500, 'ok'],
    [5, 'bo', 'small', 60, 200, 'error'], [6, 'di', 'small', 150, 420, 'ok'], [7, 'cy', 'large', 950, 2600, 'ok'], [8, 'ada', 'large', 700, 1900, 'error'],
    [9, 'bo', 'small', 110, 330, 'ok'], [10, 'di', 'large', 520, 1600, 'ok'], [11, 'cy', 'small', 80, 260, 'ok'], [12, 'ada', 'small', 130, 380, 'ok'],
    [13, 'di', 'small', 70, 240, 'error'], [14, 'bo', 'large', 640, 1800, 'ok'],
  ].map(([id, user, model, tokens, latency_ms, status]) => ({ id, user, model, tokens, latency_ms, status }));
  const NUMERIC = new Set(['id', 'tokens', 'latency_ms']);
  const BASE = ['id', 'user', 'model', 'tokens', 'latency_ms', 'status'], JOINED = ['country', 'plan'];
  const AGG = {
    'COUNT(*)': { f: r => r.length, pd: g => g ? `.groupby("${g}").size()` : 'len(df)' },
    'AVG(tokens)': { f: r => r.reduce((a, x) => a + x.tokens, 0) / r.length, pd: g => g ? `.groupby("${g}")["tokens"].mean()` : '["tokens"].mean()' },
    'SUM(tokens)': { f: r => r.reduce((a, x) => a + x.tokens, 0), pd: g => g ? `.groupby("${g}")["tokens"].sum()` : '["tokens"].sum()' },
    'AVG(latency_ms)': { f: r => r.reduce((a, x) => a + x.latency_ms, 0) / r.length, pd: g => g ? `.groupby("${g}")["latency_ms"].mean()` : '["latency_ms"].mean()' },
    'MAX(latency_ms)': { f: r => Math.max(...r.map(x => x.latency_ms)), pd: g => g ? `.groupby("${g}")["latency_ms"].max()` : '["latency_ms"].max()' },
  };
  const Q = { join: false, wcol: '(none)', wop: '=', wval: 'ok', gcol: '(none)', agg: '(show rows)', ord: '(none)', lim: '(all)' };
  function runQ() {
    const cols = Q.join ? BASE.concat(JOINED) : BASE;
    let rows = REQ.map(r => Q.join ? Object.assign({}, r, USERS[r.user]) : Object.assign({}, r));
    let wmsg = '', where = null;
    if (Q.wcol !== '(none)' && cols.includes(Q.wcol)) {
      const isNum = NUMERIC.has(Q.wcol), v = isNum ? Number(Q.wval) : Q.wval;
      if (isNum && (Q.wval.trim() === '' || Number.isNaN(v))) wmsg = `"${Q.wcol}" is a number column: type a number.`;
      else {
        where = { col: Q.wcol, op: Q.wop, v, isNum };
        const t = { '=': (a, b) => a === b, '!=': (a, b) => a !== b, '>': (a, b) => a > b, '<': (a, b) => a < b }[Q.wop];
        rows = rows.filter(r => t(r[Q.wcol], v));
      }
    }
    const g = Q.gcol !== '(none)' && cols.includes(Q.gcol) ? Q.gcol : null;
    const aggName = Q.agg !== '(show rows)' ? Q.agg : (g ? 'COUNT(*)' : null);
    let head, body;
    if (g || aggName) {
      const A = AGG[aggName];
      if (g) {
        const groups = {}; rows.forEach(r => (groups[r[g]] = groups[r[g]] || []).push(r));
        body = Object.entries(groups).map(([k, rs]) => [k, A.f(rs)]);
      } else body = rows.length ? [[A.f(rows)]] : [[aggName.startsWith('COUNT') ? 0 : null]];
      head = g ? [g, 'value'] : ['value'];
      if (Q.ord !== '(none)') body.sort((a, b) => (Q.ord === 'DESC' ? -1 : 1) * (a[a.length - 1] - b[b.length - 1]));
    } else {
      head = cols; body = rows.map(r => cols.map(c => r[c]));
      if (Q.ord !== '(none)') { const i = cols.indexOf('tokens'); body.sort((a, b) => (Q.ord === 'DESC' ? -1 : 1) * (a[i] - b[i])); }
    }
    if (Q.lim !== '(all)') body = body.slice(0, Number(Q.lim));
    // SQL text
    const fmtV = where ? (where.isNum ? where.v : "'" + String(where.v).replace(/'/g, "''") + "'") : '';
    const aggSql = aggName ? aggName + ' AS value' : '';
    const sel = g ? `${g}, ${aggSql}` : aggName ? aggSql : '*';
    const orderCol = (g || aggName) ? 'value' : 'tokens';
    const sql = [`SELECT ${sel}`, 'FROM requests', Q.join ? 'JOIN users USING (user)' : null, where ? `WHERE ${where.col} ${where.op} ${fmtV}` : null,
      g ? `GROUP BY ${g}` : null, Q.ord !== '(none)' ? `ORDER BY ${orderCol} ${Q.ord}` : null, Q.lim !== '(all)' ? `LIMIT ${Q.lim}` : null].filter(Boolean).join('\n') + ';';
    // pandas text
    const pv = where ? (where.isNum ? where.v : JSON.stringify(String(where.v))) : '';
    const pd = [Q.join ? 'df = requests.merge(users, on="user")' : 'df = requests',
      where ? `df = df[df["${where.col}"] ${where.op === '=' ? '==' : where.op} ${pv}]` : null];
    let expr = 'df';
    if (g || aggName) {
      const tail = AGG[aggName].pd(g);
      expr = tail.startsWith('len(') ? tail : 'df' + tail;
      if (Q.ord !== '(none)' && g) expr += `.sort_values(ascending=${Q.ord === 'ASC' ? 'True' : 'False'})`;
      if (Q.lim !== '(all)' && g) expr += `.head(${Q.lim})`;
    } else {
      if (Q.ord !== '(none)') expr += `.sort_values("tokens", ascending=${Q.ord === 'ASC' ? 'True' : 'False'})`;
      if (Q.lim !== '(all)') expr += `.head(${Q.lim})`;
    }
    pd.push('result = ' + expr);
    $('#qb-sql').textContent = sql; $('#qb-pd').textContent = pd.filter(Boolean).join('\n');
    const f = v => (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : v === null ? 'NULL' : v);
    $('#qb-res').innerHTML = (wmsg ? `<div class="callout warn"><p>${esc(wmsg)}</p></div>` : '') +
      `<table><tr>${head.map(x => `<th>${esc(x)}</th>`).join('')}</tr>${body.map(r => `<tr>${r.map(v => `<td>${esc(f(v))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}">(no rows)</td></tr>`}</table><div style="color:var(--muted)">${body.length} row${body.length === 1 ? '' : 's'}</div>`;
  }
  const wcolS = mkSel('WHERE column', ['(none)'].concat(BASE), v => { Q.wcol = v; runQ(); });
  const gcolS = mkSel('GROUP BY', ['(none)', 'model', 'user', 'status'], v => { Q.gcol = v; runQ(); });
  wcolS.sel.value = '(none)';
  const wopS = mkSel('is', ['=', '!=', '>', '<'], v => { Q.wop = v; runQ(); });
  const wval = h('input', { type: 'text', value: Q.wval, style: { width: '80px' } });
  wval.addEventListener('input', () => { Q.wval = wval.value; runQ(); });
  const joinBox = h('input', { type: 'checkbox', onchange: e => {
    Q.join = e.target.checked;
    Q.wcol = wcolS.set(['(none)'].concat(Q.join ? BASE.concat(JOINED) : BASE)); Q.gcol = gcolS.set(['(none)', 'model', 'user', 'status'].concat(Q.join ? JOINED : []));
    runQ(); } });
  $('#qb-ctl').append(h('label', {}, joinBox, ' JOIN users'), wcolS.el, wopS.el, h('label', { class: 'ctl' }, h('span', {}, 'value'), wval),
    gcolS.el, mkSel('Aggregate', ['(show rows)'].concat(Object.keys(AGG)), v => { Q.agg = v; runQ(); }).el,
    mkSel('ORDER BY', ['(none)', 'DESC', 'ASC'], v => { Q.ord = v; runQ(); }).el, mkSel('LIMIT', ['(all)', '3', '5'], v => { Q.lim = v; runQ(); }).el);
  Q.wcol = 'status'; wcolS.sel.value = 'status';
  runQ();

  // ---------- 5. Index vs scan ----------
  const IX = { exp: 8, row: 200 };
  function drawIx() {
    const N = Math.pow(10, IX.exp), levels = Math.max(1, Math.ceil(Math.log(N) / Math.log(300))), pages = levels + 1;
    const scan = N * IX.row / 3e9, look = pages * 100e-6;
    const norm = t => Math.max(0.01, Math.min(1, (Math.log10(t) - Math.log10(1e-5)) / (Math.log10(1000) - Math.log10(1e-5))));
    renderBars($('#ix-bars'), [
      { label: 'Full scan (no index)', value: norm(scan), text: fmtTime(scan), cls: 'bad' },
      { label: 'Index lookup (B-tree)', value: norm(look), text: fmtTime(look), cls: 'ok' }]);
    $('#ix-out').innerHTML = `<div>Table: <b>${num(N)}</b> rows × ${IX.row} bytes = <b>${fmtBytes(N * IX.row)}</b>.</div>
      <div>The index tree has about <b>${levels}</b> level${levels > 1 ? 's' : ''} (each node holds hundreds of keys), so a lookup reads ~${pages} pages: ${fmtTime(look)}. The scan is about <b>${num(scan / look)}×</b> slower.</div>
      <div style="color:var(--muted)">The index isn't free: it takes extra disk space and each insert or update must maintain it. Bars use a logarithmic scale.</div>`;
  }
  $('#ix-ctl').append(slider('Rows in the table', 3, 10, 0.5, IX.exp, v => { IX.exp = v; drawIx(); }, v => num(Math.pow(10, v))).el,
    slider('Bytes per row', 50, 1000, 50, IX.row, v => { IX.row = v; drawIx(); }, v => v + ' B').el);
  drawIx();

  // ---------- 6. Pick the right storage ----------
  const OPT = ['CSV file', 'JSON Lines file', 'Parquet files', 'SQLite', 'PostgreSQL', 'Key–value store (Redis)', 'Document database (MongoDB)', 'Vector database / pgvector', 'Graph database', 'Data warehouse (BigQuery, Snowflake)'];
  const SCN = [
    ['A script saves 200 experiment results that a colleague will open in a spreadsheet.', ['CSV file'], 'Small, flat, and meant for humans and Excel: CSV is the simplest thing that works.'],
    ['Fine-tuning data: 50,000 chat examples, each a list of messages with roles.', ['JSON Lines file'], 'Nested records, appended and streamed one example at a time: JSON Lines is the standard here.'],
    ['A training table with 500 million rows and 80 columns; each experiment reads 5 of the columns.', ['Parquet files'], 'Columnar, typed and compressed: read only the 5 columns you need (see the size widget).'],
    ['A web app with users, chats and messages; many people read and write at once; billing must always add up.', ['PostgreSQL'], 'Relational data, concurrent users and strong guarantees (ACID) point to Postgres.'],
    ['A small desktop or mobile app keeps a user\'s notes locally, with no server.', ['SQLite'], 'A full SQL database in a single file with no server: perfect for local apps.'],
    ['Cache the latest answer for each question for 10 minutes and enforce a per-user rate limit.', ['Key–value store (Redis)'], 'Lookups by key at in-memory speed, with expiry built in: a classic key–value job.'],
    ['Find the 5 stored passages closest in meaning to a user\'s question (RAG).', ['Vector database / pgvector'], 'Nearest-neighbour search over embeddings is what vector indexes are built for.'],
    ['A product catalogue where each item has different, nested attributes that change often.', ['Document database (MongoDB)', 'PostgreSQL'], 'Flexible nested records suit a document database; Postgres with <code>JSONB</code> is also a good answer, with stronger guarantees.'],
    ['Find "friends of friends" and shortest paths across a social network of 100 million people.', ['Graph database'], 'Queries that follow many relationships are what graph databases optimise.'],
    ['Analysts run heavy aggregations over 3 years of logs (20 TB); writes are rare.', ['Data warehouse (BigQuery, Snowflake)', 'Parquet files'], 'Large scans and aggregations favour columnar storage: a warehouse, or Parquet files queried by an engine like DuckDB or Spark.'],
  ];
  let pi = 0, score = 0, answered = false;
  const pkSel = mkSel('Your choice', OPT, () => {});
  const pkScn = $('#pk-scn'), pkFb = $('#pk-fb');
  function showScn() { answered = false; pkScn.innerHTML = `<b>Scenario ${pi + 1} of ${SCN.length}:</b> ${esc(SCN[pi][0])}`; pkFb.innerHTML = `Score so far: ${score} / ${pi}`; }
  function check() {
    if (answered) return; answered = true;
    const [, ok, why] = SCN[pi], pick = pkSel.sel.value, good = ok.includes(pick);
    if (good) score++;
    pkFb.innerHTML = (good ? '✅ <b>Good choice.</b> ' : `❌ <b>Better fit:</b> ${ok.map(esc).join(' or ')}. `) + why + `<br>Score: ${score} / ${pi + 1}`;
  }
  $('#pk-ctl').append(pkSel.el, h('button', { class: 'primary', onclick: check }, 'Check'),
    h('button', { onclick: () => { pi = (pi + 1) % SCN.length; if (pi === 0) score = 0; showScn(); } }, 'Next scenario'));
  showScn();

  Quiz.mount('#quiz', [
    { q: 'Which is a real weakness of CSV?', options: ['It cannot be opened in Excel', 'It has no data types or nesting, quoting is fragile, and you must read the whole file even for one column', 'It is binary', 'It cannot store numbers'], answer: 1, why: 'CSV is universal and readable, but it is plain untyped text.' },
    { q: 'Which format suits a fine-tuning dataset of chats (each a list of messages) that you append to and stream?', options: ['CSV', 'JSON Lines', 'Excel', 'A PNG image'], answer: 1, why: 'One nested JSON record per line is easy to append, stream and split.' },
    { q: 'Why is Parquet usually much faster than CSV for analytics?', options: ['It uses the GPU', 'It is column-oriented, typed and compressed, so a query reads only the columns it needs', 'It is encrypted', 'It stores less data by deleting rows'], answer: 1, why: 'Fewer bytes read and less parsing work.' },
    { q: 'Which query favours a column-oriented layout?', options: ['"Show everything about user 42"', '"What is the average of the tokens column over 100 million rows?"', '"Insert one new row"', '"Update one person\'s email"'], answer: 1, why: 'Aggregating one column touches only that column. Whole-record lookups and single-row writes favour row layouts.' },
    { q: 'What does a SQL JOIN do?', options: ['Deletes duplicate rows', 'Combines rows from two tables that have matching key values', 'Sorts a table', 'Copies a table to disk'], answer: 1, why: 'Facts are stored once; JOIN puts them together when you need them (for example requests plus user country).' },
    { q: 'What does the "A" in ACID (atomicity) guarantee?', options: ['The database is always fast', 'A transaction happens completely or not at all, such as both halves of a money transfer', 'Data is always encrypted', 'Users never see each other'], answer: 1, why: 'No half-finished transfers, even if the power fails midway.' },
    { q: 'Why add an index to a column you often search by?', options: ['It makes the table smaller', 'It lets the database find rows in a few steps instead of scanning every row, at the cost of extra space and slower writes', 'It encrypts the column', 'It removes duplicates'], answer: 1, why: 'A B-tree index turns millions of row reads into a handful of page reads.' },
    { q: 'How do you prevent SQL injection?', options: ['Trust your users', 'Use parameterised queries so input is treated as data, never as SQL', 'Use longer passwords', 'Encrypt the query string'], answer: 1, why: 'Placeholders keep input separate from the command.' },
    { q: 'Which statement about NoSQL is correct?', options: ['NoSQL is always faster than SQL', 'It is a family of non-relational stores (key–value, document, wide-column, graph) that each trade guarantees or flexibility for something else', 'NoSQL cannot store JSON', 'NoSQL replaced all relational databases'], answer: 1, why: 'There is no universal winner; pick by the shape of your data and your access pattern.' },
    { q: 'What is a vector database used for in an AI application?', options: ['Storing images only', 'Finding the stored items whose embeddings are nearest to a query embedding (semantic search, RAG)', 'Speeding up the GPU', 'Compressing model weights'], answer: 1, why: 'It finds things by meaning rather than exact keywords (Module 11).' },
    { q: 'When is SQLite a better choice than PostgreSQL?', options: ['Many users writing at once from different servers', 'A prototype or local app that wants a real SQL database in one file with no server to run', 'A 20 TB analytics warehouse', 'A system needing fine-grained user permissions'], answer: 1, why: 'SQLite is an embedded library; Postgres is a server for shared, concurrent use.' },
    { q: 'What is data leakage?', options: ['A hard drive failing', 'Information from the test set (or near copies) getting into training, making results look better than they will be in real use', 'Data sent without encryption', 'Running out of disk space'], answer: 1, why: 'Split train/validation/test first, and split by user or time when rows are related.' },
  ]);
})();
