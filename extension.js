'use strict';
const vscode = require('vscode');
const crypto = require('crypto');
const { Tracker } = require('./tracker');

class OfficeView {
  constructor(context, tracker) {
    this.context = context;
    this.tracker = tracker;
    this.view = null;
  }
  get visible() { return !!(this.view && this.view.visible); }

  resolveWebviewView(view) {
    this.view = view;
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    view.webview.options = { enableScripts: true, localResourceRoots: [media] };
    const nonce = crypto.randomBytes(16).toString('hex');
    const js = view.webview.asWebviewUri(vscode.Uri.joinPath(media, 'office.js'));
    const css = view.webview.asWebviewUri(vscode.Uri.joinPath(media, 'office.css'));
    const csp = view.webview.cspSource;
    view.webview.html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${csp} data:; style-src ${csp}; script-src 'nonce-${nonce}'; font-src ${csp};">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${css}"><title>Agent Crew</title></head>
<body>
  <div id="app">
    <div id="stage"><button id="chatToggle" type="button" title="Show or hide the team chat">💬</button>
      <canvas id="office" aria-label="Pixel office with your agents in the lobby, meeting room, dev floor, café and game room"></canvas>
      <div id="toasts" aria-live="polite"></div>
    </div>
    <aside id="side" aria-label="Team chat">
      <header id="head">
        <div class="title"><span class="hash">#</span>crew-chat <span id="online"></span></div>
        <div id="faces"></div>
        <div class="topic">live from your Claude Code logs · read-only · 0 tokens</div>
      </header>
      <div id="feed" role="log" aria-live="polite"></div>
      <button id="newmsgs" type="button" hidden>New messages ↓</button>
      <footer id="typing"></footer>
    </aside>
  </div>
  <script nonce="${nonce}" src="${js}"></script>
</body></html>`;
    view.webview.onDidReceiveMessage(m => {
      if (m && m.type === 'ready') this.post({ type: 'snapshot', ...this.tracker.snapshot() });
    });
    view.onDidDispose(() => { if (this.view === view) this.view = null; });
  }

  post(msg) { if (this.view) this.view.webview.postMessage(msg); }
}

function activate(context) {
  const cfg = () => vscode.workspace.getConfiguration('agentCrew');
  const tracker = new Tracker({
    projectsDir: cfg().get('projectsDir') || '',
    workspaces: (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath),
  });
  const view = new OfficeView(context, tracker);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('agentCrew.office', view));

  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 40);
  bar.command = 'agentCrew.show';
  context.subscriptions.push(bar);
  const updateBar = () => {
    const { working, done } = tracker.counts();
    if (!working && !done) { bar.hide(); return; }
    bar.text = working ? `$(organization) ${working} working${done ? ` · ${done} done` : ''}` : `$(check-all) ${done} done`;
    bar.tooltip = 'Agent Crew: open the office';
    bar.show();
  };

  // light pop-ups: one small notice per batch of finished agents, and one when the whole team is done
  let finished = [], timer = null, hadWork = false;
  const notifyDone = names => {
    if (!cfg().get('notifyWhenDone')) return;
    const text = names.length === 1 ? `${names[0]} shipped its report.` : `${names.length} agents shipped their reports: ${names.join(', ')}.`;
    vscode.window.showInformationMessage(text, 'Open office').then(c => { if (c) vscode.commands.executeCommand('agentCrew.show'); });
  };

  tracker.on('events', evs => {
    view.post({ type: 'events', events: evs });
    for (const e of evs) if (e.t === 'done') finished.push(e.name);
    if (finished.length && !timer) {
      timer = setTimeout(() => {
        const names = finished; finished = []; timer = null;
        notifyDone(names);
        const { working } = tracker.counts();
        if (!working && cfg().get('notifyWhenDone')) vscode.window.setStatusBarMessage('$(check-all) Agent Crew: the whole team has finished', 8000);
      }, 2500);
    }
    const { working } = tracker.counts();
    if (working) hadWork = true;
    else if (hadWork) hadWork = false;
    updateBar();
  });

  let stopped = false, handle = null;
  const loop = () => {
    if (stopped) return;
    try { tracker.poll(); } catch (e) { console.error('[Agent Crew]', e); }
    handle = setTimeout(loop, view.visible ? 1000 : 2500);
  };
  loop();
  context.subscriptions.push({ dispose() { stopped = true; clearTimeout(handle); clearTimeout(timer); } });

  context.subscriptions.push(vscode.commands.registerCommand('agentCrew.show', () =>
    vscode.commands.executeCommand('workbench.view.extension.agentCrew').then(undefined, () =>
      vscode.commands.executeCommand('agentCrew.office.focus'))));
}

function deactivate() {}

module.exports = { activate, deactivate };
