// Agent Crew office view: a little pixel HQ (lobby, meeting room, dev floor, café, game room) and the team chat.
// Agents move between rooms according to their real state in Claude Code's session logs:
//   a new agent rides up the elevator, joins a short kickoff in the meeting room, then sits at its desk
//   working or thinking → at its desk · quiet for a while → café · finished → game room · gone → back to the elevator
//   the lead runs the kickoffs and takes a coffee while it waits for you.
// The office cat is the only thing on screen that is not driven by the logs.
(function () {
  'use strict';
  const vscode = acquireVsCodeApi();
  const $ = id => document.getElementById(id);
  const app = $('app'), stage = $('stage'), cv = $('office'), ctx = cv.getContext('2d');
  const feedEl = $('feed'), toastsEl = $('toasts'), typingEl = $('typing'), onlineEl = $('online'), facesEl = $('faces');
  const newPill = $('newmsgs'), chatBtn = $('chatToggle');
  const world = document.createElement('canvas'), wc = world.getContext('2d');

  // ---- look ------------------------------------------------------------------------------------------------------
  const SHIRTS = ['#4F86F7', '#2BB673', '#E9B44C', '#9B5DE5', '#F15BB5', '#00A6D6', '#FB5607', '#7FB800', '#FF595E', '#1982C4', '#6A4C93', '#E0A100'];
  const LEAD_SHIRT = '#D97757', YOU_COLOR = '#E0B84A';
  const HAIR = ['#2d1b10', '#4a2c17', '#151515', '#6b4423', '#8b4513', '#c9a227', '#3b3b3b', '#7a3b2e'];
  const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#a86b3c', '#ffdbac', '#8d5524'];
  const PANTS = ['#2f3b52', '#3b3b44', '#4a3b2f', '#2d4a3e', '#3d3357'];
  const HEADS = [
    ['.hhhhhh.', 'hhhhhhhh', 'hssssssh', 'ssessess', 'ssssssss', '.ssmmss.', '..ssss..'],
    ['.hhhhhh.', 'hhhhhhhh', 'hhsssshh', 'hsessesh', 'hssssssh', 'hssmmssh', 'h.ssss.h'],
    ['h.hh.hh.', 'hhhhhhhh', 'hssssssh', 'ssessess', 'ssssssss', '.ssmmss.', '..ssss..'],
  ];
  const HEADS_BLINK = HEADS.map(h => h.map(r => r.replace(/e/g, 'k')));
  const BACKS = [
    ['.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', '.hhhhhh.', '..ssss..'],
    ['.hhhhhh.', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hh.ss.hh'],
    ['h.hh.hh.', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', 'hhhhhhhh', '.hhhhhh.', '..ssss..'],
  ];
  const SIDES = [
    ['.hhhhhh.', 'hhhhhhhh', 'hhhsssss', 'hhsssess', 'hhssssss', '.hssssm.', '..ssss..'],
    ['.hhhhhh.', 'hhhhhhhh', 'hhhsssss', 'hhsssess', 'hhssssss', 'hhssssm.', 'hhssss..'],
    ['h.hh.hh.', 'hhhhhhhh', 'hhhsssss', 'hhsssess', 'hhssssss', '.hssssm.', '..ssss..'],
  ];
  const SEAT_FRONT = ['...ssss...', '.cccccccc.', 'cccccccccc', 'cccccccccc', 'cdccccccdc', 'cdccccccdc'];
  const SEAT_BACK = ['...ssss...', '.cccccccc.', 'cccccccccc', 'cccccccccc', 'cccccccccc', 'cdccccccdc'];
  const BODY_FRONT = ['.cccccccc.', 'cccccccccc', 'cdccccccdc', 'cdccccccdc', 'sdccccccds', '..pppppp..'];
  const BODY_BACK = ['.cccccccc.', 'cccccccccc', 'cccccccccc', 'cdccccccdc', 'sdccccccds', '..pppppp..'];
  const BODY_SIDE = [
    ['...cccc...', '..cccccc..', '..cccccc..', '..ccdccc..', '..ccsccc..', '..pppppp..'],
    ['...cccc...', '..cccccc..', '..cccccc..', '..cccdcc..', '..ccccsc..', '..pppppp..'],
    ['...cccc...', '..cccccc..', '..cccccc..', '..cdcccc..', '..cscccc..', '..pppppp..'],
  ];
  const LEGS_FRONT = [
    ['..pp..pp..', '..pp..pp..', '..bb..bb..'],
    ['..pp..pp..', '..pp..bb..', '..bb......'],
    ['..pp..pp..', '..bb..pp..', '......bb..'],
  ];
  const LEGS_SIDE = [
    ['...pppp...', '...pp.pp..', '...bb.bb..'],
    ['...pppp...', '..pp...pp.', '.bb.....bb'],
    ['...pppp...', '....pp....', '....bbb...'],
  ];
  const CHECK = ['......g', '.....g.', 'g...g..', '.g.g...', '..g....'];
  const CAT_WALK = [
    ['o......o.o', 'o......ooo', '.oddoddoeo', '..oooooooq', '..oooooooo', '..w.w..w.w'],
    ['o......o.o', 'o......ooo', '.oddoddoeo', '..oooooooq', '..oooooooo', '...w.w.w..'],
  ];
  const CAT_SLEEP = ['.......o.o', '..oooooooo', '.oddoddokq', 'oooooooooo', 'o.wooooww.'];
  const CAT_PAL = { o: '#e8a35c', d: '#c0773a', w: '#f4efe6', e: '#2b2b2b', k: '#7a4a20', q: '#e58a9b' };
  const mirror = map => map.map(r => r.split('').reverse().join(''));
  const SIDES_L = SIDES.map(mirror), BODY_SIDE_L = BODY_SIDE.map(mirror), LEGS_SIDE_L = LEGS_SIDE.map(mirror);
  const CAT_WALK_L = CAT_WALK.map(mirror), CAT_SLEEP_L = mirror(CAT_SLEEP);

  const PAL = {
    dark: {
      page: '#1b1a24', edge: '#15131d', edgeText: 'rgba(230,226,255,0.5)', corr: '#4a4756', corrB: '#45424f', runner: '#5b4a6e', runnerB: '#655379',
      divider: '#2a2638', dividerTop: '#5d5580', glass: 'rgba(160,205,240,0.16)', glassEdge: 'rgba(190,225,255,0.45)',
      lobbyWall: '#45425a', lobbyFloor: ['#55525f', '#4d4a57'], meetWall: '#30455a', meetFloor: ['#2e4756', '#2a4250'], rug: '#3b5d6e',
      devWall: '#3a3350', devTrim: '#4a4166', devFloor: ['#2f3440', '#2b303b'], cafeWall: '#4e3a36', tile: '#cfc8bd', grout: '#a39b8f',
      cafeFloor: ['#5a4232', '#523b2d'], seam: '#46332a', cabinet: '#7b5a3c', gameWall: '#241c38', gameFloor: ['#33284a', '#2f2544'],
      gameRug: '#4a2f6e', frame: '#5b5470', chair: '#444457', chairTop: '#55556b', kb: '#c9ccd6', base: '#1e1b2b', fridge: '#aab2bf',
      tag: 'rgba(16,15,24,0.78)', tagText: '#eceaf6', board: '#f5f5f2',
    },
    light: {
      page: '#f3f1ec', edge: '#9aa3b5', edgeText: 'rgba(255,255,255,0.92)', corr: '#e7e1d6', corrB: '#e0d9cc', runner: '#b9a6cf', runnerB: '#c4b3d8',
      divider: '#b4bccb', dividerTop: '#d3d9e4', glass: 'rgba(120,170,210,0.18)', glassEdge: 'rgba(90,140,190,0.55)',
      lobbyWall: '#d9dde6', lobbyFloor: ['#e4e4ea', '#dcdce3'], meetWall: '#cddbe6', meetFloor: ['#a9c7d3', '#a2c0cc'], rug: '#8fb3c2',
      devWall: '#cfd9e8', devTrim: '#b8c6dc', devFloor: ['#e6e0d4', '#ded7c9'], cafeWall: '#f1e3d3', tile: '#ffffff', grout: '#d8d0c4',
      cafeFloor: ['#c99e6e', '#c0935f'], seam: '#a97d50', cabinet: '#b98b5e', gameWall: '#d4c8ea', gameFloor: ['#c7b6dd', '#bfaed6'],
      gameRug: '#a58bcf', frame: '#7d8aa3', chair: '#6b6b7d', chairTop: '#7c7c90', kb: '#f0f1f5', base: '#93a1b8', fridge: '#d7dbe2',
      tag: 'rgba(255,255,255,0.88)', tagText: '#1f2330', board: '#ffffff',
    },
  };

  // ---- building plan (office pixels) -----------------------------------------------------------------------------
  const ROW_H = 152, WALL_H = 30, FLOOR_Y = 32, CORR_Y = 124, CORR_H = 20, WALK_Y = 135, HALL_W = 16;
  const DESK_W = 58, DESK_H = 46, MIN_COLS = 3;
  const ROOM_NAMES = { lobby: 'LOBBY', meet: 'MEETING ROOM', dev: 'DEV FLOOR', cafe: 'CAFÉ', game: 'GAME ROOM' };
  const LABEL = { working: 'working', thinking: 'thinking', quiet: 'coffee break', done: 'done ✓', waiting: 'waiting for you' };
  const SEATED = new Set(['desk', 'seatFront', 'seatBack']);
  const MEET_SEATS = ['meet:b0', 'meet:b1', 'meet:b2', 'meet:f0', 'meet:f1', 'meet:f2'];
  const CAFE_SPOTS = ['cafe:t0', 'cafe:t1', 'cafe:t2', 'cafe:t3', 'cafe:coffee', 'cafe:s0', 'cafe:s1'];
  const LEAD_CAFE = ['cafe:coffee', 'cafe:t0', 'cafe:t1', 'cafe:t2', 'cafe:t3', 'cafe:s0', 'cafe:s1'];
  const GAME_SPOTS = ['game:bb0', 'game:bb1', 'game:p0', 'game:p1', 'game:arc', 'game:so0', 'game:so1', 'game:s0', 'game:s1', 'game:s2'];
  const CAT_SPOTS = ['cat:lobby', 'cat:meet', 'cat:cafe', 'cat:game', 'cat:dev'];

  const agents = new Map(), occ = new Map(), here = new Map(), desks = [], flights = [];
  let order = [];
  let L = null, S = 2, OX = 0, OY = 0, cssW = 0, cssH = 0;
  let dark = true, fontFamily = 'sans-serif', bg = null, bgKey = '', elevUntil = 0;
  let mouse = null;
  const cat = { pos: null, target: null, at: null, path: [], face: 'right', speed: 28, next: 0, isCat: true };

  // ---- helpers -------------------------------------------------------------------------------------------------
  const now = () => performance.now();
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = v => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
    return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => ch(v).toString(16).padStart(2, '0')).join('');
  }
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  function fill(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function sprite(c, map, x, y, pal) {
    x = Math.round(x); y = Math.round(y);
    for (let r = 0; r < map.length; r++) {
      const row = map[r];
      for (let k = 0; k < row.length; k++) { const col = pal[row[k]]; if (col) { c.fillStyle = col; c.fillRect(x + k, y + r, 1, 1); } }
    }
  }
  function checker(c, x, y, w, h, size, a, b) {
    for (let yy = 0; yy < h; yy += size) for (let xx = 0; xx < w; xx += size) fill(c, x + xx, y + yy, Math.min(size, w - xx), Math.min(size, h - yy), ((xx + yy) / size) % 2 ? a : b);
  }
  function hhmm(ts) { const d = ts ? new Date(ts) : new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function plain(t) { return String(t || '').replace(/`([^`]+)`/g, '$1').replace(/@\[([^\]]+)\]/g, '@$1'); }
  function pal() { return dark ? PAL.dark : PAL.light; }
  function readTheme() {
    const b = document.body.classList;
    dark = !(b.contains('vscode-light') || b.contains('vscode-high-contrast-light'));
    fontFamily = getComputedStyle(document.body).getPropertyValue('--vscode-font-family').trim() || 'sans-serif';
    bg = null; avatars.clear();
  }
  function lookFor(id, name, kind, ord) {
    const h = hash(id + '|' + name);
    const shirt = kind === 'lead' || id === 'lead' ? LEAD_SHIRT : id === 'you' ? YOU_COLOR : SHIRTS[(Math.max(1, ord | 0) - 1) % SHIRTS.length];
    return { shirt, hair: HAIR[h % HAIR.length], skin: SKIN[(h >>> 4) % SKIN.length], headV: (h >>> 8) % HEADS.length, pants: PANTS[(h >>> 12) % PANTS.length], seed: h % 5000 };
  }
  function paletteOf(lk) { return { s: lk.skin, c: lk.shirt, d: shade(lk.shirt, -0.25), h: lk.hair, e: '#1b1b22', m: '#b5523b', k: shade(lk.skin, -0.3), p: lk.pants, b: '#1d1d22' }; }

  // ---- layout ----------------------------------------------------------------------------------------------------
  function makeLayout(mode, cols) {
    const widths = { lobby: 34, meet: 96, dev: 12 + cols * DESK_W, cafe: 96, game: 118 };
    const rowsDef = mode === 'one' ? [['lobby', 'meet', 'dev', 'cafe', 'game']] : [['lobby', 'dev'], ['meet', 'cafe', 'game']];
    const x0 = mode === 'one' ? 0 : HALL_W;
    const rooms = {};
    let W = 0;
    rowsDef.forEach((names, r) => {
      let x = x0;
      for (const n of names) { rooms[n] = { name: n, x, y: r * ROW_H, w: widths[n], row: r, first: x === x0 }; x += widths[n]; }
      W = Math.max(W, x);
    });
    rowsDef.forEach(names => { const last = rooms[names[names.length - 1]]; last.w = W - last.x; });
    const lay = { mode, cols, W, H: rowsDef.length * ROW_H, rows: rowsDef.length, rooms, spots: new Map() };
    addSpots(lay);
    return lay;
  }

  // Every place someone can be. door = where it meets the corridor, via = the way in, (ax, ay) = where the walk ends.
  function addSpots(lay) {
    const R = lay.rooms;
    const put = (key, room, kind, x, y, o = {}) => {
      const r = R[room];
      const door = o.door == null ? x : o.door;
      lay.spots.set(key, {
        key, room, kind, row: r.row, x: r.x + x, y: r.y + y, door: r.x + door,
        via: (o.via || []).map(p => ({ x: r.x + p[0], y: r.y + p[1] })),
        ax: r.x + (o.ax == null ? x : o.ax), ay: r.y + (o.ay == null ? y : o.ay), tagDy: o.tagDy || 0,
      });
    };
    put('elevator', 'lobby', 'stand', 17, 46);
    [30, 48, 66].forEach((x, i) => {
      put('meet:b' + i, 'meet', 'seatFront', x, 62, { door: 8, via: [[8, 52]], ax: x, ay: 52, tagDy: i === 1 ? 8 : 0 });
      put('meet:f' + i, 'meet', 'seatBack', x, 86, { ay: 94, tagDy: i === 1 ? 8 : 0 });
    });
    put('meet:present', 'meet', 'present', 86, 46);
    const pad = Math.max(0, Math.floor((R.dev.w - (12 + lay.cols * DESK_W)) / 2));
    for (let i = 0; i < lay.cols * 2; i++) {
      const sx = 6 + pad + Math.floor(i / 2) * DESK_W, top = FLOOR_Y + (i % 2) * DESK_H + 24, cx = sx + 29;
      put('desk:' + i, 'dev', 'desk', cx, top, { door: sx, via: [[sx, top - 3]], ax: cx, ay: top - 3 });
    }
    put('cafe:coffee', 'cafe', 'coffee', 15, 47);
    [[24, 74, 8], [36, 74, 8], [60, 100, 84], [72, 100, 84]].forEach(([x, y, door], i) =>
      put('cafe:t' + i, 'cafe', 'seatFront', x, y, { door, via: [[door, y - 5]], ax: x, ay: y - 5, tagDy: i % 2 ? 8 : 0 }));
    put('cafe:s0', 'cafe', 'mug', 50, 54);
    put('cafe:s1', 'cafe', 'mug', 62, 49);
    put('game:bb0', 'game', 'seatBack', 24, 60, { door: 5, via: [[5, 70]], ax: 24, ay: 70 });
    put('game:bb1', 'game', 'seatBack', 42, 60, { door: 5, via: [[5, 70]], ax: 42, ay: 70, tagDy: 8 });
    put('game:p0', 'game', 'pong', 56, 93);
    put('game:p1', 'game', 'pong', 104, 93);
    put('game:arc', 'game', 'standBack', 103, 54, { door: 113, via: [[113, 54]] });
    put('game:so0', 'game', 'seatBack', 22, 93, { ay: 104 });
    put('game:so1', 'game', 'seatBack', 36, 93, { ay: 104, tagDy: 8 });
    put('game:s0', 'game', 'stand', 72, 62);
    put('game:s1', 'game', 'stand', 86, 66);
    put('game:s2', 'game', 'stand', 66, 114);
    put('cat:lobby', 'lobby', 'cat', 16, 106);
    put('cat:meet', 'meet', 'cat', 88, 110);
    put('cat:cafe', 'cafe', 'cat', 46, 116);
    put('cat:game', 'game', 'cat', 70, 74);
    put('cat:dev', 'dev', 'cat', R.dev.w - 8, 118);
  }

  function neededCols() { let hi = 0; desks.forEach((id, i) => { if (id) hi = i; }); return Math.max(MIN_COLS, Math.ceil((hi + 1) / 2)); }

  function relayout() {
    const w = Math.max(200, stage.clientWidth), h = Math.max(140, stage.clientHeight);
    const cols = neededCols();
    const A = makeLayout('one', cols), B = makeLayout('two', cols);
    const fit = lay => Math.min(w / lay.W, h / lay.H);
    const old = L;
    L = fit(B) > fit(A) * 1.12 ? B : A;
    const dpr = window.devicePixelRatio || 1;
    const s = Math.max(1.25, Math.min(6, fit(L)));
    const k = Math.floor(s * dpr);                                  // whole screen pixels per office pixel, unless that shrinks it a lot
    S = (k >= 2 && k / (s * dpr) > 0.9 ? k : s * dpr) / dpr;
    cssW = Math.max(w, Math.ceil(L.W * S)); cssH = Math.max(h, Math.ceil(L.H * S));
    OX = Math.floor((cssW - L.W * S) / 2); OY = Math.floor((cssH - L.H * S) / 2);
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    world.width = L.W; world.height = L.H;
    bg = null;
    if (old) remap(old);
  }

  // keep everyone in the same room when the building is redrawn at a new size
  function remap(old) {
    const fix = o => {
      if (!o.pos) return;
      const target = o.target && L.spots.get(o.target);
      if (!o.path.length && o.at && L.spots.has(o.at)) { const s = L.spots.get(o.at); o.pos = { x: s.ax, y: s.ay }; return; }
      let p = null;
      for (const r of Object.values(old.rooms)) {
        if (o.pos.x >= r.x && o.pos.x < r.x + r.w && o.pos.y >= r.y && o.pos.y < r.y + ROW_H) {
          const n = L.rooms[r.name];
          p = { x: Math.min(n.x + n.w - 2, n.x + (o.pos.x - r.x)), y: n.y + (o.pos.y - r.y) };
        }
      }
      if (!p || !target) { if (target) { o.pos = { x: target.ax, y: target.ay }; o.at = o.target; o.path = []; } return; }
      o.pos = p; o.at = null; o.path = route(null, o.pos, o.target);
    };
    for (const a of agents.values()) fix(a);
    fix(cat);
  }

  // ---- walking ---------------------------------------------------------------------------------------------------
  const corrY = row => row * ROW_H + WALK_Y;
  const rowOf = y => Math.max(0, Math.min(L.rows - 1, Math.floor(y / ROW_H)));
  function route(from, pos, key) {
    const to = L.spots.get(key), f = from && L.spots.get(from), pts = [];
    const row = f ? f.row : rowOf(pos.y);
    if (f) { for (let i = f.via.length - 1; i >= 0; i--) pts.push(f.via[i]); pts.push({ x: f.door, y: corrY(row) }); }
    else pts.push({ x: pos.x, y: corrY(row) });
    if (to.row !== row) { pts.push({ x: HALL_W / 2, y: corrY(row) }); pts.push({ x: HALL_W / 2, y: corrY(to.row) }); }
    pts.push({ x: to.door, y: corrY(to.row) });
    for (const p of to.via) pts.push(p);
    pts.push({ x: to.ax, y: to.ay });
    return pts;
  }
  function pathLength(pos, pts) { let len = 0, p = pos; for (const q of pts) { len += Math.hypot(q.x - p.x, q.y - p.y); p = q; } return len; }

  function claim(key, id) { if (key && key !== 'elevator' && !key.startsWith('desk:')) occ.set(key, id); }
  function release(key, id) { if (key && occ.get(key) === id) occ.delete(key); }
  function isFree(key, id) { const o = occ.get(key); return !o || o === id; }
  function pickFree(list, a) {
    if (a.target && list.includes(a.target) && isFree(a.target, a.id)) return a.target;
    for (const k of list) if (L.spots.has(k) && isFree(k, a.id)) return k;
    return null;
  }

  function wantSpot(a, t) {
    const desk = 'desk:' + a.desk;
    if (a.leaving) return 'elevator';
    if (a.kind === 'lead') {
      if (t < a.meetUntil) return 'meet:present';
      if (a.state === 'waiting' && t - a.waitSince > 8000) return pickFree(LEAD_CAFE, a) || desk;
      return desk;
    }
    if (a.kickoff || t < a.kickoffEnd) {
      const seat = pickFree(MEET_SEATS, a);
      if (seat) return seat;
      a.kickoff = false;
    }
    if (a.state === 'done') return pickFree(GAME_SPOTS, a) || desk;
    if (a.state === 'quiet') return pickFree(CAFE_SPOTS, a) || desk;
    return desk;
  }

  function goTo(o, key) {
    if (!o.isCat) { release(o.target, o.id); claim(key, o.id); }
    const from = o.at;
    o.target = key; o.at = null;
    o.path = route(from, o.pos, key);
    const len = pathLength(o.pos, o.path);
    o.speed = o.isCat ? Math.max(26, len / 9) : Math.max(48, len / 3.4);
  }

  function place(a, t) {
    a.placed = true;
    const e = L.spots.get('elevator');
    if (a.kickoff) {                                   // a new agent rides up in the elevator
      a.pos = { x: e.ax, y: e.ay }; a.at = 'elevator'; a.target = 'elevator'; a.holdUntil = t + 550; a.born = t;
      elevUntil = t + 1500;
      return;
    }
    const want = wantSpot(a, t), s = L.spots.get(want);
    claim(want, a.id);
    a.target = want; a.at = want; a.pos = { x: s.ax, y: s.ay }; a.path = [];
    if (want.startsWith('meet:') && a.kind !== 'lead') { a.kickoff = false; a.kickoffEnd = t + 2600; }
  }

  function think(t) {
    for (const a of agents.values()) {
      if (!a.placed) { place(a, t); continue; }
      if (a.fadeStart || t < a.holdUntil) continue;
      if (a.kickoff && t > a.kickoffDeadline) a.kickoff = false;
      const want = wantSpot(a, t);
      if (want && want !== a.target && L.spots.has(want)) goTo(a, want);
    }
    if (!L) return;
    if (!cat.pos) {
      const s = L.spots.get('cat:game');
      cat.pos = { x: s.ax, y: s.ay }; cat.at = cat.target = 'cat:game'; cat.next = t + 50000 + Math.random() * 60000;
    } else if (!cat.path.length && t > cat.next) {
      const choices = CAT_SPOTS.filter(k => k !== cat.at);
      goTo(cat, choices[Math.floor(Math.random() * choices.length)]);
      cat.next = t + 70000 + Math.random() * 110000;
    }
  }

  function step(o, dt, t) {
    if (!o.path.length) return;
    let d = o.speed * dt / 1000;
    while (d > 0 && o.path.length) {
      const p = o.path[0], dx = p.x - o.pos.x, dy = p.y - o.pos.y, len = Math.hypot(dx, dy);
      if (len < 0.001) { o.path.shift(); continue; }
      if (Math.abs(dx) >= Math.abs(dy)) o.face = dx > 0 ? 'right' : 'left';
      else if (!o.isCat) o.face = dy > 0 ? 'down' : 'up';
      if (len <= d) { o.pos = { x: p.x, y: p.y }; o.path.shift(); d -= len; }
      else { o.pos = { x: o.pos.x + dx / len * d, y: o.pos.y + dy / len * d }; d = 0; }
    }
    if (o.path.length) return;
    o.at = o.target;
    if (o.isCat) return;
    if (o.at && o.at.startsWith('meet:') && o.kind !== 'lead' && o.kickoff) { o.kickoff = false; o.kickoffEnd = t + 2600; }
    if (o.leaving && o.at === 'elevator') { o.fadeStart = t; elevUntil = t + 1300; }
  }

  function tick(t, dt) {
    think(t);
    for (const a of agents.values()) if (a.placed && !(t < a.holdUntil)) step(a, dt, t);
    step(cat, dt, t);
    for (const a of [...agents.values()]) if (a.fadeStart && t - a.fadeStart > 700) removeNow(a);
    here.clear();
    for (const a of agents.values()) if (a.placed && a.at && !a.path.length && !a.fadeStart) here.set(a.at, a);
  }

  // ---- agents ----------------------------------------------------------------------------------------------------
  function takeDesk(a) {
    let i = 0;
    if (a.kind !== 'lead') { i = 1; while (desks[i]) i++; }
    desks[i] = a.id; a.desk = i;
  }
  function upsert(info) {
    let a = agents.get(info.id);
    if (!a) {
      const lk = lookFor(info.id, info.name, info.kind, info.order);
      a = {
        id: info.id, name: info.name, kind: info.kind, state: info.state || 'working', order: info.order || 0, ...lk, pal: paletteOf(lk),
        bubble: null, pending: null, hopUntil: 0, born: now(), placed: false, pos: null, path: [], at: null, target: null, face: 'down',
        speed: 50, kickoff: false, kickoffEnd: 0, kickoffDeadline: 0, meetUntil: 0, holdUntil: 0, leaving: false, fadeStart: 0, desk: -1,
        waitSince: info.state === 'waiting' ? now() - 9000 : 0,
      };
      agents.set(a.id, a);
      order.push(a.id);
      order.sort((p, q) => agents.get(p).order - agents.get(q).order);
      takeDesk(a);
      if (!L || neededCols() !== L.cols) relayout();
    } else {
      a.name = info.name || a.name;
      if (info.state) setState(a, info.state);
    }
    if (info.lastSay && !a.bubble) setBubble(a, plain(info.lastSay.text), info.lastSay.icon, info.lastSay.kind, true);
    return a;
  }
  function setState(a, state) {
    if (a.kind === 'lead' && state === 'waiting' && a.state !== 'waiting') a.waitSince = now();
    a.state = state;
  }
  function removeNow(a) {
    release(a.target, a.id);
    if (desks[a.desk] === a.id) desks[a.desk] = null;
    agents.delete(a.id);
    order = order.filter(id => id !== a.id);
    if (L && neededCols() !== L.cols) relayout();
    updatePresence();
  }
  function resetAll() {
    agents.clear(); order = []; flights.length = 0; occ.clear(); here.clear(); desks.length = 0;
    feedEl.textContent = ''; chat.group = null; chat.id = null;
    relayout(); updatePresence();
  }
  function setBubble(a, text, icon, kind, quiet) {
    const life = kind === 'done' ? 10000 : kind === 'tool' ? 4500 : 6500;
    const b = { text, icon: icon || '', kind, t0: 0, until: 0, life: quiet ? 3500 : life };
    if (a.bubble && now() - a.bubble.t0 < 1300) { a.pending = b; return; }
    showBubble(a, b);
  }
  function showBubble(a, b) { b.t0 = now(); b.until = b.t0 + b.life; a.bubble = b; a.pending = null; }

  function apply(e) {
    const t = now(), a = e.id ? agents.get(e.id) : null;
    switch (e.t) {
      case 'reset': resetAll(); break;
      case 'agent': upsert(e); break;
      case 'say': if (a) setBubble(a, plain(e.text), e.icon, e.kind, e.quiet); break;
      case 'chat': addChat(e.item); break;
      case 'link': {
        const from = agents.get(e.from), to = agents.get(e.to);
        if (!from) break;
        flights.push({ from: e.from, to: e.to, kind: e.kind, t0: t, dur: e.kind === 'notes' ? 1500 : 1200, waited: 0 });
        if (e.kind === 'handoff' && to && !to.placed) {
          to.kickoff = true; to.kickoffDeadline = t + 12000;
          if (from.kind === 'lead') from.meetUntil = Math.max(from.meetUntil, t + 7500);
        }
        if (e.kind === 'report') from.hopUntil = t + 600;
        break;
      }
      case 'state': if (a) setState(a, e.state); break;
      case 'leave': if (a) { if (!a.placed) removeNow(a); else a.leaving = true; } break;
      case 'done': toast(e.name + ' shipped a report', 'done'); break;
      case 'you': { const lead = agents.get('lead'); if (lead) setBubble(lead, 'new message from you', '📨', 'you'); break; }
    }
  }

  // ---- team chat -------------------------------------------------------------------------------------------------
  const chat = { group: null, body: null, id: null, ts: 0 };
  const avatars = new Map(), nameColors = new Map();
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function colorFor(item) {
    if (item.id === 'you') return YOU_COLOR;
    const a = agents.get(item.id);
    if (a) return a.shirt;
    return lookFor(item.id, item.name, item.role, item.ord).shirt;
  }
  function avatar(id, name, role, ord) {
    const key = id + '|' + name;
    if (avatars.has(key)) return avatars.get(key);
    const lk = lookFor(id, name, role, ord);
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const g = c.getContext('2d');
    fill(g, 0, 0, 16, 16, shade(lk.shirt, dark ? -0.45 : 0.6));
    fill(g, 3, 11, 10, 5, lk.shirt); fill(g, 2, 12, 12, 4, lk.shirt); fill(g, 6, 11, 4, 1, lk.skin);
    sprite(g, HEADS[lk.headV], 4, 4, paletteOf(lk));
    if (id === 'lead') fill(g, 10, 13, 1, 1, '#ffe08a');
    const url = c.toDataURL();
    avatars.set(key, url);
    return url;
  }
  function rich(parent, text) {
    const re = /`([^`]+)`|@\[([^\]]+)\]/g;
    text = String(text || '');
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parent.append(document.createTextNode(text.slice(last, m.index)));
      if (m[1] != null) parent.append(el('code', '', m[1]));
      else {
        const sp = el('span', 'mention', '@' + m[2]);
        const col = nameColors.get(m[2]) || ([...agents.values()].find(x => x.name === m[2]) || {}).shirt;
        if (col) { sp.style.color = col; sp.style.background = rgba(col, 0.16); }
        parent.append(sp);
      }
      last = re.lastIndex;
    }
    if (last < text.length) parent.append(document.createTextNode(text.slice(last)));
  }
  function lineFor(item) {
    if (item.kind === 'done') {
      const card = el('div', 'card');
      card.append(el('div', 'ttl', '✅ report’s ready'));
      if (item.head) { const bd = el('div', 'bd'); rich(bd, item.head); card.append(bd); }
      const ft = el('div', 'ft');
      ft.append(el('span', 'chip', '🎉'), el('span', 'chip', '🚀'), el('span', 'go', '🎮 off to the game room'));
      card.append(ft);
      return card;
    }
    const d = el('div', 'line k-' + (item.kind || 'tool'));
    if (item.icon) d.append(el('span', 'ic', item.icon));
    rich(d, item.text);
    return d;
  }
  function addChat(item) {
    if (!item) return;
    const stick = feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight < 48;
    const ts = item.ts || Date.now();
    if (item.name && item.id !== 'system') nameColors.set(item.name, colorFor(item));
    if (item.kind === 'system') {
      const d = el('div', 'sys');
      if (item.icon) d.append(el('span', 'ic', item.icon));
      rich(d, item.text);
      feedEl.append(d);
      chat.id = null;
    } else {
      const same = chat.group && chat.group.isConnected && chat.id === item.id && ts - chat.ts < 3 * 60 * 1000;
      if (!same) {
        const g = el('div', 'msg' + (item.id === 'you' ? ' you' : ''));
        const img = el('img', 'av'); img.alt = ''; img.src = avatar(item.id, item.name, item.role, item.ord);
        const main = el('div', 'main'), meta = el('div', 'meta');
        const nm = el('b', '', item.name); nm.style.color = colorFor(item);
        const role = item.role === 'lead' ? 'lead' : item.role === 'you' ? 'you' : 'agent';
        meta.append(nm, el('span', 'role ' + role, role), el('time', '', hhmm(ts)));
        chat.body = el('div', 'body');
        main.append(meta, chat.body);
        g.append(img, main);
        feedEl.append(g);
        chat.group = g; chat.id = item.id;
      }
      chat.ts = ts;
      chat.body.append(lineFor(item));
    }
    while (feedEl.childElementCount > 160) feedEl.firstElementChild.remove();
    if (stick) { feedEl.scrollTop = feedEl.scrollHeight; newPill.hidden = true; } else newPill.hidden = false;
  }
  let facesKey = '';
  function updatePresence() {
    const list = order.map(id => agents.get(id)).filter(a => a && !a.leaving);
    onlineEl.textContent = list.length ? `${list.length} online` : 'empty office';
    const key = list.map(a => a.id + a.name).join('|') + dark;
    if (key !== facesKey) {
      facesKey = key;
      facesEl.textContent = '';
      for (const a of list.slice(0, 8)) { const img = el('img'); img.src = avatar(a.id, a.name, a.kind, a.order); img.title = a.name; img.alt = a.name; facesEl.append(img); }
      if (list.length > 8) facesEl.append(el('span', 'more', '+' + (list.length - 8)));
    }
    const typers = list.filter(a => a.state === 'working' || a.state === 'thinking').map(a => a.name);
    typingEl.textContent = '';
    if (!typers.length) { typingEl.append(el('span', 'idle', list.length ? 'all quiet in here' : 'waiting for a Claude Code chat in this folder…')); return; }
    const dots = el('span', 'dots'); dots.append(el('i'), el('i'), el('i'));
    const txt = typers.length === 1 ? `${typers[0]} is typing…` : typers.length === 2 ? `${typers[0]} and ${typers[1]} are typing…` : `${typers[0]}, ${typers[1]} and ${typers.length - 2} more are typing…`;
    typingEl.append(dots, el('span', 'who', txt));
  }
  function toast(text, kind) {
    const d = el('div', 'toast ' + (kind || ''), (kind === 'done' ? '✅ ' : '') + text);
    toastsEl.appendChild(d);
    setTimeout(() => d.classList.add('out'), 4200);
    setTimeout(() => d.remove(), 4800);
  }

  // ---- the building (drawn once, kept as a picture) ----------------------------------------------------------------
  function skyColors(hour) {
    if (hour >= 7 && hour < 17) return { top: '#7ec8e3', bot: '#bfe6f2', sun: '#ffd166', night: false, city: '#7d8cab' };
    if (hour >= 17 && hour < 19) return { top: '#f4a261', bot: '#ffcfa8', sun: '#ff7b54', night: false, city: '#8a6f86' };
    if (hour >= 5 && hour < 7) return { top: '#a8b8d8', bot: '#ffd6a5', sun: '#ffe1a8', night: false, city: '#7a7f9e' };
    return { top: '#141d3b', bot: '#26335e', sun: '#f1faee', night: true, city: '#0d1226' };
  }
  function windowAt(c, x, y, P, sky, seed) {
    fill(c, x, y, 26, 17, P.frame);
    fill(c, x + 1, y + 1, 24, 7, sky.top); fill(c, x + 1, y + 8, 24, 8, sky.bot);
    if (sky.night) { fill(c, x + 4, y + 3, 1, 1, '#fff'); fill(c, x + 16, y + 2, 1, 1, '#fff'); fill(c, x + 9, y + 6, 1, 1, '#cfd8ff'); fill(c, x + 20, y + 3, 2, 2, sky.sun); }
    else { fill(c, x + 19, y + 3, 3, 3, sky.sun); fill(c, x + 4, y + 4, 6, 1, 'rgba(255,255,255,0.85)'); fill(c, x + 5, y + 3, 3, 1, 'rgba(255,255,255,0.85)'); }
    let h = hash('w' + seed), bx = 1;
    while (bx < 25) {
      const bw = Math.min(3 + (h % 4), 25 - bx), bh = 3 + ((h >>> 3) % 8);
      fill(c, x + bx, y + 16 - bh, bw, bh, sky.city);
      if (sky.night) for (let wy = y + 17 - bh; wy < y + 15; wy += 2) for (let wx = x + bx + 1; wx < x + bx + bw - 1; wx += 2) if (((wx * 7 + wy * 13) % 4) === 0) fill(c, wx, wy, 1, 1, '#ffd98a');
      bx += bw + 1; h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0;
    }
    fill(c, x + 12, y + 1, 1, 15, P.frame);
    fill(c, x - 1, y + 17, 28, 1, shade(P.frame, 0.2));
  }
  function plant(c, x, y, big) {
    const L1 = '#3a9d5d', L2 = '#2c7a47';
    fill(c, x + 1, y - 6, 6, 6, '#b5651d'); fill(c, x + 1, y - 6, 6, 1, '#cd7f32');
    fill(c, x + 3, y - 12, 1, 6, L1); fill(c, x, y - 10, 3, 1, L2); fill(c, x + 4, y - 13, 3, 1, L1); fill(c, x + 5, y - 9, 3, 1, L2);
    fill(c, x + 1, y - 8, 2, 1, L1); fill(c, x + 4, y - 11, 1, 2, L1); fill(c, x - 1, y - 11, 2, 1, L1); fill(c, x + 6, y - 12, 2, 1, L2);
    if (big) { fill(c, x + 2, y - 16, 1, 4, L1); fill(c, x, y - 15, 2, 1, L2); fill(c, x + 4, y - 17, 2, 1, L1); fill(c, x + 6, y - 15, 2, 1, L2); fill(c, x - 1, y - 13, 1, 2, L2); }
  }
  function wallAndFloor(c, r, wall, trim, floorA, floorB, tile) {
    fill(c, r.x, r.y, r.w, WALL_H, wall);
    fill(c, r.x, r.y, r.w, 2, shade(wall, 0.12));
    fill(c, r.x, r.y + WALL_H, r.w, FLOOR_Y - WALL_H, trim);
    checker(c, r.x, r.y + FLOOR_Y, r.w, CORR_Y - FLOOR_Y, tile || 8, floorA, floorB);
  }

  const ROOM_BG = {
    lobby(c, r, P) {
      const X = r.x, Y = r.y;
      wallAndFloor(c, r, P.lobbyWall, shade(P.lobbyWall, -0.3), P.lobbyFloor[0], P.lobbyFloor[1], 6);
      fill(c, X + 6, Y + 3, 22, 29, P.frame); fill(c, X + 7, Y + 4, 20, 27, '#15151c');
      fill(c, X + 14, Y, 6, 3, '#222');
      fill(c, X + 29, Y + 16, 2, 4, '#8d93a5'); fill(c, X + 29, Y + 17, 2, 1, '#ff9f1c');
      plant(c, X + 25, Y + 47, true);
      fill(c, X + 9, Y + 56, 16, 7, '#8c3b3b'); fill(c, X + 10, Y + 57, 14, 5, '#a44848');
    },
    meet(c, r, P) {
      const X = r.x, Y = r.y;
      wallAndFloor(c, r, P.meetWall, shade(P.meetWall, -0.3), P.meetFloor[0], P.meetFloor[1]);
      fill(c, X + 29, Y + 4, 38, 21, '#111318');
      fill(c, X + 46, Y + 25, 4, 2, '#111318');
      fill(c, X + 12, Y + 50, 72, 50, shade(P.rug, -0.15)); fill(c, X + 13, Y + 51, 70, 48, P.rug);
      for (let x = X + 16; x < X + 80; x += 6) fill(c, x, Y + 53, 2, 1, shade(P.rug, 0.15));
      plant(c, X + 3, Y + 44, true);
    },
    dev(c, r, P, sky) {
      const X = r.x, Y = r.y;
      wallAndFloor(c, r, P.devWall, P.devTrim, P.devFloor[0], P.devFloor[1]);
      fill(c, X, Y + WALL_H, r.w, 2, P.base);
      const bc = X + Math.floor(r.w / 2);
      for (let wx = X + 8; wx + 26 <= X + r.w - 32; wx += 30) {
        if (wx + 26 > bc - 27 && wx < bc + 27) continue;
        windowAt(c, wx, Y + 5, P, sky, wx - X);
      }
      fill(c, bc - 25, Y + 4, 50, 17, P.frame); fill(c, bc - 24, Y + 5, 48, 15, P.board); fill(c, bc - 20, Y + 21, 40, 1, '#8a8f9a');
      fill(c, X + r.w - 12, Y + 6, 9, 26, '#1d1f27'); fill(c, X + r.w - 12, Y + 6, 9, 1, '#3a3d48');
    },
    cafe(c, r, P) {
      const X = r.x, Y = r.y;
      fill(c, X, Y, r.w, WALL_H, P.cafeWall); fill(c, X, Y, r.w, 2, shade(P.cafeWall, 0.12));
      fill(c, X, Y + WALL_H, r.w, FLOOR_Y - WALL_H, shade(P.cafeWall, -0.3));
      for (let yy = Y + FLOOR_Y, k = 0; yy < Y + CORR_Y; yy += 4, k++) {
        fill(c, X, yy, r.w, 4, k % 2 ? P.cafeFloor[0] : P.cafeFloor[1]);
        for (let xx = X + ((k * 7) % 16); xx < X + r.w; xx += 16) fill(c, xx, yy, 1, 4, P.seam);
      }
      fill(c, X + 4, Y + 11, 33, 20, P.tile);
      for (let yy = Y + 11; yy < Y + 31; yy += 3) fill(c, X + 4, yy, 33, 1, P.grout);
      for (let yy = Y + 11, k = 0; yy < Y + 31; yy += 3, k++) for (let xx = X + 4 + (k % 2) * 3; xx < X + 37; xx += 6) fill(c, xx, yy, 1, 3, P.grout);
      fill(c, X + 4, Y + 2, 33, 9, P.cabinet); fill(c, X + 20, Y + 2, 1, 9, shade(P.cabinet, -0.3));
      fill(c, X + 18, Y + 7, 1, 2, '#ddd'); fill(c, X + 22, Y + 7, 1, 2, '#ddd');
      fill(c, X + 3, Y + 30, 35, 3, '#d9d4cc'); fill(c, X + 3, Y + 33, 35, 9, P.cabinet);
      fill(c, X + 15, Y + 36, 1, 4, shade(P.cabinet, -0.3)); fill(c, X + 27, Y + 36, 1, 4, shade(P.cabinet, -0.3));
      fill(c, X + 9, Y + 18, 11, 12, '#2b2b30'); fill(c, X + 9, Y + 18, 11, 2, '#45454d');
      fill(c, X + 13, Y + 23, 3, 2, '#888'); fill(c, X + 12, Y + 26, 5, 4, '#15151a');
      fill(c, X + 25, Y + 28, 7, 2, '#eeeeee'); fill(c, X + 26, Y + 26, 2, 2, '#ff6b6b'); fill(c, X + 29, Y + 26, 2, 2, '#ffd23f');
      fill(c, X + 42, Y + 5, 24, 17, '#6b4a2b'); fill(c, X + 43, Y + 6, 22, 15, '#22332b');
      fill(c, X + 45, Y + 13, 10, 1, '#cfd8d3'); fill(c, X + 45, Y + 16, 14, 1, '#cfd8d3'); fill(c, X + 45, Y + 19, 8, 1, '#cfd8d3');
      fill(c, X + 58, Y + 13, 4, 1, '#f4a3b5'); fill(c, X + 61, Y + 16, 2, 1, '#f4a3b5');
      fill(c, X + 68, Y + 22, 6, 7, 'rgba(120,190,255,0.85)'); fill(c, X + 67, Y + 29, 8, 15, '#e8e8ee'); fill(c, X + 69, Y + 33, 1, 2, '#4a90e2'); fill(c, X + 72, Y + 33, 1, 2, '#e24a4a');
      fill(c, X + 78, Y + 4, 14, 40, P.fridge); fill(c, X + 78, Y + 16, 14, 1, shade(P.fridge, -0.3));
      fill(c, X + 80, Y + 8, 1, 6, '#777'); fill(c, X + 80, Y + 20, 1, 9, '#777');
      fill(c, X + 85, Y + 7, 2, 2, '#ff595e'); fill(c, X + 88, Y + 10, 2, 2, '#4f86f7'); fill(c, X + 86, Y + 22, 3, 3, '#ffd23f');
    },
    game(c, r, P) {
      const X = r.x, Y = r.y;
      wallAndFloor(c, r, P.gameWall, shade(P.gameWall, -0.3), P.gameFloor[0], P.gameFloor[1]);
      fill(c, X + 8, Y + 50, 50, 24, shade(P.gameRug, -0.2)); fill(c, X + 9, Y + 51, 48, 22, P.gameRug);
      for (let x = X + 12; x < X + 56; x += 8) fill(c, x, Y + 61, 4, 2, shade(P.gameRug, 0.2));
      fill(c, X + 12, Y + 4, 40, 22, '#0b0b10');
      const cab = dark ? '#3a2d52' : '#8e78b3';
      fill(c, X + 14, Y + 27, 36, 7, cab); fill(c, X + 14, Y + 27, 36, 1, shade(cab, 0.2));
      fill(c, X + 28, Y + 29, 8, 3, '#e5e5ea'); fill(c, X + 34, Y + 30, 1, 1, '#3ddc84');
      fill(c, X + 16, Y + 28, 4, 5, '#222'); fill(c, X + 44, Y + 28, 4, 5, '#222');
      fill(c, X + 56, Y + 5, 36, 13, shade(P.gameWall, -0.35)); fill(c, X + 56, Y + 5, 36, 1, '#ff3fd2');
      fill(c, X + 96, Y + 12, 14, 34, '#c0392b'); fill(c, X + 96, Y + 12, 2, 34, '#962d22');
      fill(c, X + 97, Y + 13, 12, 3, '#ffd23f'); fill(c, X + 97, Y + 17, 12, 9, '#111');
      fill(c, X + 96, Y + 27, 14, 3, '#2b2b2b'); fill(c, X + 99, Y + 26, 1, 1, '#e63946');
      fill(c, X + 104, Y + 28, 1, 1, '#4cc9f0'); fill(c, X + 106, Y + 28, 1, 1, '#f72585'); fill(c, X + 101, Y + 35, 4, 4, '#7a2a20');
      fill(c, X + 112, Y + 34, 4, 10, '#2c7a47'); plant(c, X + 110, Y + 46, false);
    },
  };

  function buildBackground() {
    const P = pal(), sky = skyColors(new Date().getHours());
    bg = document.createElement('canvas'); bg.width = L.W; bg.height = L.H;
    const c = bg.getContext('2d');
    fill(c, 0, 0, L.W, L.H, P.page);
    for (const r of Object.values(L.rooms)) ROOM_BG[r.name](c, r, P, sky);
    for (let row = 0; row < L.rows; row++) {
      const y0 = row * ROW_H;
      checker(c, 0, y0 + CORR_Y, L.W, CORR_H, 4, P.corr, P.corrB);
      fill(c, 0, y0 + CORR_Y + 6, L.W, 8, P.runner);
      for (let x = 3; x < L.W; x += 10) fill(c, x, y0 + CORR_Y + 9, 4, 2, P.runnerB);
      fill(c, 0, y0 + CORR_Y + CORR_H, L.W, ROW_H - CORR_Y - CORR_H, P.edge);
    }
    const rooms = Object.values(L.rooms);
    for (const r of rooms) {
      if (r.first) continue;
      const left = rooms.find(o => o.row === r.row && o.x + o.w === r.x);
      const glass = r.name === 'meet' || (left && left.name === 'meet');
      if (glass) {
        fill(c, r.x - 1, r.y + 2, 3, CORR_Y - 6, P.glass);
        for (let yy = r.y + 2; yy < r.y + CORR_Y - 4; yy += 30) fill(c, r.x - 1, yy, 3, 1, P.glassEdge);
        fill(c, r.x - 1, r.y + CORR_Y - 5, 3, 1, P.glassEdge);
      } else {
        fill(c, r.x - 2, r.y, 4, CORR_Y - 2, P.divider); fill(c, r.x - 2, r.y, 4, 2, P.dividerTop);
      }
    }
    if (L.mode === 'two') {
      fill(c, 0, 0, HALL_W, CORR_Y, P.lobbyWall); checker(c, 0, FLOOR_Y, HALL_W, CORR_Y - FLOOR_Y, 6, P.lobbyFloor[0], P.lobbyFloor[1]);
      checker(c, 0, CORR_Y, HALL_W, ROW_H + CORR_H, 4, P.corr, P.corrB);
      fill(c, 4, CORR_Y + 6, 8, ROW_H + 8, P.runner);
      for (let y = ROW_H - 6; y < ROW_H + 12; y += 3) fill(c, 0, y, HALL_W, 1, shade(P.corr, -0.15));
      fill(c, HALL_W - 2, 0, 2, CORR_Y, P.divider);
    }
  }

  // ---- things that move on the walls -----------------------------------------------------------------------------
  function steam(c, x, y, t) {
    const ga = c.globalAlpha;
    for (let k = 0; k < 3; k++) {
      const p = ((t / 900) + k / 3) % 1;
      c.globalAlpha = ga * (1 - p) * 0.75;
      fill(c, x + Math.round(Math.sin((p + k) * 6)), y - Math.round(p * 6), 1, 1, '#ffffff');
    }
    c.globalAlpha = ga;
  }
  function drawRacer(c, X, Y, W, H, t) {   // a small synthwave racing game on the TV
    c.save(); c.beginPath(); c.rect(X, Y, W, H); c.clip();
    const hz = Y + 9;
    fill(c, X, Y, W, 5, '#2b1055'); fill(c, X, Y + 5, W, 4, '#6a2c91');
    fill(c, X + W / 2 - 5, Y + 4, 10, 5, '#ff7eb3'); fill(c, X + W / 2 - 5, Y + 6, 10, 1, '#6a2c91'); fill(c, X + W / 2 - 5, Y + 8, 10, 1, '#6a2c91');
    fill(c, X, hz, W, H - 9, '#1a0b2e');
    const ph = (t / 600) % 1;
    for (let i = 0; i < 4; i++) { const d = ((i + ph) / 4); const y = hz + Math.round(d * d * (H - 9)); fill(c, X, y, W, 1, '#c03fd6'); }
    const cx = X + W / 2;
    for (let k = -2; k <= 2; k++) { for (let y = hz; y < Y + H; y++) { const f = (y - hz) / (H - 9); fill(c, Math.round(cx + k * 3 + k * f * 8), y, 1, 1, '#8e2bb0'); } }
    const carX = Math.round(cx - 3 + Math.sin(t / 700) * 6);
    fill(c, carX, Y + H - 5, 7, 3, '#ff4d6d'); fill(c, carX + 1, Y + H - 6, 5, 1, '#ffd1dc'); fill(c, carX, Y + H - 2, 2, 1, '#111'); fill(c, carX + 5, Y + H - 2, 2, 1, '#111');
    c.restore();
  }
  function drawAmbient(t) {
    const R = L.rooms;
    { // elevator doors
      const X = R.lobby.x, Y = R.lobby.y;
      let o = 0;
      if (t < elevUntil) o = Math.max(0, Math.min(1, (t - (elevUntil - 1500)) / 300, (elevUntil - t) / 300));
      const sh = Math.round(o * 9);
      fill(wc, X + 7, Y + 4, 20, 27, '#15151c');
      if (o > 0) fill(wc, X + 9, Y + 6, 16, 23, '#2a2a36');
      fill(wc, X + 7, Y + 4, 10 - sh, 27, '#b9bfcc'); fill(wc, X + 17 + sh, Y + 4, 10 - sh, 27, '#b9bfcc');
      fill(wc, X + 16 - sh, Y + 4, 1, 27, '#9aa1b0'); fill(wc, X + 17 + sh, Y + 4, 1, 27, '#9aa1b0');
      fill(wc, X + 15, Y + 1, 4, 1, o > 0 ? '#ffb347' : '#5a4a2a');
    }
    { // meeting room screen: a slide while the lead runs a kickoff
      const X = R.meet.x + 30, Y = R.meet.y + 5, lead = agents.get('lead');
      if (lead && here.get('meet:present') === lead) {
        fill(wc, X, Y, 36, 19, '#f4f1ea'); fill(wc, X, Y, 36, 4, LEAD_SHIRT);
        for (let i = 0; i < 3; i++) { fill(wc, X + 3, Y + 7 + i * 4, 2, 2, '#555'); fill(wc, X + 7, Y + 7 + i * 4, 9 + ((i * 5) % 7), 1, '#999'); }
        const g = Math.min(1, (t % 4000) / 1200);
        [6, 9, 12].forEach((hh, i) => { const h = Math.max(1, Math.round(hh * g)); fill(wc, X + 25 + i * 3, Y + 17 - h, 2, h, SHIRTS[i]); });
      } else {
        fill(wc, X, Y, 36, 19, '#16213a');
        fill(wc, X + 13, Y + 8, 2, 2, '#3a4a7a'); fill(wc, X + 17, Y + 7, 2, 2, '#5a6aaa'); fill(wc, X + 21, Y + 8, 2, 2, '#3a4a7a');
        fill(wc, X + 12, Y + 11, 12, 1, '#2c3a66');
      }
    }
    { // server rack lights on the dev floor
      const X = R.dev.x + R.dev.w - 12, Y = R.dev.y + 6;
      for (let i = 0; i < 6; i++) {
        const on = ((Math.floor(t / 400) + i * 7) % 5) !== 0;
        fill(wc, X + 2, Y + 3 + i * 4, 1, 1, on ? (i % 3 ? '#3ddc84' : '#ffb347') : '#26332a');
        fill(wc, X + 4, Y + 3 + i * 4, 3, 1, '#3a3d48');
      }
    }
    { // coffee machine
      const X = R.cafe.x, Y = R.cafe.y, busy = here.get('cafe:coffee');
      fill(wc, X + 18, Y + 20, 1, 1, busy ? '#3ddc84' : '#ff6b6b');
      if (busy) { fill(wc, X + 13, Y + 27, 3, 3, '#f4f1ea'); steam(wc, X + 14, Y + 25, t); }
    }
    { // game room: TV, arcade, LED strip
      const r = R.game, X = r.x + 13, Y = r.y + 5;
      if (['game:bb0', 'game:bb1', 'game:so0', 'game:so1'].some(k => here.get(k))) drawRacer(wc, X, Y, 38, 20, t);
      else { fill(wc, X, Y, 38, 20, '#0b0d14'); fill(wc, X + 35, Y + 18, 1, 1, '#ff4d4d'); }
      const ax = r.x + 98, ay = r.y + 18;
      if (here.get('game:arc')) {
        fill(wc, ax, ay, 10, 7, ['#2b2d6e', '#4a2b6e', '#2b6e5a'][Math.floor(t / 300) % 3]);
        fill(wc, ax + 1, ay + 1, 8, 1, '#f72585'); fill(wc, ax + 2 + (Math.floor(t / 150) % 6), ay + 4, 1, 1, '#ffd23f'); fill(wc, ax + 4, ay + 6, 2, 1, '#4cc9f0');
      } else {
        fill(wc, ax, ay, 10, 7, '#1a1a2a');
        if (Math.floor(t / 900) % 2) fill(wc, ax + 3, ay + 3, 4, 1, '#4cc9f0');
      }
      for (let x = 0; x < r.w; x += 3) fill(wc, r.x + x, r.y + 1, 2, 1, `hsl(${(x * 3 + t / 25) % 360},85%,${dark ? 62 : 52}%)`);
    }
  }

  // ---- people ----------------------------------------------------------------------------------------------------
  function headOf(a, t) { return ((t + a.seed * 7) % 3900) < 140 ? HEADS_BLINK[a.headV] : HEADS[a.headV]; }
  function fadeOf(a, t) { return a.fadeStart ? Math.max(0, 1 - (t - a.fadeStart) / 700) : Math.min(1, (t - a.born) / 400); }
  function drawFigure(a, x, fy, face, frame, t) {
    x = Math.round(x); fy = Math.round(fy) + (t < a.hopUntil ? -2 : 0);
    fill(wc, x - 4, fy, 9, 1, 'rgba(0,0,0,0.2)');
    if (face === 'left' || face === 'right') {
      const l = face === 'left';
      sprite(wc, (l ? LEGS_SIDE_L : LEGS_SIDE)[frame], x - 5, fy - 3, a.pal);
      sprite(wc, (l ? BODY_SIDE_L : BODY_SIDE)[frame], x - 5, fy - 9, a.pal);
      sprite(wc, (l ? SIDES_L : SIDES)[a.headV], x - 4, fy - 16, a.pal);
    } else {
      const back = face === 'up';
      sprite(wc, LEGS_FRONT[frame], x - 5, fy - 3, a.pal);
      sprite(wc, back ? BODY_BACK : BODY_FRONT, x - 5, fy - 9, a.pal);
      sprite(wc, back ? BACKS[a.headV] : headOf(a, t), x - 4, fy - 16, a.pal);
      if (!back && a.kind === 'lead') fill(wc, x + 2, fy - 7, 1, 1, '#ffe08a');
    }
  }
  function drawSeatFront(a, x, top, t) {
    const hop = t < a.hopUntil ? -2 : 0, bob = a.state === 'thinking' && Math.floor((t + a.seed) / 700) % 2 ? -1 : 0;
    sprite(wc, SEAT_FRONT, x - 5, top - 6 + hop, a.pal);
    sprite(wc, headOf(a, t), x - 4, top - 13 + hop + bob, a.pal);
    if (a.kind === 'lead') fill(wc, x + 2, top - 3 + hop, 1, 1, '#ffe08a');
  }
  function drawSeatBack(a, x, sy, t, bob) {
    const b = bob && Math.floor((t + a.seed) / 450) % 2 ? -1 : 0;
    sprite(wc, SEAT_BACK, x - 5, sy - 6, a.pal);
    sprite(wc, BACKS[a.headV], x - 4, sy - 13 + b, a.pal);
  }
  function drawStanding(a, t) {
    const walking = a.path.length > 0, s = !walking && a.at ? L.spots.get(a.at) : null;
    let face = walking ? a.face : 'down';
    const frame = walking ? 1 + (Math.floor((t + a.seed) / 130) % 2) : 0;
    if (s && s.kind === 'standBack') face = 'up';
    if (s && s.kind === 'pong') face = s.key === 'game:p0' ? 'right' : 'left';
    wc.globalAlpha = fadeOf(a, t);
    const x = Math.round(a.pos.x), y = Math.round(a.pos.y);
    drawFigure(a, x, y, face, frame, t);
    if (s && (s.kind === 'coffee' || s.kind === 'mug')) { fill(wc, x + 4, y - 7, 2, 3, '#f4f1ea'); steam(wc, x + 4, y - 9, t); }
    if (s && s.kind === 'pong') { const px = face === 'right' ? x + 4 : x - 7; fill(wc, px, y - 9, 3, 3, '#d62828'); fill(wc, px + 1, y - 6, 1, 2, '#6b3e26'); }
    if (s && s.kind === 'present') { for (let i = 0; i < 5; i++) fill(wc, x - 6 - i, y - 9 - i, 1, 1, '#e8e8e8'); }
    wc.globalAlpha = 1;
  }

  // ---- furniture that people sit at (drawn every frame so it can hide their legs) ------------------------------------
  function monitor(mx, my, owner, sitter, t, second) {
    fill(wc, mx, my, 15, 10, '#1f2330'); fill(wc, mx + 6, my + 10, 3, 1, '#1f2330');
    const sx = mx + 1, sy = my + 1;
    if (!owner) { fill(wc, sx, sy, 13, 8, '#0e1118'); return; }
    const st = owner.state;
    if (st === 'done') { fill(wc, sx, sy, 13, 8, '#0f2a1a'); sprite(wc, CHECK, sx + 3, sy + 1, { g: '#3ddc84' }); return; }
    if (!sitter) { fill(wc, sx, sy, 13, 8, shade(owner.shirt, -0.72)); fill(wc, sx + 5, sy + 3, 3, 3, shade(owner.shirt, -0.25)); fill(wc, sx + 6, sy + 2, 1, 1, shade(owner.shirt, -0.25)); return; }
    if (st === 'working') {
      fill(wc, sx, sy, 13, 8, '#0f1b24');
      const k = Math.floor((t + owner.seed + (second ? 777 : 0)) / 350);
      for (let j = 0; j < 4; j++) fill(wc, sx + 1, sy + 1 + j * 2, 2 + ((owner.seed + j * 7 + k * 3 + (second ? 5 : 0)) % 10), 1, j % 2 ? shade(owner.shirt, 0.35) : owner.shirt);
      return;
    }
    if (st === 'thinking') { fill(wc, sx, sy, 13, 8, '#141a24'); const k = Math.floor(t / 300) % 3; for (let j = 0; j < 3; j++) fill(wc, sx + 3 + j * 3, sy + 4, 1, 1, j === k ? '#ffffff' : '#56607a'); return; }
    fill(wc, sx, sy, 13, 8, '#11151d');
    if (Math.floor(t / 600) % 2) fill(wc, sx + 2, sy + 5, 2, 1, owner.shirt);
  }
  function decor(i, x, top) {
    const d = x + 12;
    switch (i % 5) {
      case 1: fill(wc, d + 3, top - 4, 3, 4, '#e9e9ef'); fill(wc, d + 6, top - 3, 1, 2, '#e9e9ef'); break;
      case 2: fill(wc, d + 2, top - 4, 4, 4, '#b5651d'); fill(wc, d + 1, top - 7, 6, 3, '#3a9d5d'); fill(wc, d + 3, top - 9, 2, 2, '#2c7a47'); break;
      case 3: fill(wc, d + 2, top - 3, 5, 3, '#ffd23f'); fill(wc, d + 4, top - 5, 3, 2, '#ffd23f'); fill(wc, d + 7, top - 4, 1, 1, '#f77f00'); fill(wc, d + 5, top - 5, 1, 1, '#222'); break;
      case 4: fill(wc, d, top - 2, 8, 2, '#c0392b'); fill(wc, d + 1, top - 4, 7, 2, '#2980b9'); fill(wc, d, top - 6, 8, 2, '#27ae60'); break;
      default: fill(wc, d + 6, top - 9, 1, 9, '#555'); fill(wc, d + 3, top - 11, 6, 3, '#e0b84a'); fill(wc, d + 4, top - 1, 5, 1, '#555');
    }
  }
  function drawDesk(i, t) {
    const key = 'desk:' + i, s = L.spots.get(key);
    if (!s) return;
    const P = pal(), x = s.x, top = s.y, lead = i === 0;
    const owner = desks[i] ? agents.get(desks[i]) : null, sitter = here.get(key) || null;
    const off = sitter ? 0 : 2;
    fill(wc, x - 7, top - 14 + off, 14, 11, P.chair); fill(wc, x - 6, top - 15 + off, 12, 1, P.chairTop);
    if (sitter) { wc.globalAlpha = fadeOf(sitter, t); drawSeatFront(sitter, x, top, t); wc.globalAlpha = 1; }
    const topC = lead ? '#7a4a32' : '#8b5a2b', front = lead ? '#5e3a26' : '#6e4520';
    fill(wc, x - 25, top, 50, 3, topC); fill(wc, x - 24, top + 3, 48, 8, front);
    fill(wc, x - 23, top + 11, 2, 3, shade(front, -0.3)); fill(wc, x + 21, top + 11, 2, 3, shade(front, -0.3));
    fill(wc, x + 8, top + 5, 10, 1, shade(front, 0.18));
    if (lead) fill(wc, x - 5, top + 5, 10, 3, '#e0b84a');
    monitor(x - 22, top - 10, owner, sitter, t);
    if (lead) monitor(x + 8, top - 10, owner, sitter, t, true); else decor(i, x, top);
    fill(wc, x - 5, top, 10, 1, P.kb);
    if (sitter) {
      const typing = sitter.state === 'working', k = Math.floor((t + sitter.seed) / 140);
      fill(wc, x - 4, top - 1 - (typing && k % 2 ? 1 : 0), 2, 1, sitter.skin);
      fill(wc, x + 2, top - 1 - (typing && k % 2 === 0 ? 1 : 0), 2, 1, sitter.skin);
    }
  }
  function drawMeetTable(t) {
    const P = pal(), r = L.rooms.meet, ty = r.y + 62, wood = dark ? '#6a4a35' : '#9b6b45';
    for (let i = 0; i < 3; i++) {
      const s = L.spots.get('meet:b' + i), a = here.get(s.key);
      fill(wc, s.x - 6, ty - 13, 12, 10, P.chair); fill(wc, s.x - 5, ty - 14, 10, 1, P.chairTop);
      if (a) drawSeatFront(a, s.x, ty, t);
    }
    fill(wc, r.x + 18, ty, 60, 8, wood); fill(wc, r.x + 18, ty, 60, 1, shade(wood, 0.18)); fill(wc, r.x + 18, ty + 8, 60, 3, shade(wood, -0.3));
    fill(wc, r.x + 20, ty + 11, 2, 4, shade(wood, -0.45)); fill(wc, r.x + 74, ty + 11, 2, 4, shade(wood, -0.45));
    for (let i = 0; i < 3; i++) {
      const b = L.spots.get('meet:b' + i), f = L.spots.get('meet:f' + i);
      if (here.get(b.key)) { fill(wc, b.x - 3, ty + 1, 7, 3, '#c9ccd6'); fill(wc, b.x - 3, ty + 1, 7, 1, '#9aa0ad'); }
      if (here.get(f.key)) fill(wc, f.x - 2, ty + 5, 4, 2, '#f4f1ea');
    }
  }
  function drawMeetFront(i, t) {
    const P = pal(), s = L.spots.get('meet:f' + i), a = here.get(s.key);
    if (a) drawSeatBack(a, s.x, s.y, t);
    fill(wc, s.x - 6, s.y - 4, 12, 8, P.chair); fill(wc, s.x - 6, s.y - 4, 12, 1, P.chairTop);
    fill(wc, s.x - 5, s.y + 4, 1, 3, shade(P.chair, -0.3)); fill(wc, s.x + 4, s.y + 4, 1, 3, shade(P.chair, -0.3));
  }
  function drawCafeTable(j, t) {
    const seats = j === 0 ? ['cafe:t0', 'cafe:t1'] : ['cafe:t2', 'cafe:t3'];
    const s0 = L.spots.get(seats[0]), tx = s0.x + 6, ty = s0.y, top = dark ? '#d9d4cc' : '#ffffff';
    for (const k of seats) {
      const s = L.spots.get(k), a = here.get(k);
      fill(wc, s.x - 3, ty - 8, 6, 5, '#8a5a3c');
      if (a) drawSeatFront(a, s.x, ty, t);
    }
    fill(wc, tx - 11, ty - 1, 22, 1, top); fill(wc, tx - 12, ty, 24, 3, top); fill(wc, tx - 12, ty + 3, 24, 1, shade(top, -0.25));
    fill(wc, tx - 1, ty + 4, 3, 9, '#4a4a52'); fill(wc, tx - 5, ty + 13, 11, 2, '#35353b');
    for (const k of seats) if (here.get(k)) { const s = L.spots.get(k); fill(wc, s.x - 1, ty, 3, 2, '#c65d3b'); steam(wc, s.x, ty - 2, t); }
  }
  function drawBeanBag(i, t) {
    const s = L.spots.get('game:bb' + i), a = here.get(s.key), col = i ? '#3d8bd4' : '#d1495b';
    if (a) drawSeatBack(a, s.x, s.y, t, true);
    fill(wc, s.x - 7, s.y - 3, 14, 1, shade(col, 0.15)); fill(wc, s.x - 8, s.y - 2, 16, 6, col); fill(wc, s.x - 9, s.y + 1, 18, 4, col);
    fill(wc, s.x - 8, s.y + 5, 16, 1, shade(col, -0.3));
  }
  function drawSofa(t) {
    const r = L.rooms.game, col = dark ? '#5a4b7a' : '#7d68a8';
    for (const k of ['game:so0', 'game:so1']) { const a = here.get(k); if (a) { const s = L.spots.get(k); drawSeatBack(a, s.x, s.y, t, true); } }
    const y = r.y + 89;
    fill(wc, r.x + 12, y, 34, 9, col); fill(wc, r.x + 12, y, 34, 1, shade(col, 0.2)); fill(wc, r.x + 29, y + 1, 1, 7, shade(col, -0.2));
    fill(wc, r.x + 10, y - 2, 3, 12, shade(col, -0.15)); fill(wc, r.x + 45, y - 2, 3, 12, shade(col, -0.15));
  }
  function drawPong(t) {
    const r = L.rooms.game, X = r.x + 62, Y = r.y + 82;
    fill(wc, X, Y, 36, 12, '#2a7a4f'); fill(wc, X, Y, 36, 1, '#e8f5ee'); fill(wc, X, Y + 11, 36, 1, '#e8f5ee');
    fill(wc, X, Y + 6, 36, 1, 'rgba(232,245,238,0.5)'); fill(wc, X, Y + 12, 36, 2, '#1d5a39');
    fill(wc, X + 2, Y + 14, 2, 4, '#333'); fill(wc, X + 32, Y + 14, 2, 4, '#333');
    fill(wc, X + 17, Y - 2, 2, 14, 'rgba(230,230,230,0.85)');
    if (here.get('game:p0') && here.get('game:p1')) {
      const ph = (t % 1100) / 1100, u = ph < 0.5 ? ph * 2 : 2 - ph * 2, hop = (ph * 2) % 1;
      const bx = X - 2 + u * 40, by = Y + 4 - Math.sin(Math.PI * hop) * 8;
      fill(wc, bx, Y + 7, 2, 1, '#1d5a39'); fill(wc, bx, by, 2, 2, '#ffffff');
    }
  }
  function drawCat(t) {
    if (!cat.pos) return;
    const x = Math.round(cat.pos.x), y = Math.round(cat.pos.y), l = cat.face === 'left';
    if (cat.path.length) sprite(wc, (l ? CAT_WALK_L : CAT_WALK)[Math.floor(t / 160) % 2], x - 5, y - 6, CAT_PAL);
    else sprite(wc, l ? CAT_SLEEP_L : CAT_SLEEP, x - 5, y - 5, CAT_PAL);
  }

  function drawWorld(t) {
    const key = [L.mode, L.cols, L.W, dark, new Date().getHours()].join('|');
    if (!bg || key !== bgKey) { buildBackground(); bgKey = key; }
    wc.globalAlpha = 1;
    wc.drawImage(bg, 0, 0);
    drawAmbient(t);
    const items = [];
    const R = L.rooms;
    for (let i = 0; i < L.cols * 2; i++) { const s = L.spots.get('desk:' + i); items.push({ y: s.y + 11, draw: () => drawDesk(i, t) }); }
    items.push({ y: R.meet.y + 73, draw: () => drawMeetTable(t) });
    for (let i = 0; i < 3; i++) items.push({ y: R.meet.y + 90, draw: () => drawMeetFront(i, t) });
    items.push({ y: R.cafe.y + 88, draw: () => drawCafeTable(0, t) });
    items.push({ y: R.cafe.y + 114, draw: () => drawCafeTable(1, t) });
    for (let i = 0; i < 2; i++) items.push({ y: R.game.y + 66, draw: () => drawBeanBag(i, t) });
    items.push({ y: R.game.y + 99, draw: () => drawSofa(t) });
    items.push({ y: R.game.y + 98, draw: () => drawPong(t) });
    for (const a of agents.values()) {
      if (!a.placed || !a.pos) continue;
      const s = !a.path.length && a.at ? L.spots.get(a.at) : null;
      if (s && SEATED.has(s.kind)) continue;
      items.push({ y: a.pos.y, draw: () => drawStanding(a, t) });
    }
    if (cat.pos) items.push({ y: cat.pos.y, draw: () => drawCat(t) });
    items.sort((p, q) => p.y - q.y);
    for (const it of items) it.draw();
  }

  // ---- labels, bubbles and flying notes (drawn sharp, on top) ---------------------------------------------------
  const W2S = (x, y) => [OX + x * S, OY + y * S];
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function fitText(text, maxW) {
    text = String(text);
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }
  function wrap(text, maxW, maxLines) {
    const words = String(text).split(/\s+/), lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && lines.join(' ').length < String(text).length) lines[maxLines - 1] = fitText(lines[maxLines - 1] + '…', maxW).replace(/……$/, '…');
    return lines.map(l => fitText(l, maxW));
  }
  function headTop(a) {
    const s = !a.path.length && a.at ? L.spots.get(a.at) : null;
    if (s && SEATED.has(s.kind)) return { x: s.x, y: s.y - 13 };
    return { x: a.pos.x, y: a.pos.y - 16 };
  }
  function stateColor(a) {
    return a.state === 'done' ? '#3ddc84' : a.state === 'quiet' ? '#c8a27a' : a.state === 'waiting' ? '#f0c674' : a.state === 'thinking' ? '#9aa0ff' : a.shirt;
  }
  function tagInfo(a) {
    const s = !a.path.length && a.at ? L.spots.get(a.at) : null;
    if (s && s.kind === 'desk') return { x: s.x, y: s.y + 16, desk: true };
    if (s && s.kind === 'seatFront') return { x: s.x, y: s.y + 9 + s.tagDy, room: s.room };
    if (s && s.kind === 'seatBack') return { x: s.x, y: s.y + 8 + s.tagDy, room: s.room };
    return { x: a.pos.x, y: a.pos.y + 3 + (s ? s.tagDy : 0), room: s ? s.room : '' };
  }
  function pill(text, cx, cy, fs, color, alpha, dot) {
    const P = pal();
    ctx.font = `600 ${fs}px ${fontFamily}`;
    const w = ctx.measureText(text).width + (dot ? 10 : 0) + 8, h = fs + 5;
    const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = P.tag; roundRect(x, y, w, h, h / 2); ctx.fill();
    if (dot) { ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x + 7, y + h / 2, 2.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = color || P.tagText; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 4 + (dot ? 9 : 0), y + h / 2 + 0.5);
    ctx.globalAlpha = 1;
  }
  function drawTags(t, hovered) {
    const fs = S >= 2.6 ? 11 : 10, P = pal();
    // whose desk is it, while they are away
    for (let i = 0; i < L.cols * 2; i++) {
      const owner = desks[i] && agents.get(desks[i]), s = L.spots.get('desk:' + i);
      if (!owner || here.get(s.key) === owner || !owner.placed) continue;
      ctx.font = `600 ${fs}px ${fontFamily}`;
      const [sx, sy] = W2S(s.x, s.y + 16);
      ctx.globalAlpha = 0.45; ctx.fillStyle = dark ? '#cfd0dc' : '#3a3f4c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(fitText(owner.name, DESK_W * S - 8), sx, sy); ctx.globalAlpha = 1;
    }
    for (const id of order) {
      const a = agents.get(id);
      if (!a || !a.placed || !a.pos || a === hovered) continue;
      const alpha = fadeOf(a, t);
      if (alpha <= 0) continue;
      const g = tagInfo(a), [sx, sy] = W2S(g.x, g.y);
      if (g.desk) {
        ctx.font = `600 ${fs}px ${fontFamily}`;
        const name = fitText(a.name, DESK_W * S - 22);
        pill(name, sx, sy, fs, a.kind === 'lead' ? '#f0a58a' : null, alpha, stateColor(a));
        if (S >= 3) { ctx.font = `${fs - 1}px ${fontFamily}`; ctx.fillStyle = stateColor(a); ctx.textAlign = 'center'; ctx.globalAlpha = alpha; ctx.fillText(LABEL[a.state] || a.state, sx, sy + fs + 3); ctx.globalAlpha = 1; }
      } else {
        const em = g.room === 'cafe' ? '☕ ' : g.room === 'game' ? '🎮 ' : g.room === 'meet' ? '📋 ' : '';
        ctx.font = `600 ${fs - 1}px ${fontFamily}`;
        pill(em + fitText(a.name, Math.max(44, 24 * S)), sx, sy, fs - 1, a.kind === 'lead' ? '#f0a58a' : null, alpha * 0.95);
      }
    }
    if (hovered) {
      const g = tagInfo(hovered), [sx, sy] = W2S(g.x, g.y);
      pill(hovered.name + ' · ' + (LABEL[hovered.state] || hovered.state), sx, sy, fs, hovered.kind === 'lead' ? '#f0a58a' : null, 1, stateColor(hovered));
    }
    void P;
  }
  function drawBubble(a, t) {
    if (a.pending && (!a.bubble || t - a.bubble.t0 > 1300)) showBubble(a, a.pending);
    const b = a.bubble;
    if (!b) return;
    if (t > b.until) { a.bubble = null; return; }
    if (!a.pos) return;
    const alpha = Math.min(1, (t - b.t0) / 160, (b.until - t) / 450) * fadeOf(a, t);
    const fs = S >= 2.6 ? 12 : 11, lh = fs + 4;
    ctx.font = `${fs}px ${fontFamily}`;
    const maxW = Math.min(230, Math.max(130, 70 * S));
    const lines = wrap((b.icon ? b.icon + ' ' : '') + b.text, maxW - 14, 3);
    let w = 0;
    for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
    w = Math.ceil(w + 14);
    const h = lines.length * lh + 8, top = headTop(a), [cx, hy] = W2S(top.x, top.y);
    const bx = Math.max(2, Math.min(cssW - w - 2, Math.round(cx - w / 2)));
    const by = Math.max(2, Math.round(hy - h - 8));
    const tool = dark ? { bg: 'rgba(22,24,32,0.95)', fg: '#ecedf3', bd: a.shirt } : { bg: 'rgba(255,255,255,0.97)', fg: '#20232c', bd: a.shirt };
    const st = {
      talk: { bg: '#ffffff', fg: '#1d1d1f', bd: '#cfd2dc' }, notes: { bg: '#ffffff', fg: '#1d1d1f', bd: '#cfd2dc' }, message: { bg: '#eef1ff', fg: '#1d2350', bd: '#8c9cff' },
      tool, done: { bg: '#e9fbef', fg: '#0d5a2b', bd: '#3ddc84' }, you: { bg: '#fff6d6', fg: '#5a4300', bd: '#e0b84a' },
    }[b.kind] || tool;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = st.bg; ctx.strokeStyle = st.bd; ctx.lineWidth = 1.5;
    roundRect(bx + 0.5, by + 0.5, w, h, 8); ctx.fill(); ctx.stroke();
    const tx = Math.max(bx + 10, Math.min(bx + w - 10, cx));
    ctx.beginPath(); ctx.moveTo(tx - 5, by + h); ctx.lineTo(tx, by + h + 6); ctx.lineTo(tx + 5, by + h); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = st.bg; ctx.fillRect(tx - 4, by + h - 1, 8, 2.5);
    ctx.fillStyle = st.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, bx + 7, by + 4 + (i + 1) * lh - 4));
    ctx.globalAlpha = 1;
  }
  function drawFlights(t, dt) {
    const ICON = { handoff: '📋', report: '📄', notes: '📄', message: '✉️' };
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i], A = agents.get(f.from), B = agents.get(f.to);
      if (!A || !A.pos || (!(B && B.pos) && f.waited > 4000)) { flights.splice(i, 1); continue; }
      if (!B || !B.pos) { f.waited += dt; f.t0 = t; continue; }
      const p = Math.min(1, (t - f.t0) / f.dur), ha = headTop(A), hb = headTop(B);
      const [ax, ay] = W2S(ha.x, ha.y), [bx, by] = W2S(hb.x, hb.y);
      if (f.kind === 'notes') {
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(160,170,200,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
      }
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const arc = Math.min(70, 25 + Math.hypot(bx - ax, by - ay) * 0.25);
      const x = ax + (bx - ax) * e, y = ay + (by - ay) * e - Math.sin(Math.PI * e) * arc;
      ctx.font = `${S >= 2.6 ? 18 : 15}px ${fontFamily}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 0.25; ctx.fillText(ICON[f.kind] || '📄', x - 8 - (bx - ax) * 0.03, y + 7);
      ctx.globalAlpha = 1; ctx.fillText(ICON[f.kind] || '📄', x - 8, y + 6);
      if (p >= 1) { flights.splice(i, 1); B.hopUntil = t + 500; }
    }
  }
  function drawSigns(t) {
    const P = pal(), R = L.rooms;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fsRoom = Math.max(7, Math.min(11, S * 4.4));
    ctx.font = `700 ${fsRoom}px ${fontFamily}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
    ctx.fillStyle = P.edgeText;
    for (const r of Object.values(R)) { const [sx, sy] = W2S(r.x + r.w / 2, r.y + CORR_Y + CORR_H + (ROW_H - CORR_Y - CORR_H) / 2); ctx.fillText(ROOM_NAMES[r.name], sx, sy + 0.5); }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    // status board on the dev floor
    let working = 0, done = 0;
    for (const a of agents.values()) if (a.kind === 'agent') { if (a.state === 'done') done++; else working++; }
    const [bx, by] = W2S(R.dev.x + R.dev.w / 2, R.dev.y + 12.5);
    const label = working || done ? `${working} working · ${done} done` : 'Agent Crew';
    let fs = Math.max(7, S * 4.4);
    ctx.font = `700 ${fs}px ${fontFamily}`;
    while (fs > 7 && ctx.measureText(label).width > 46 * S) { fs -= 0.5; ctx.font = `700 ${fs}px ${fontFamily}`; }
    ctx.fillStyle = '#2b2b33'; ctx.fillText(label, bx, by);
    // clock
    const [cx, cy] = W2S(R.dev.x + R.dev.w - 24, R.dev.y + 13), rr = 5.5 * S, d = new Date();
    ctx.fillStyle = '#f5f5f2'; ctx.strokeStyle = P.frame; ctx.lineWidth = Math.max(1, S * 0.8);
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const hand = (ang, len, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(ang) * len, cy - Math.cos(ang) * len); ctx.stroke(); };
    ctx.strokeStyle = '#2b2b33';
    hand(((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2, rr * 0.5, Math.max(1, S * 0.8));
    hand(d.getMinutes() / 60 * Math.PI * 2, rr * 0.8, Math.max(1, S * 0.5));
    // neon sign in the game room
    const [nx, ny] = W2S(R.game.x + 74, R.game.y + 11.5), cyc = t % 9000, flick = cyc < 120 || (cyc > 260 && cyc < 330);
    ctx.save();
    ctx.font = `800 ${Math.max(7, S * 5)}px ${fontFamily}`;
    ctx.shadowColor = '#ff3fd2'; ctx.shadowBlur = flick ? 0 : 3 * S; ctx.fillStyle = flick ? '#7a3a6e' : '#ffd1f4';
    ctx.fillText('GAME ON', nx, ny + 0.5);
    ctx.restore();
    // café menu board
    if (S >= 1.6) { const [mx, my] = W2S(R.cafe.x + 54, R.cafe.y + 9.5); ctx.font = `italic 700 ${Math.max(7, S * 3.6)}px ${fontFamily}`; ctx.fillStyle = '#e8efe9'; ctx.fillText('café', mx, my); }
    if (!order.length) {
      const [ex, ey] = W2S(R.dev.x + R.dev.w / 2, R.dev.y + 76);
      ctx.font = `13px ${fontFamily}`; ctx.fillStyle = dark ? '#d6d7e0' : '#333';
      ctx.fillText('Waiting for a Claude Code chat in this folder…', ex, ey);
    }
    if (cat.pos && !cat.path.length) {
      const [zx, zy] = W2S(cat.pos.x + 3, cat.pos.y - 7), p = (t % 2400) / 2400;
      ctx.font = `italic 700 ${Math.max(8, S * 3.5)}px ${fontFamily}`; ctx.fillStyle = dark ? '#cfd0e8' : '#555';
      ctx.globalAlpha = 1 - p; ctx.fillText('z', zx + p * 4 * S, zy - p * 6 * S); ctx.globalAlpha = 1;
    }
  }
  function hoveredAgent() {
    if (!mouse) return null;
    const wx = (mouse.x - OX) / S, wy = (mouse.y - OY) / S;
    let best = null, bd = 14;
    for (const a of agents.values()) {
      if (!a.pos || !a.placed) continue;
      const h = headTop(a), d = Math.hypot(h.x - wx, h.y + 6 - wy);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  function draw(t, dt) {
    drawWorld(t);
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = pal().page; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(world, 0, 0, L.W, L.H, Math.round(OX * dpr), Math.round(OY * dpr), Math.round(L.W * S * dpr), Math.round(L.H * S * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSigns(t);
    const hov = hoveredAgent();
    drawTags(t, hov);
    drawFlights(t, dt);
    const withBubbles = order.map(id => agents.get(id)).filter(a => a && (a.bubble || a.pending)).sort((p, q) => (p.bubble ? p.bubble.t0 : 0) - (q.bubble ? q.bubble.t0 : 0));
    for (const a of withBubbles) drawBubble(a, t);
  }

  // ---- loop: smooth while people walk, slower while they type, a trickle when the office is still -----------------
  let raf = 0, last = 0;
  function interval(t) {
    if (flights.length || t < elevUntil || cat.path.length) return 66;
    for (const a of agents.values()) if (!a.placed || a.path.length || a.fadeStart || t - a.born < 450) return 66;
    for (const a of agents.values()) if (a.bubble || a.pending || a.state === 'working' || a.state === 'thinking') return 100;
    if (here.get('game:p0') && here.get('game:p1')) return 66;
    for (const k of ['game:bb0', 'game:bb1', 'game:so0', 'game:so1', 'game:arc', 'cafe:coffee']) if (here.get(k)) return 150;
    return 333;
  }
  function frame(t) {
    raf = 0;
    if (document.hidden || !L) return;
    if (t - last >= interval(t)) {
      const dt = Math.min(250, last ? t - last : 16);
      last = t;
      tick(t, dt);
      draw(t, dt);
    }
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }

  document.addEventListener('visibilitychange', () => { last = 0; kick(); });
  new ResizeObserver(() => { relayout(); kick(); }).observe(stage);
  new MutationObserver(() => { readTheme(); facesKey = ''; updatePresence(); kick(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; kick(); });
  cv.addEventListener('mouseleave', () => { mouse = null; });
  feedEl.addEventListener('scroll', () => { if (feedEl.scrollHeight - feedEl.scrollTop - feedEl.clientHeight < 48) newPill.hidden = true; });
  newPill.addEventListener('click', () => { feedEl.scrollTop = feedEl.scrollHeight; newPill.hidden = true; });
  const saved = vscode.getState() || {};
  if (saved.nochat) app.classList.add('nochat');
  chatBtn.addEventListener('click', () => {
    app.classList.toggle('nochat');
    vscode.setState({ ...(vscode.getState() || {}), nochat: app.classList.contains('nochat') });
  });

  window.addEventListener('message', ev => {
    const m = ev.data;
    if (!m) return;
    if (m.type === 'snapshot') {
      resetAll();
      (m.agents || []).forEach(upsert);
      (m.feed || []).forEach(addChat);
      feedEl.scrollTop = feedEl.scrollHeight;
      newPill.hidden = true;
    } else if (m.type === 'events') {
      (m.events || []).forEach(apply);
    }
    updatePresence();
    kick();
  });

  readTheme();
  relayout();
  updatePresence();
  kick();
  vscode.postMessage({ type: 'ready' });
})();
