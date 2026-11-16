'use strict';
// Reads Claude Code's own session logs (~/.claude/projects/<project>/<session>.jsonl and the agent logs beside them)
// and turns them into small events for the office view. It only reads files; it never writes or changes anything.
//
// Everything shown comes from the logs: an agent's own short notes, the tool it is using, a hand-off when the lead
// starts an agent, a report going back when an agent finishes, and "reading your notes" when one agent opens a
// file another agent wrote. Nothing is made up. The team chat words each real event in a casual developer voice
// ("pulling up `tracker.js`"), but every line still stands for something that happened in the logs.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

const TAIL_BYTES = 256 * 1024;          // first look at a log that already existed: read only its last 256 KB
const READ_CAP = 4 * 1024 * 1024;       // never read more than 4 MB from one file in one poll
const MAX_LINE = 1500000;               // skip giant lines (big tool results); they carry nothing we show
const RECENT = 45 * 60 * 1000;          // agents whose log changed in the last 45 minutes are shown
const QUIET_AFTER = 2 * 60 * 1000;      // no new log lines for 2 minutes: shown as quiet
const LEAVE_AFTER = 20 * 60 * 1000;     // no new lines for 20 minutes and not finished: the agent leaves the office
const DONE_LINGER = 45 * 60 * 1000;     // a finished agent stays at its desk for 45 minutes after it finished
const SESSION_SCAN_EVERY = 5;           // look for a newer chat every 5 polls

function encodeProject(p) { return p.replace(/[^a-zA-Z0-9]/g, '-'); }
function list(dir) { try { return fs.readdirSync(dir); } catch { return []; } }
function stat(p) { try { return fs.statSync(p); } catch { return null; } }
function short(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function base(p) { return p ? path.basename(String(p)) : ''; }
function hostPath(u) {
  try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).replace(/\/$/, ''); } catch { return String(u || ''); }
}
function firstLine(t) {
  const lines = String(t || '').split('\n')
    .map(s => s.replace(/^[#>*\-+\s|]+/, '').replace(/[*_`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim())
    .filter(s => s && !/^[-|: ]+$/.test(s));
  return lines[0] || '';
}

function hash(str) { let h = 2166136261; str = String(str || ''); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function pick(options, key) { return options[hash(key) % options.length]; }
function code(t) { return '`' + String(t || '').replace(/`/g, "'") + '`'; }
function mention(name) { return '@[' + String(name || '').replace(/[\[\]]/g, '') + ']'; }
// "List files" -> "list files", but keep "SEO audit" and "PDF report" as they are
function lowerFirst(t) { t = String(t || ''); return t.length > 1 && /[A-Z]/.test(t[0]) && /[a-z ]/.test(t[1]) ? t[0].toLowerCase() + t.slice(1) : t; }

// What a tool call looks like as a one-line chat message, with an icon. `key` (the tool call id) picks the wording,
// so the same call always reads the same way.
function describeTool(name, input, key) {
  input = input || {};
  key = String(key || name);
  switch (name) {
    case 'Bash':
      if (input.description) return { icon: '💻', text: pick(['', 'on it, ', 'running: ', 'sec, '], key) + lowerFirst(short(input.description, 90)) };
      return { icon: '💻', text: 'running ' + code(short(input.command, 60)) };
    case 'Read': return { icon: '👀', text: pick(['pulling up ', 'reading ', 'taking a look at '], key) + code(base(input.file_path)) };
    case 'Write': return { icon: '✍️', text: pick(['writing ', 'drafting ', 'creating '], key) + code(base(input.file_path)) };
    case 'Edit': case 'MultiEdit': return { icon: '✏️', text: pick(['patching ', 'editing ', 'tweaking '], key) + code(base(input.file_path)) };
    case 'NotebookEdit': return { icon: '✏️', text: 'editing ' + code(base(input.notebook_path)) };
    case 'Grep': return { icon: '🗂️', text: 'grepping for ' + code(short(input.pattern, 40)) };
    case 'Glob': return { icon: '🗂️', text: 'hunting for ' + code(short(input.pattern, 40)) };
    case 'WebFetch': return { icon: '🌐', text: pick(['checking out ', 'opening '], key) + short(hostPath(input.url), 70) };
    case 'WebSearch': return { icon: '🔎', text: 'searching the web for “' + short(input.query, 60) + '”' };
    case 'ToolSearch': return { icon: '🧰', text: 'grabbing a tool off the shelf' };
    case 'Agent': case 'Task': return { icon: '🤝', text: 'pulling in ' + mention(short(input.description || 'a teammate', 60)) + ' for this one' };
    case 'SendMessage': return { icon: '💬', text: 'pinging ' + short(input.to, 40) };
    case 'Workflow': return { icon: '🧩', text: 'kicking off a team workflow' };
    case 'TaskStop': return { icon: '⏹️', text: 'stopping a task' };
    case 'Artifact': return { icon: '🖼️', text: 'publishing a page' };
    case 'Skill': return { icon: '📘', text: 'opening the ' + code(short(input.skill, 40)) + ' playbook' };
    case 'AskUserQuestion': return { icon: '❓', text: 'need your call on something, check the prompt' };
    case 'TodoWrite': return { icon: '📝', text: 'updating the todo board' };
    case 'SubagentHandback': return { icon: '📨', text: 'handing the report back' };
    case 'ScheduleWakeup': return { icon: '⏰', text: 'setting a reminder' };
    default:
      if (String(name).startsWith('mcp__')) {
        const p = String(name).split('__');
        const server = (p[1] || '').replace(/^claude_ai_/, '').replace(/_/g, ' ');
        return { icon: '🔌', text: 'hitting ' + server + ': ' + (p.slice(2).join(' ').replace(/[_-]/g, ' ')) };
      }
      return { icon: '⚙️', text: 'running ' + code(name) };
  }
}

class Tracker extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.root = opts.projectsDir || path.join(os.homedir(), '.claude', 'projects');
    this.workspaces = opts.workspaces || [];
    this.startedAt = Date.now();
    this.polls = 0;
    this.feed = [];
    this.resetState();
  }

  resetState() {
    this.files = new Map();       // log path -> { offset, rest: Buffer, id, replay, skipPartial }
    this.agents = new Map();      // id -> agent
    this.writers = new Map();     // file path -> { id, name } of the agent that wrote it
    this.handoffs = new Map();    // Agent tool_use id -> time the lead briefed it
    this.seenBlocks = new Set();  // "<line uuid>" already handled
    this.session = null;
    this.order = 0;
  }

  projectDirs() {
    const own = this.workspaces.map(w => path.join(this.root, encodeProject(w))).filter(d => stat(d));
    if (own.length) return own;
    return list(this.root).map(d => path.join(this.root, d)).filter(d => { const s = stat(d); return s && s.isDirectory(); });
  }

  findSession() {
    let best = null;
    for (const d of this.projectDirs()) {
      for (const f of list(d)) {
        if (!f.endsWith('.jsonl')) continue;
        const p = path.join(d, f), s = stat(p);
        if (s && (!best || s.mtimeMs > best.m)) best = { p, m: s.mtimeMs, d, id: f.slice(0, -6) };
      }
    }
    return best;
  }

  // ---- events --------------------------------------------------------------------------------------------------
  push(ev) { this.out.push(ev); }
  // one line for the team chat; also sent live to the office
  chat(item) {
    item.ts = Date.now();
    this.feed.push(item);
    if (this.feed.length > 120) this.feed.splice(0, this.feed.length - 120);
    this.push({ t: 'chat', item });
  }
  from(a) { return { id: a.id, name: a.name, ord: a.order, role: a.kind }; }
  system(text, icon, ref) { this.chat({ id: 'system', name: '', role: 'system', kind: 'system', text, icon: icon || '', ref: ref || '' }); }
  say(a, text, icon, kind, replay, extra) {
    if (!text) return;
    a.lastSay = { text, icon: icon || '', kind, ts: Date.now() };
    if (replay) return;
    this.push({ t: 'say', id: a.id, text, icon: icon || '', kind });
    this.chat({ ...this.from(a), kind, text, icon: icon || '', ...(extra || {}) });
  }
  link(fromId, toId, kind, text, replay, icon) {
    if (replay || !this.agents.has(fromId) || !this.agents.has(toId)) return;
    this.push({ t: 'link', from: fromId, to: toId, kind });
    if (text) this.chat({ ...this.from(this.agents.get(fromId)), kind, text, icon: icon || '' });
  }
  setState(a, state, replay) {
    if (a.state === state) return;
    a.state = state;
    if (!replay) this.push({ t: 'state', id: a.id, state });
  }
  agentInfo(a) {
    return { t: 'agent', id: a.id, name: a.name, kind: a.kind, state: a.state, order: a.order, group: a.group, lastSay: a.lastSay || null, lastChange: a.lastChange || 0 };
  }
  snapshot() {
    return {
      agents: [...this.agents.values()].sort((x, y) => x.order - y.order).map(a => this.agentInfo(a)),
      feed: this.feed.slice(-80),
    };
  }
  counts() {
    let working = 0, done = 0;
    for (const a of this.agents.values()) {
      if (a.kind !== 'agent') continue;
      if (a.state === 'done') done++; else working++;
    }
    return { working, done };
  }

  // ---- polling -------------------------------------------------------------------------------------------------
  poll() {
    const now = Date.now();
    this.out = [];
    if (!this.session || this.polls % SESSION_SCAN_EVERY === 0) {
      const best = this.findSession();
      if (best && (!this.session || (best.p !== this.session.p && now - best.m < 10 * 60 * 1000))) this.switchSession(best);
    }
    this.polls++;
    if (!this.session) return this.flush();

    this.readFile(this.session.p);

    const sub = path.join(this.session.d, this.session.id, 'subagents');
    const logs = [];
    for (const f of list(sub)) if (/^agent-.+\.jsonl$/.test(f)) logs.push(path.join(sub, f));
    const wf = path.join(sub, 'workflows');
    for (const w of list(wf)) for (const f of list(path.join(wf, w))) if (/^agent-.+\.jsonl$/.test(f)) logs.push(path.join(wf, w, f));

    for (const p of logs) {
      if (!this.files.has(p)) {
        const s = stat(p);
        if (!s || now - s.mtimeMs > RECENT) continue;      // an old agent from earlier in this chat
        this.addAgent(p, s);
      }
      this.readFile(p);
    }

    for (const a of [...this.agents.values()]) {
      if (a.kind !== 'agent') continue;
      const silent = now - a.lastChange;
      if (a.endPending && a.state !== 'done' && now - a.lastChange > 3000) this.finish(a, '', a.endPending, false);
      if (a.state === 'done') {
        if (now - a.doneAt > DONE_LINGER) this.removeAgent(a);
      } else if (silent > LEAVE_AFTER) {
        this.removeAgent(a);
      } else if (silent > QUIET_AFTER && a.state !== 'quiet') {
        this.setState(a, 'quiet', false);
        this.system(mention(a.name) + ' stepped out for a coffee', '☕', a.id);
      }
    }
    return this.flush();
  }

  flush() {
    const evs = this.out;
    this.out = [];
    if (evs.length) this.emit('events', evs);
    return evs;
  }

  switchSession(best) {
    this.resetState();
    this.session = best;
    this.push({ t: 'reset' });
    const lead = { id: 'lead', name: 'Claude', kind: 'lead', state: 'working', order: this.order++, group: '', lastChange: Date.now() };
    this.agents.set(lead.id, lead);
    this.files.set(best.p, this.newFileRecord(best.p, 'lead', true));
    this.push(this.agentInfo(lead));
  }

  newFileRecord(p, id, existed) {
    const s = stat(p);
    const size = s ? s.size : 0;
    const tail = existed && size > TAIL_BYTES;
    return { offset: tail ? size - TAIL_BYTES : 0, rest: Buffer.alloc(0), id, replay: existed, skipPartial: tail };
  }

  addAgent(p, s) {
    const id = path.basename(p).replace(/^agent-/, '').replace(/\.jsonl$/, '');
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(p.replace(/\.jsonl$/, '.meta.json'), 'utf8')); } catch { /* meta not written yet */ }
    const existed = s.birthtimeMs < this.startedAt;
    const a = {
      id, kind: 'agent', name: meta.description || 'Agent', group: meta.workflowPhase ? 'workflow' : 'team',
      state: 'working', order: this.order++, lastChange: s.mtimeMs, toolUseId: meta.toolUseId || null, doneAt: 0,
      addedPoll: this.polls, endPending: 0,
    };
    this.agents.set(id, a);
    this.files.set(p, this.newFileRecord(p, id, existed));
    this.push(this.agentInfo(a));
    if (!existed) {
      // a new agent: the lead hands it its brief. If the lead's own "pulling in …" line already said so, stay quiet.
      const briefed = a.toolUseId && this.handoffs.has(a.toolUseId);
      this.link('lead', id, 'handoff', briefed ? '' : mention(a.name) + ' you’re up, brief is in your inbox', false, '📋');
      this.system(mention(a.name) + ' joined #crew-chat', '👋', id);
    }
  }

  removeAgent(a) {
    this.agents.delete(a.id);
    for (const [p, rec] of this.files) if (rec.id === a.id) this.files.set(p, { ...rec, gone: true });
    if (a.addedPoll === this.polls) this.out = this.out.filter(e => e.id !== a.id && e.from !== a.id && e.to !== a.id);
    else {
      this.push({ t: 'leave', id: a.id });
      this.system(mention(a.name) + ' left the office', '🚪', a.id);
    }
  }

  readFile(p) {
    const rec = this.files.get(p);
    if (!rec || rec.gone) return;
    const s = stat(p);
    if (!s) return;
    if (s.size < rec.offset) { rec.offset = 0; rec.rest = Buffer.alloc(0); }
    if (s.size === rec.offset) { if (rec.replay) this.endReplay(rec); return; }
    const len = Math.min(s.size - rec.offset, READ_CAP);
    const buf = Buffer.alloc(len);
    let fd;
    try { fd = fs.openSync(p, 'r'); fs.readSync(fd, buf, 0, len, rec.offset); } catch { return; } finally { if (fd !== undefined) fs.closeSync(fd); }
    rec.offset += len;
    let data = rec.rest.length ? Buffer.concat([rec.rest, buf]) : buf;
    if (rec.skipPartial) {
      const nl = data.indexOf(10);
      if (nl === -1) { rec.rest = data; return; }
      data = data.subarray(nl + 1);
      rec.skipPartial = false;
    }
    const last = data.lastIndexOf(10);
    if (last === -1) { rec.rest = data; return; }
    rec.rest = Buffer.from(data.subarray(last + 1));
    const a = this.agents.get(rec.id);
    if (!a) return;
    a.lastChange = s.mtimeMs;
    if (a.state === 'quiet') this.setState(a, a.kind === 'lead' ? 'working' : 'thinking', rec.replay);
    let start = 0;
    while (start <= last) {
      const end = data.indexOf(10, start);
      if (end - start > 1 && end - start < MAX_LINE) this.handleLine(a, data.toString('utf8', start, end), rec.replay);
      start = end + 1;
    }
    if (rec.replay && rec.offset >= s.size) this.endReplay(rec);
  }

  // After catching up on an old log, show where that agent is now, without replaying every old bubble
  endReplay(rec) {
    rec.replay = false;
    const a = this.agents.get(rec.id);
    if (!a) return;
    this.push(this.agentInfo(a));
    if (a.lastSay) this.push({ t: 'say', id: a.id, text: a.lastSay.text, icon: a.lastSay.icon, kind: a.lastSay.kind, quiet: true });
  }

  handleLine(a, line, replay) {
    let o;
    try { o = JSON.parse(line); } catch { return; }
    if (o.uuid) { if (this.seenBlocks.has(o.uuid)) return; this.seenBlocks.add(o.uuid); }
    const msg = o.message;
    const ts = Date.parse(o.timestamp) || Date.now();
    if (o.type === 'assistant' && msg && Array.isArray(msg.content)) {
      for (const b of msg.content) {
        if (b.type === 'tool_use') this.onTool(a, b, replay, ts);
        else if (b.type === 'text' && b.text && b.text.trim()) this.onText(a, b.text, msg.stop_reason, replay);
      }
      if (msg.stop_reason === 'end_turn') this.onEndTurn(a, msg, replay, ts);
    } else if (o.type === 'user' && msg) {
      const c = msg.content;
      if (Array.isArray(c) && c.some(x => x && x.type === 'tool_result')) {
        if (a.state !== 'done') this.setState(a, a.kind === 'lead' ? 'working' : 'thinking', replay);
        return;
      }
      if (a.kind === 'lead' && !o.isMeta && !o.isCompactSummary && !o.isSidechain) {
        const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter(x => x && x.type === 'text').map(x => x.text).join(' ') : '';
        const t = text.trim();
        if (t && !t.startsWith('<') && !t.startsWith('[SYSTEM') && !t.startsWith('This session is being continued')) {
          this.setState(a, 'working', replay);
          if (!replay) this.chat({ id: 'you', name: 'You', ord: -1, role: 'you', kind: 'you', text: short(t, 280), icon: '' });
          if (!replay) this.push({ t: 'you', text: short(t, 140) });
        }
      }
    }
  }

  onTool(a, b, replay, ts) {
    const input = b.input || {};
    // a background agent hands its finished report back to the lead with this tool
    if (b.name === 'SubagentHandback' && a.kind === 'agent') {
      const head = firstLine(String(input.message || '').replace(/^.*?(?=#)/s, '')) || firstLine(input.message);
      this.finish(a, short(head, 100), ts, replay);
      return;
    }
    a.endPending = 0;
    if (a.state === 'done' || a.state === 'quiet' || a.state === 'thinking' || a.state === 'waiting') this.setState(a, 'working', replay);
    const d = describeTool(b.name, input, b.id);

    if (b.name === 'Agent' || b.name === 'Task') {
      this.handoffs.set(b.id, Date.now());
    }
    if (b.name === 'SendMessage') {
      const target = [...this.agents.values()].find(x => x.id === input.to || x.name === input.to);
      const words = short(input.summary || input.message || '', 120);
      this.say(a, (target ? mention(target.name) : '@' + short(input.to, 40)) + ' ' + words, '💬', 'message', replay);
      if (target) this.link(a.id, target.id, 'message', '', replay);
      return;
    }
    if ((b.name === 'Write' || b.name === 'Edit') && input.file_path) this.writers.set(path.resolve(input.file_path), { id: a.id, name: a.name });
    if (b.name === 'Read' && input.file_path) {
      const w = this.writers.get(path.resolve(input.file_path));
      if (w && w.id !== a.id) {
        this.say(a, 'reading ' + mention(w.name) + '’s ' + code(base(input.file_path)), '📄', 'notes', replay);
        this.link(w.id, a.id, 'notes', '', replay);
        return;
      }
    }
    this.say(a, d.text, d.icon, 'tool', replay);
  }

  onText(a, text, stop, replay) {
    if (a.kind === 'agent' && stop === 'end_turn') return;      // the final report: shown as "done" instead
    const line = firstLine(text);
    if (line) this.say(a, short(line, 140), '', 'talk', replay);
  }

  onEndTurn(a, msg, replay, ts) {
    if (a.kind === 'lead') { this.setState(a, 'waiting', replay); return; }
    if (a.state === 'done') return;
    const textBlock = (msg.content || []).find(b => b.type === 'text' && b.text);
    // the final message can arrive split over several lines; finish on the one that carries the text
    if (!textBlock) { a.endPending = ts; return; }
    this.finish(a, short(firstLine(textBlock.text), 100), ts, replay);
  }

  finish(a, head, ts, replay) {
    a.endPending = 0;
    a.doneAt = ts || Date.now();
    this.setState(a, 'done', replay);
    this.say(a, 'report’s ready' + (head ? ': ' + head : ''), '✅', 'done', replay, { head });
    if (!replay) {
      this.link(a.id, 'lead', 'report', '', false);
      this.push({ t: 'done', id: a.id, name: a.name });
    }
  }
}

module.exports = { Tracker, describeTool, encodeProject };
