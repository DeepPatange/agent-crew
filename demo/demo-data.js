// Sample data for the demo page. In VS Code this data comes from tracker.js reading Claude Code's session logs;
// here it is made up, in the same shape, so the office can run in a plain browser.
(function () {
  'use strict';
  const T = Date.now(), min = 60 * 1000;
  const at = m => T - m * min;

  // a stand-in for the VS Code webview API
  let state = {};
  window.acquireVsCodeApi = () => ({
    getState: () => state,
    setState: s => { state = s; },
    postMessage: m => { if (m && m.type === 'ready') setTimeout(start, 50); },
  });
  const send = msg => window.postMessage(msg, '*');

  const agent = (id, name, kind, state, order, lastSay) => ({ t: 'agent', id, name, kind, state, order, group: '', lastSay: lastSay || null, lastChange: T });
  const who = (id, name, ord, role) => ({ id, name, ord, role });
  const lead = who('lead', 'Claude', 0, 'lead');
  const seo = who('a1', 'SEO audit', 1, 'agent');
  const bug = who('a2', 'Fix checkout bug', 2, 'agent');
  const tests = who('a3', 'Write API tests', 3, 'agent');
  const research = who('a4', 'Research competitors', 4, 'agent');
  const refactor = who('a5', 'Refactor tracker', 5, 'agent');
  const docs = who('a6', 'Update docs', 6, 'agent');
  const hero = who('a7', 'Design hero section', 7, 'agent');

  const snapshot = {
    type: 'snapshot',
    agents: [
      agent('lead', 'Claude', 'lead', 'working', 0, { text: 'splitting this into 7 jobs', icon: '🧠', kind: 'note' }),
      agent('a1', 'SEO audit', 'agent', 'working', 1, { text: 'grepping for `canonical`', icon: '🗂️', kind: 'tool' }),
      agent('a2', 'Fix checkout bug', 'agent', 'thinking', 2, { text: 'the total is off by the coupon', icon: '🤔', kind: 'note' }),
      agent('a3', 'Write API tests', 'agent', 'working', 3, { text: 'writing `orders.test.ts`', icon: '✍️', kind: 'tool' }),
      agent('a4', 'Research competitors', 'agent', 'quiet', 4),
      agent('a5', 'Refactor tracker', 'agent', 'done', 5),
      agent('a6', 'Update docs', 'agent', 'done', 6),
    ],
    feed: [
      { id: 'you', name: 'You', ord: -1, role: 'you', kind: 'you', text: 'Get the store ready for launch: SEO, the checkout bug, tests and docs.', icon: '', ts: at(14) },
      { ...lead, kind: 'note', text: 'on it. splitting this into a few jobs for the team', icon: '🧠', ts: at(13.8) },
      { ...lead, kind: 'handoff', text: '@[Refactor tracker] you’re up, brief is in your inbox', icon: '📋', ts: at(13.6) },
      { ...lead, kind: 'handoff', text: '@[Update docs] you’re up, brief is in your inbox', icon: '📋', ts: at(13.5) },
      { ...refactor, kind: 'tool', text: 'pulling up `tracker.js`', icon: '👀', ts: at(13) },
      { ...refactor, kind: 'tool', text: 'patching `tracker.js`', icon: '✏️', ts: at(11) },
      { ...refactor, kind: 'done', text: '', head: 'Split the log reader into `readLines()` and `apply()`; polling is down to new lines only.', icon: '', ts: at(9) },
      { ...docs, kind: 'tool', text: 'drafting `README.md`', icon: '✍️', ts: at(10) },
      { ...docs, kind: 'done', text: '', head: 'README now covers install, settings and the demo page.', icon: '', ts: at(7) },
      { ...lead, kind: 'handoff', text: '@[SEO audit] @[Fix checkout bug] @[Write API tests] you’re up', icon: '📋', ts: at(6) },
      { ...research, kind: 'tool', text: 'searching the web for “headless shopify checkout fees”', icon: '🔎', ts: at(5.5) },
      { ...research, kind: 'note', text: 'found 3 good examples, writing them up', icon: '📝', ts: at(4) },
      { ...seo, kind: 'tool', text: 'reading `sitemap.ts`', icon: '👀', ts: at(3) },
      { ...seo, kind: 'tool', text: 'grepping for `canonical`', icon: '🗂️', ts: at(2.6) },
      { ...bug, kind: 'tool', text: 'on it, run the checkout tests', icon: '💻', ts: at(2.2) },
      { ...bug, kind: 'note', text: 'the total is off by the coupon, looking at `cart.ts`', icon: '🤔', ts: at(1.5) },
      { ...tests, kind: 'notes', text: 'reading @[Fix checkout bug]’s `coupon-notes.md`', icon: '📄', ts: at(1.2) },
      { ...tests, kind: 'tool', text: 'writing `orders.test.ts`', icon: '✍️', ts: at(0.8) },
    ],
  };

  // a few live events after the page opens: a new agent rides up, joins a kickoff, and the team keeps working
  const timeline = [
    [1200, [{ t: 'agent', id: 'a7', name: 'Design hero section', kind: 'agent', state: 'working', order: 7, group: '' },
            { t: 'link', from: 'lead', to: 'a7', kind: 'handoff' },
            { t: 'chat', item: { ...lead, kind: 'handoff', text: '@[Design hero section] you’re up, brief is in your inbox', icon: '📋', ts: Date.now() } }]],
    [2600, [{ t: 'say', id: 'a1', text: 'patching `layout.tsx`', icon: '✏️', kind: 'tool' },
            { t: 'chat', item: { ...seo, kind: 'tool', text: 'patching `layout.tsx`', icon: '✏️', ts: Date.now() } }]],
    [4200, [{ t: 'say', id: 'a2', text: 'found it: coupon applied twice', icon: '💡', kind: 'note' },
            { t: 'state', id: 'a2', state: 'working' },
            { t: 'chat', item: { ...bug, kind: 'note', text: 'found it: the coupon is applied twice', icon: '💡', ts: Date.now() } }]],
    [6500, [{ t: 'say', id: 'a7', text: 'pulling up `Hero.tsx`', icon: '👀', kind: 'tool' },
            { t: 'chat', item: { ...hero, kind: 'tool', text: 'pulling up `Hero.tsx`', icon: '👀', ts: Date.now() } }]],
  ];

  function start() {
    send(snapshot);
    for (const [ms, events] of timeline) setTimeout(() => send({ type: 'events', events }), ms);
  }
})();
