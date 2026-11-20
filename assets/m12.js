/* Module 12 widget: hosted API vs self-hosted GPU cost (illustrative numbers only) */
(function () {
  const S = { rpdExp: 3.3, tpr: 1500, price: 3, rate: 4, thr: 2500, peak: 3 };
  const bars = $('#cl-bars'), out = $('#cl-out');
  const money = v => '$' + (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2));
  const num = v => Math.round(v).toLocaleString('en-US');

  function draw() {
    const rpd = Math.round(Math.pow(10, S.rpdExp));
    const tokMonth = rpd * S.tpr * 30;
    const api = tokMonth / 1e6 * S.price;
    const avgTps = tokMonth / (30 * 86400);                 // average tokens per second over the month
    const gpus = Math.max(1, Math.ceil(avgTps * S.peak / S.thr)); // enough GPUs for the busiest moments
    const gpu = gpus * S.rate * 730;                         // ~730 hours in a month, billed even when idle
    const util = Math.min(1, avgTps / (gpus * S.thr));
    const max = Math.max(api, gpu);
    renderBars(bars, [
      { label: 'Hosted API', value: api / max, text: money(api) + '/month', cls: api <= gpu ? '' : 'bad' },
      { label: `Own GPU ×${gpus}`, value: gpu / max, text: money(gpu) + '/month', cls: gpu < api ? '' : 'bad' },
      { label: 'GPU busy (average)', value: util, text: (util * 100).toFixed(1) + '%' },
    ]);
    const breakRpd = (730 * S.rate / S.price * 1e6) / (S.tpr * 30);
    const win = api <= gpu ? 'the <b>hosted API</b>' : '<b>your own GPU</b>';
    out.innerHTML = `<div><b>Traffic:</b> ${num(rpd)} requests/day × ${num(S.tpr)} tokens × 30 days = ${num(tokMonth / 1e6)} million tokens/month (about ${avgTps.toFixed(2)} tokens/s on average).</div>
      <div><b>Cheaper:</b> ${win}. Your GPU sits idle ${((1 - util) * 100).toFixed(0)}% of the time on average but you pay for all of it.</div>
      <div><b>Rule of thumb:</b> one GPU at this price costs the same as the API at about <b>${num(breakRpd)}</b> requests/day, but only if that GPU could actually handle that traffic.</div>`;
    out.className = 'readout';
  }
  const add = (el) => $('#cl-ctl').append(el);
  add(slider('Requests per day', 1, 6, 0.1, S.rpdExp, v => { S.rpdExp = v; draw(); }, v => num(Math.pow(10, v))).el);
  add(slider('Tokens per request', 200, 8000, 100, S.tpr, v => { S.tpr = v; draw(); }, v => num(v)).el);
  add(slider('API price per 1M tokens', 0.5, 20, 0.5, S.price, v => { S.price = v; draw(); }, v => '$' + v.toFixed(1)).el);
  add(slider('GPU rental per hour', 1, 12, 0.5, S.rate, v => { S.rate = v; draw(); }, v => '$' + v.toFixed(1)).el);
  add(slider('GPU throughput (tokens/s)', 500, 10000, 250, S.thr, v => { S.thr = v; draw(); }, v => num(v)).el);
  add(slider('Peak ÷ average traffic', 1, 10, 0.5, S.peak, v => { S.peak = v; draw(); }, v => '×' + v).el);
  draw();

  Quiz.mount('#quiz', [
    { q: 'What best describes "the cloud"?', options: ['A special kind of internet that stores data in the sky', "Other organisations' computers in data centres, rented on demand over the network", 'A type of GPU', 'Software that makes your laptop faster'], answer: 1, why: 'It is ordinary computers (running Linux/Windows) that you rent and reach over a network.' },
    { q: 'Your app has very low, spiky traffic. Which is usually cheaper?', options: ['A dedicated GPU instance running 24/7', 'A pay-per-token hosted model API', 'Buying a GPU server', 'They always cost the same'], answer: 1, why: 'A rented GPU bills for time reserved, including idle time. An API bills for work done.' },
    { q: 'Why choose a cloud region close to your users and your data?', options: ['It makes the CPU faster', 'Lower latency (speed-of-light delay), fewer data-transfer fees, and it may be required by data-protection law', 'Regions change the programming language', 'Only for backup'], answer: 1, why: 'Distance costs latency (Module 6); moving data across regions costs money; some data must stay in a jurisdiction.' },
    { q: 'You committed your cloud access key to a public GitHub repo. What is the realistic risk?', options: ['None, nobody reads repos', 'Automated scanners find it within minutes and can run expensive machines on your account', 'GitHub will delete the repo', 'The key stops working by itself'], answer: 1, why: 'Rotate (revoke) the key immediately and keep secrets out of code.' },
    { q: 'A spot (preemptible) GPU is cheap because…', options: ['It is older hardware', 'The provider may reclaim it on short notice, so your job must tolerate interruption (save checkpoints)', 'It has no VRAM', 'It only runs inference'], answer: 1, why: 'You trade reliability for price. Frequent checkpoints make that trade safe.' },
  ]);
})();
