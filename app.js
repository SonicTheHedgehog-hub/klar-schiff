// Klar Schiff – App
import { TYPES, USER_ROOMS, FREQS, MODES, MODE_HELP } from './catalog.js';
import { D, startOfDay, dayDiff, pts, dueAt, cleanOf, planDays } from './plan.js';
import { CONFIG } from './config.js';

/* ---------- Icons ---------- */
const I = {
  kitchen:'<path d="M4 10h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><path d="M2 10h2M20 10h2M9 6.5c0-1 1-1 1-2.5M14 6.5c0-1 1-1 1-2.5"/>',
  bath:'<path d="M3 12h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2"/>',
  bed:'<path d="M3 19V7M21 19v-6a3 3 0 0 0-3-3h-8v6M3 14h18"/><circle cx="6.5" cy="11.5" r="1.5"/>',
  living:'<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4H3z"/><path d="M5 17v2M19 17v2"/>',
  office:'<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
  hall:'<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M4 21h16"/><circle cx="14.5" cy="12" r=".9"/>',
  balcony:'<path d="M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/><path d="M7 21h10"/>',
  other:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  share:'<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'
};
const svg = (k, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${I[k] || I.other}</svg>`;

/* ---------- Helpers ---------- */
const DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY;
const FN = 'klar-schiff-push';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const WD = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const WDL = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const freqLabel = n => (FREQS.find(f => f[0] === n) || [0, `alle ${n} Tage`])[1];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const sod = t => startOfDay(t);
const ms = v => v ? new Date(v).getTime() : null;
const iso = v => (v || v === 0) ? new Date(v).toISOString() : null;
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
const ls = {
  get(k, fb = null) { try { const v = localStorage.getItem(k); return v === null ? fb : JSON.parse(v); } catch (e) { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushCapable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const APP_URL = location.origin + location.pathname.replace(/index\.html$/, '');

/* ---------- State ---------- */
const S = {
  phase: 'loading', authMode: 'login', authErr: '', authMsg: '', onboardTab: 'create', onboardErr: '',
  uid: null, email: '', household: null, members: [], rooms: [], tasks: [], done: [], meId: null,
  view: 'today', roomId: null, filter: 'all', range: 7, openTips: new Set(), showDone: false, busy: new Set(),
  online: navigator.onLine, pushOn: false
};
const HID = () => S.household?.id;
const members = () => S.members;
const member = id => S.members.find(m => m.id === id);
const nameOf = id => member(id)?.name || 'Offen';
const roomOf = id => S.rooms.find(r => r.id === id);
const taskOf = id => S.tasks.find(t => t.id === id);
const vacation = () => !!S.household?.vacation_since;
const NOW = () => vacation() ? ms(S.household.vacation_since) : Date.now();
const av = (id, sm) => { const p = member(id); return p ? `<span class="av ${esc(p.color)} ${sm ? 'sm' : ''}" title="${esc(p.name)}">${esc(p.name.slice(0, 1).toUpperCase())}</span>` : `<span class="av open ${sm ? 'sm' : ''}" title="Offen">?</span>`; };

function normTask(r) { r.last = ms(r.last_done); r.created = ms(r.created_at); return r; }
function normDone(r) { r.at = ms(r.done_at); r.by = r.done_by; return r; }
const NORM = { tasks: normTask, completions: normDone };
const ARR = { rooms: 'rooms', tasks: 'tasks', completions: 'done', members: 'members' };

/* ---------- Supabase ---------- */
const sb = DEMO ? null : window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

function isNetErr(res) {
  return res && (res.status === 0 || /fetch|network|load failed|offline/i.test(res.error?.message || ''));
}

/* ---------- Local state changes (also replayed from the outbox) ---------- */
function applyLocal(op) {
  if (op.k === 'rpc') {
    if (op.fn === 'end_vacation' && S.household?.vacation_since) {
      const gap = Date.now() - ms(S.household.vacation_since);
      S.tasks.forEach(t => { if (t.last_done) { t.last_done = iso(ms(t.last_done) + gap); normTask(t); } });
      S.household.vacation_since = null;
    }
    return;
  }
  if (op.table === 'households') { if (op.k === 'update') Object.assign(S.household, op.patch); return; }
  const key = ARR[op.table]; if (!key) return;
  const norm = NORM[op.table] || (x => x);
  if (op.k === 'upsert') {
    for (const row of (op.rows || [op.row])) {
      const copy = norm({ ...row });
      const i = S[key].findIndex(x => x.id === row.id);
      if (i >= 0) S[key][i] = copy; else S[key].push(copy);
    }
  } else if (op.k === 'update') {
    const row = S[key].find(x => x.id === op.id); if (row) { Object.assign(row, op.patch); norm(row); }
  } else if (op.k === 'updateAll') {
    S[key].forEach(row => { Object.assign(row, op.patch); norm(row); });
  } else if (op.k === 'delete') {
    S[key] = S[key].filter(x => x.id !== op.id);
    if (op.table === 'rooms') S.tasks = S.tasks.filter(t => t.room_id !== op.id);
  }
}

async function execRemote(op, retry = true) {
  let q;
  if (op.k === 'upsert') q = sb.from(op.table).upsert(op.rows || op.row);
  else if (op.k === 'update') q = sb.from(op.table).update(op.patch).eq('id', op.id);
  else if (op.k === 'delete') q = sb.from(op.table).delete().eq('id', op.id);
  else if (op.k === 'updateAll') q = sb.from(op.table).update(op.patch).eq('household_id', op.hid);
  else if (op.k === 'rpc') q = sb.rpc(op.fn, op.args || {});
  const res = await q;
  if (!res.error) return;
  if (res.status === 401 && retry) { await sb.auth.refreshSession(); return execRemote(op, false); }
  const e = new Error(res.error.message); e.network = isNetErr(res); e.code = res.error.code; throw e;
}

/* ---------- Outbox: changes are kept until the server confirms them ---------- */
let outbox = ls.get('ks-outbox', []);
let flushing = false;
const saveOutbox = () => ls.set('ks-outbox', outbox);

function mutate(ops) {
  ops = [].concat(ops).map(o => (o.k === 'updateAll' ? { ...o, hid: HID() } : o));
  ops.forEach(applyLocal);
  saveCache(); render();
  if (DEMO) return;
  outbox.push(...ops); saveOutbox(); flush();
}

async function flush() {
  if (DEMO || flushing || !outbox.length) { updateSync(); return; }
  flushing = true; updateSync();
  try {
    while (outbox.length) {
      try { await execRemote(outbox[0]); outbox.shift(); saveOutbox(); S.online = true; }
      catch (e) {
        if (e.network) { S.online = false; break; }
        outbox.shift(); saveOutbox();
        toast('Eine Änderung konnte nicht gespeichert werden. Der Stand wird neu geladen.');
        refetchSoon();
      }
    }
  } finally { flushing = false; updateSync(); }
}

function updateSync() {
  const el = document.getElementById('sync'); if (!el) return;
  if (DEMO) { el.hidden = false; el.className = 'sync wait'; el.innerHTML = '<i></i>Demo'; return; }
  const n = outbox.length;
  if (!S.online) { el.hidden = false; el.className = 'sync off'; el.innerHTML = `<i></i>Offline${n ? ` · ${n} wartend` : ''}`; }
  else if (n) { el.hidden = false; el.className = 'sync wait'; el.innerHTML = '<i></i>Speichert …'; }
  else el.hidden = true;
}

/* ---------- Cache for instant start and offline use ---------- */
function saveCache() {
  const data = { uid: S.uid, household: S.household, members: S.members, rooms: S.rooms, tasks: S.tasks, done: S.done, meId: S.meId };
  ls.set(DEMO ? 'ks-demo' : 'ks-cache', data);
}
function loadCache(uid) {
  const c = ls.get(DEMO ? 'ks-demo' : 'ks-cache');
  if (!c || !c.household || (!DEMO && c.uid !== uid)) return false;
  Object.assign(S, { household: c.household, members: c.members || [], rooms: c.rooms || [], tasks: (c.tasks || []).map(normTask), done: (c.done || []).map(normDone), meId: c.meId });
  return true;
}

/* ---------- Loading from the server ---------- */
let refetchTimer, channel = null, fetching = false;
const refetchSoon = () => { clearTimeout(refetchTimer); refetchTimer = setTimeout(refetch, 350); };

async function refetch() {
  if (DEMO || fetching) return;
  fetching = true;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { S.phase = 'auth'; render(); return; }
    S.uid = session.user.id; S.email = session.user.email || '';
    const m = await sb.from('members').select('*').order('created_at');
    if (m.error) { if (isNetErr(m)) { S.online = false; updateSync(); } return; }
    const me = m.data.find(x => x.user_id === S.uid);
    if (!me) { S.phase = 'onboard'; render(); return; }
    const since = iso(sod(Date.now()) - 45 * D);
    const [h, r, t, c] = await Promise.all([
      sb.from('households').select('*').eq('id', me.household_id).single(),
      sb.from('rooms').select('*').order('sort'),
      sb.from('tasks').select('*'),
      sb.from('completions').select('*').gte('done_at', since).order('done_at', { ascending: false }).limit(2000)
    ]);
    const bad = [h, r, t, c].find(x => x.error);
    if (bad) { if (isNetErr(bad)) { S.online = false; updateSync(); } return; }
    Object.assign(S, { household: h.data, members: m.data, rooms: r.data, tasks: t.data.map(normTask), done: c.data.map(normDone), meId: me.id, online: true });
    outbox.forEach(applyLocal);
    saveCache();
    S.phase = 'app';
    listen(me.household_id);
    render(true);
  } finally { fetching = false; updateSync(); }
}

function listen(hid) {
  if (channel) return;
  channel = sb.channel('household-' + hid);
  for (const t of ['rooms', 'tasks', 'completions', 'members']) {
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: t, filter: 'household_id=eq.' + hid }, refetchSoon);
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: t, filter: 'household_id=eq.' + hid }, refetchSoon);
    channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table: t }, refetchSoon);
  }
  channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: 'id=eq.' + hid }, refetchSoon);
  channel.subscribe();
}

/* ---------- Planning ---------- */
function plan(days = 7) {
  const roomOrder = {}; S.rooms.forEach((r, i) => roomOrder[r.id] = r.sort ?? i);
  return planDays({ tasks: S.tasks, members: S.members, completions: S.done, roomOrder, vacation: vacation(), days });
}
function roomClean(rid) { const ts = S.tasks.filter(t => t.room_id === rid); return ts.length ? ts.reduce((a, t) => a + cleanOf(t, NOW()), 0) / ts.length : 1; }
function dueLabel(t) {
  const diff = dayDiff(sod(dueAt(t)), sod(Date.now()));
  if (diff < 0) return `<span class="due-over">seit ${-diff} ${-diff === 1 ? 'Tag' : 'Tagen'} fällig</span>`;
  if (diff === 0) return '<span class="due-today">heute</span>';
  if (diff === 1) return 'morgen';
  return `in ${diff} Tagen`;
}
const cls = c => c < .35 ? 'lo' : c < .7 ? 'mid' : '';

/* ---------- Rendering ---------- */
const $view = document.getElementById('view');
let deferred = false;
function render(soft) {
  const ae = document.activeElement;
  if (soft && ae && $view.contains(ae) && ae.matches('input,textarea,select')) { deferred = true; return; }
  deferred = false;
  const inApp = S.phase === 'app';
  document.getElementById('tabs').hidden = !inApp;
  document.getElementById('setBtn').hidden = !inApp;
  const mb = document.getElementById('meBtn'); mb.hidden = !inApp; if (inApp) mb.innerHTML = av(S.meId);
  updateSync();
  if (S.phase === 'loading') return;
  if (S.phase === 'auth') { $view.innerHTML = renderAuth(); return; }
  if (S.phase === 'onboard') { if (!$view.querySelector('.setup')) $view.innerHTML = renderOnboard(); else updateOnboard(); return; }
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-current', (b.dataset.v === S.view || (S.view === 'room' && b.dataset.v === 'rooms')) ? 'page' : 'false'));
  const v = { today: renderToday, week: renderWeek, rooms: renderRooms, room: renderRoom, stats: renderStats, settings: renderSettings }[S.view] || renderToday;
  $view.innerHTML = `<div class="view">${v()}</div>`;
  updateBadge();
}
document.addEventListener('focusout', () => setTimeout(() => { if (deferred) render(true); }, 50));

function installCard() {
  if (!isIOS || standalone || ls.get('ks-hide-install')) return '';
  return `<div class="install"><div class="spread"><b>Als App installieren</b><button class="link" data-act="hideInstall">Ausblenden</button></div>
    <ol><li>Unten in Safari auf das Teilen-Symbol ${svg('share', 'width="15" height="15" style="vertical-align:-2px"')} tippen</li><li>„Zum Home-Bildschirm“ wählen</li><li>Klar Schiff vom Home-Bildschirm öffnen</li></ol>
    <span class="muted">Nur so funktionieren Erinnerungen und der Vollbildmodus.</span></div>`;
}
function inviteCard() {
  if (DEMO || members().length > 1) return '';
  return `<div class="tipday" style="background:var(--sky);color:var(--sky-ink)">${svg('share')}<div style="flex:1;min-width:0"><div class="eyebrow" style="color:inherit">Partner einladen</div>
    <p>Deine Frau installiert Klar Schiff, erstellt ein Konto und gibt diesen Code ein:</p>
    <div class="codebox" style="margin-top:8px"><span class="code">${esc(S.household.invite_code)}</span><button class="btn sm" data-act="shareCode">Teilen</button></div></div></div>`;
}

function taskRow(it, key = '') {
  const t = it.t, r = roomOf(t.room_id), open = S.openTips.has(t.id + key);
  return `<div class="trow" data-row="${t.id}">
    <button class="check" data-act="done" data-tid="${t.id}" aria-label="${esc(t.name)} erledigt">${svg('check')}</button>
    <div class="tmain"><div class="tname">${esc(t.name)}</div>
      <div class="tmeta"><span>${esc(r?.name || '')}</span><span class="num">${t.minutes} Min</span><span class="num">${pts(t)} P</span>${it.overdue ? dueLabel(t) : ''}</div></div>
    <button class="who" data-act="assign" data-tid="${t.id}" aria-label="Zuständig: ${esc(nameOf(it.who))}">${av(it.who)}</button>
    ${t.tip ? `<button class="tipbtn" data-act="tip" data-tid="${t.id}${key}" aria-expanded="${open}" aria-label="Putztipp">${svg('bulb')}</button>` : '<span></span>'}
    ${open ? `<div class="tipbox">${esc(t.tip)}</div>` : ''}
  </div>`;
}

function ring(doneBy, remaining) {
  const ps = members(), total = ps.reduce((a, p) => a + (doneBy[p.id] || 0), 0) + remaining;
  const C = 2 * Math.PI * 44; let off = 0;
  const arcs = ps.map(p => { const len = total ? C * (doneBy[p.id] || 0) / total : 0; const s = `<circle cx="52" cy="52" r="44" fill="none" stroke="var(--${esc(p.color)}-solid)" stroke-width="12" stroke-dasharray="${len} ${C}" stroke-dashoffset="${-off}"/>`; off += len; return s; }).join('');
  const pct = total ? Math.round(100 * (total - remaining) / total) : 100;
  return `<div class="ring"><svg viewBox="0 0 104 104"><circle cx="52" cy="52" r="44" fill="none" stroke="var(--line)" stroke-width="12"/>${arcs}</svg><div class="lbl"><div><b class="num">${pct}%</b><br><span>geschafft</span></div></div></div>`;
}

function renderToday() {
  const now = new Date(), h = now.getHours();
  const greet = h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : 'Guten Abend';
  const me = member(S.meId);
  if (vacation()) return `${installCard()}<div class="hero"><div class="txt"><h1>Urlaubsmodus ist an</h1><p class="muted" style="margin:0">Alle Aufgaben pausieren. Die Sauberkeit friert ein, bis ihr zurück seid.</p><div><button class="btn sm" data-act="vacation">Urlaub beenden</button></div></div></div>`;
  const today = plan(1)[0], today0 = sod(Date.now());
  const doneToday = S.done.filter(d => d.at >= today0).sort((a, b) => b.at - a.at);
  const doneBy = {}; doneToday.forEach(d => doneBy[d.by] = (doneBy[d.by] || 0) + (d.points || 0));
  const remPts = today.reduce((a, it) => a + pts(it.t), 0);
  const remMin = today.reduce((a, it) => a + (+it.t.minutes || 0), 0);
  const mine = today.filter(i => i.who === S.meId);
  const counts = { all: today.length, me: mine.length, other: today.filter(i => i.who && i.who !== S.meId).length, open: today.filter(i => !i.who).length };
  const f = S.filter;
  const shown = today.filter(i => f === 'all' || (f === 'me' && i.who === S.meId) || (f === 'other' && i.who && i.who !== S.meId) || (f === 'open' && !i.who));
  const myMin = mine.reduce((a, i) => a + (+i.t.minutes || 0), 0);
  const others = members().filter(m => m.id !== S.meId);
  const otherLabel = others.length === 1 ? others[0].name : 'Andere';
  const tips = S.tasks.filter(t => t.tip).sort((a, b) => a.id.localeCompare(b.id));
  const tipT = tips.length ? tips[Math.floor(today0 / D) % tips.length] : null;
  return `${installCard()}${inviteCard()}
  <div class="hero">${ring(doneBy, remPts)}
    <div class="txt"><div class="eyebrow">${WDL[now.getDay()]}, ${now.getDate()}.${now.getMonth() + 1}.</div>
      <h1>${greet}${me ? ', ' + esc(me.name) : ''}</h1>
      <div class="muted" style="font-size:14px">${today.length ? `Noch <b class="num">${today.length}</b> ${today.length === 1 ? 'Aufgabe' : 'Aufgaben'} · ca. <b class="num">${remMin}</b> Min${myMin ? `, davon ${myMin} Min für dich` : ''}` : 'Für heute ist alles erledigt. Klar Schiff!'}</div>
      <div class="legend">${members().map(p => `<span><i style="background:var(--${esc(p.color)}-solid)"></i>${esc(p.name)} <b class="num">${doneBy[p.id] || 0}</b> P</span>`).join('')}</div>
    </div></div>
  <div class="chips" role="group" aria-label="Filter">
    ${[['all', 'Alle'], ['me', 'Meine'], ...(others.length ? [['other', otherLabel]] : []), ['open', 'Zum Aussuchen']].map(([k, l]) => `<button class="chip" data-act="filter" data-f="${k}" aria-pressed="${f === k}">${esc(l)}<span class="c num">${counts[k]}</span></button>`).join('')}
  </div>
  <div class="card list">${shown.length ? shown.map(it => taskRow(it)).join('') : `<div class="empty"><b>${today.length ? 'Hier ist gerade nichts' : 'Alles erledigt'}</b>${today.length ? 'Schau in einem anderen Filter nach.' : 'Morgen geht es weiter. Im Wochenplan siehst du, was ansteht.'}</div>`}</div>
  ${doneToday.length ? `<div class="section"><button class="spread" data-act="toggleDone"><h2>Heute erledigt <span class="muted num" style="font-weight:500">${doneToday.length}</span></h2><span class="link">${S.showDone ? 'Ausblenden' : 'Anzeigen'}</span></button>
    ${S.showDone ? `<div class="card list">${doneToday.map(d => `<div class="hist">${av(d.by, 1)}<div><div>${esc(d.task_name)}</div><div class="tmeta">${esc(roomOf(d.room_id)?.name || '')} · +${d.points} P</div></div><button class="link" data-act="undo" data-did="${d.id}">Rückgängig</button></div>`).join('')}</div>` : ''}</div>` : ''}
  ${tipT ? `<div class="tipday">${svg('bulb')}<div><div class="eyebrow" style="color:inherit">Putztipp des Tages · ${esc(tipT.name)}</div><p>${esc(tipT.tip)}</p></div></div>` : ''}`;
}

function renderWeek() {
  if (vacation()) return `<div class="banner">Urlaubsmodus ist an. Der Wochenplan startet wieder, wenn ihr den Urlaub beendet.</div>`;
  const P = plan(7), ps = members(), today0 = sod(Date.now());
  const weekBy = {}; ps.forEach(p => weekBy[p.id] = 0); let open = 0;
  P.flat().forEach(it => it.who ? weekBy[it.who] += +it.t.minutes || 0 : open += +it.t.minutes || 0);
  const tot = Object.values(weekBy).reduce((a, b) => a + b, 0) + open;
  return `
  <div class="section"><h1 style="font-size:24px">Die nächsten 7 Tage</h1>
    <div class="muted" style="font-size:14px">Ca. <b class="num">${Math.round(tot / 6) / 10}</b> Stunden Hausarbeit, so verteilt:</div>
    <div class="split" style="height:10px;margin-top:6px">${ps.map(p => `<i style="width:${tot ? 100 * weekBy[p.id] / tot : 0}%;background:var(--${esc(p.color)}-solid)"></i>`).join('')}<i style="width:${tot ? 100 * open / tot : 0}%;background:var(--muted);opacity:.35"></i></div>
    <div class="legend">${ps.map(p => `<span><i style="background:var(--${esc(p.color)}-solid)"></i>${esc(p.name)} <b class="num">${weekBy[p.id]}</b> Min</span>`).join('')}${open ? `<span><i style="background:var(--muted)"></i>Offen <b class="num">${open}</b> Min</span>` : ''}</div>
  </div>
  ${P.map((items, d) => {
    const dt = new Date(today0 + d * D + 12 * 3600000);
    const byP = {}; items.forEach(it => { const k = it.who || 'open'; byP[k] = (byP[k] || 0) + (+it.t.minutes || 0); });
    return `<div class="day"><div class="dayhead"><h3>${d === 0 ? 'Heute' : d === 1 ? 'Morgen' : WDL[dt.getDay()]}</h3><span class="muted" style="font-size:13px">${WD[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.</span>
      <span class="tot">${ps.map(p => byP[p.id] ? `<span class="row" style="gap:4px">${av(p.id, 1)}<span class="num">${byP[p.id]}′</span></span>` : '').join('')}${byP.open ? `<span class="row" style="gap:4px">${av(null, 1)}<span class="num">${byP.open}′</span></span>` : ''}</span></div>
      <div class="card">${items.length ? items.map(it => `<div class="mini"><div class="tmain"><div class="tname">${esc(it.t.name)}</div><div class="tmeta"><span>${esc(roomOf(it.t.room_id)?.name || '')}</span><span class="num">${it.t.minutes} Min</span>${it.overdue ? '<span class="due-over">überfällig</span>' : ''}</div></div>${d === 0 ? `<button class="check" data-act="done" data-tid="${it.t.id}" aria-label="Erledigt" style="width:26px;height:26px">${svg('check')}</button>` : '<span></span>'}<button data-act="assign" data-tid="${it.t.id}" ${d > 0 ? 'disabled' : ''} aria-label="Zuständig">${av(it.who, 1)}</button></div>`).join('') : '<div class="empty" style="padding:12px">Freier Tag</div>'}</div></div>`;
  }).join('')}`;
}

function renderRooms() {
  const rooms = [...S.rooms].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const home = rooms.length ? rooms.reduce((a, r) => a + roomClean(r.id), 0) / rooms.length : 1;
  const msg = home > .8 ? 'Glänzt fast überall.' : home > .55 ? 'Ganz ordentlich, ein paar Ecken warten.' : home > .3 ? 'Zeit für eine kleine Putzrunde.' : 'Hier ist einiges liegen geblieben.';
  const dueSoon = r => S.tasks.filter(t => t.room_id === r.id && dueAt(t) < sod(Date.now()) + D).length;
  return `
  <div class="home-score"><div><div class="eyebrow">Wohnung</div><h1><span class="num">${Math.round(home * 100)}</span>% sauber</h1></div>
    <div class="bar ${cls(home)}" style="height:10px"><i style="width:${home * 100}%"></i></div><div class="muted" style="font-size:14px">${msg}</div></div>
  <div class="rgrid">
    ${rooms.map((r, i) => { const c = roomClean(r.id), n = dueSoon(r); return `<button class="rcard" data-act="room" data-rid="${r.id}">
      <div class="spread"><span class="ricon ${i % 3 === 1 ? 'alt' : ''}">${svg(r.type)}</span><b class="num" style="font-family:var(--display);font-size:18px">${Math.round(c * 100)}%</b></div>
      <div><div class="nm">${esc(r.name)}</div><div class="sub">${n ? `${n} fällig` : 'Nichts fällig'}</div></div>
      <div class="bar ${cls(c)}"><i style="width:${c * 100}%"></i></div></button>`; }).join('')}
    <button class="rcard add" data-act="addRoom">${svg('plus', 'width="22" height="22"')}Raum anlegen</button>
  </div>`;
}

function renderRoom() {
  const r = roomOf(S.roomId); if (!r) { S.view = 'rooms'; return renderRooms(); }
  const ts = S.tasks.filter(t => t.room_id === r.id).sort((a, b) => dueAt(a) - dueAt(b));
  const c = roomClean(r.id);
  return `
  <div class="spread"><button class="back" data-act="go" data-v="rooms">${svg('back')}Räume</button><button class="btn sec sm" data-act="editRoom">${svg('edit')}Bearbeiten</button></div>
  <div class="row" style="gap:14px"><span class="ricon" style="width:52px;height:52px">${svg(r.type)}</span><div style="flex:1;min-width:0"><h1 style="font-size:26px">${esc(r.name)}</h1><div class="row"><div class="bar ${cls(c)}" style="flex:1"><i style="width:${c * 100}%"></i></div><b class="num">${Math.round(c * 100)}%</b></div></div></div>
  <div class="row" style="flex-wrap:wrap"><button class="btn sm" data-act="addTask">${svg('plus')}Aufgabe</button>${ts.length ? `<button class="btn sec sm" data-act="roomAll">Alles erledigt</button>` : ''}</div>
  <div class="card list">${ts.length ? ts.map(t => { const tc = cleanOf(t, NOW()); return `<div class="trow">
      <button class="check" data-act="done" data-tid="${t.id}" aria-label="Erledigt">${svg('check')}</button>
      <button class="tmain" data-act="editTask" data-tid="${t.id}" style="text-align:left"><div class="tname">${esc(t.name)}</div><div class="tmeta"><span>${freqLabel(t.freq)}</span><span class="num">${t.minutes} Min</span><span>${dueLabel(t)}</span></div>
        <div class="bar ${cls(tc)}" style="height:4px;margin-top:6px;max-width:160px"><i style="width:${tc * 100}%"></i></div></button>
      <span class="muted" style="font-size:12px;text-align:right">${t.mode === 'fixed' ? av(t.person, 1) : MODES[t.mode || 'fair'].split(' ')[0]}</span>
      ${t.tip ? `<button class="tipbtn" data-act="tip" data-tid="${t.id}r" aria-expanded="${S.openTips.has(t.id + 'r')}" aria-label="Putztipp">${svg('bulb')}</button>` : '<span></span>'}
      ${S.openTips.has(t.id + 'r') ? `<div class="tipbox">${esc(t.tip)}</div>` : ''}</div>`; }).join('') : `<div class="empty"><b>Noch keine Aufgaben</b>Tippe auf „Aufgabe“, um Vorschläge für diesen Raum zu sehen.</div>`}</div>`;
}

function renderStats() {
  const ps = members(), N = S.range, today0 = sod(Date.now()), since = today0 - (N - 1) * D;
  const ds = S.done.filter(d => d.at >= since);
  const agg = {}; ps.forEach(p => agg[p.id] = { pts: 0, min: 0, n: 0 });
  ds.forEach(d => { if (agg[d.by]) { agg[d.by].pts += d.points || 0; agg[d.by].min += d.minutes || 0; agg[d.by].n++; } });
  const streak = id => { const days = new Set(S.done.filter(d => d.by === id).map(d => sod(d.at))); let s = 0, d = today0; if (!days.has(d)) d = sod(d - D / 2); while (days.has(d)) { s++; d = sod(d - D / 2); } return s; };
  const total = ps.reduce((a, p) => a + agg[p.id].pts, 0);
  const byPts = [...ps].sort((a, b) => agg[b.id].pts - agg[a.id].pts);
  let advice = 'Noch keine Punkte in diesem Zeitraum. Hakt ein paar Aufgaben ab, dann seht ihr hier, wie ihr euch die Arbeit teilt.';
  if (ps.length < 2) advice = 'Sobald dein Partner beigetreten ist, seht ihr hier, wie ihr euch die Arbeit teilt.';
  else if (total) {
    const lead = byPts[0], behind = byPts[byPts.length - 1], diff = agg[lead.id].pts - agg[behind.id].pts;
    advice = diff / total < .12 ? 'Ihr teilt euch die Arbeit ziemlich gleichmäßig. Weiter so!'
      : `${esc(lead.name)} liegt <b class="num">${diff}</b> Punkte vorne. ${esc(behind.name)} könnte sich in den nächsten Tagen eine größere Aufgabe aussuchen. Aufgaben auf „Fair nach Punkten“ gleichen das automatisch aus.`;
  }
  const cols = Array.from({ length: N }, (_, i) => { const d0 = sod(since + i * D + D / 2); const d1 = sod(d0 + D + D / 2); const o = {}; ps.forEach(p => o[p.id] = 0); ds.forEach(d => { if (d.at >= d0 && d.at < d1 && o[d.by] !== undefined) o[d.by] += d.points || 0; }); return { d0, o }; });
  const max = Math.max(10, ...cols.map(c => Object.values(c.o).reduce((x, y) => x + y, 0)));
  const hist = [...S.done].sort((x, y) => y.at - x.at).slice(0, 15);
  return `
  <div class="spread"><h1 style="font-size:24px">Punkte</h1><div class="seg" role="group">${[[7, '7 Tage'], [30, '30 Tage']].map(([k, l]) => `<button data-act="range" data-r="${k}" aria-pressed="${N === k}">${l}</button>`).join('')}</div></div>
  <div class="pgrid ${ps.length === 1 ? 'n1' : ''}">${ps.map(p => `<div class="pbox ${esc(p.color)}"><div class="row">${av(p.id)}<b>${esc(p.name)}</b></div><div><span class="big num">${agg[p.id].pts}</span> <span class="k">Punkte</span></div>
    <dl><dt>Zeit</dt><dd class="num">${Math.floor(agg[p.id].min / 60)} h ${agg[p.id].min % 60} min</dd><dt>Aufgaben</dt><dd class="num">${agg[p.id].n}</dd><dt>Serie</dt><dd class="num">${streak(p.id)} ${streak(p.id) === 1 ? 'Tag' : 'Tage'}</dd></dl></div>`).join('')}</div>
  <div class="section"><div class="split" style="height:12px">${ps.map(p => `<i style="width:${total ? 100 * agg[p.id].pts / total : 100 / ps.length}%;background:var(--${esc(p.color)}-solid)"></i>`).join('')}</div>
    <p style="margin:4px 0 0;font-size:14px">${advice}</p></div>
  <div class="section"><h2>Punkte pro Tag</h2><div class="card" style="padding:12px 14px">
    <div class="chart">${cols.map(c => `<div class="col" title="${new Date(c.d0).getDate()}.${new Date(c.d0).getMonth() + 1}.">${ps.map(p => c.o[p.id] ? `<i style="height:${100 * c.o[p.id] / max}%;background:var(--${esc(p.color)}-solid)"></i>` : '').reverse().join('')}</div>`).join('')}</div>
    <div class="chart-x">${cols.map((c, i) => `<span>${N === 7 ? WD[new Date(c.d0).getDay()] : (i % 5 === 4 || i === N - 1 ? new Date(c.d0).getDate() + '.' : '')}</span>`).join('')}</div></div></div>
  <div class="section"><h2>Verlauf</h2><div class="card list">${hist.length ? hist.map(d => { const dt = new Date(d.at); return `<div class="hist">${av(d.by, 1)}<div style="min-width:0"><div class="tname" style="font-weight:500">${esc(d.task_name)}</div><div class="tmeta">${WD[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}. · ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')} · +${d.points} P</div></div><button class="link" data-act="undo" data-did="${d.id}">Löschen</button></div>`; }).join('') : '<div class="empty">Noch nichts erledigt.</div>'}</div></div>`;
}

function renderSettings() {
  const hh = S.household, me = member(S.meId) || {};
  const hours = [['', 'Aus'], ...Array.from({ length: 17 }, (_, i) => [String(i + 6), `${i + 6}:00 Uhr`])];
  let pushBlock;
  if (DEMO) pushBlock = `<div class="muted" style="font-size:13px">Im Demo-Modus gibt es keine Erinnerungen.</div>`;
  else if (isIOS && !standalone) pushBlock = `<div class="muted" style="font-size:13px">Lege Klar Schiff zuerst auf den Home-Bildschirm und öffne die App von dort. Erst dann erlaubt das iPhone Benachrichtigungen.</div>`;
  else if (!pushCapable) pushBlock = `<div class="muted" style="font-size:13px">Dieser Browser unterstützt keine Benachrichtigungen.</div>`;
  else if (S.pushOn) pushBlock = `<div class="row" style="flex-wrap:wrap"><span class="muted" style="font-size:14px;flex:1">Auf diesem Handy sind Erinnerungen an.</span><button class="btn sec sm" data-act="testPush">Test senden</button></div>`;
  else pushBlock = `<button class="btn sm" data-act="enablePush">${svg('bell')}Erinnerungen auf diesem Handy aktivieren</button>`;
  return `
  <div class="spread"><button class="back" data-act="go" data-v="today">${svg('back')}Zurück</button></div>
  <h1 style="font-size:24px">Einstellungen</h1>
  <div class="section"><h2>Ich</h2><div class="card" style="padding:14px;display:flex;flex-direction:column;gap:12px">
    <div class="row">${av(S.meId)}<input type="text" id="myName" value="${esc(me.name || '')}" maxlength="30" aria-label="Mein Name"><button class="btn sm" data-act="saveName">Speichern</button></div>
    ${DEMO ? `<div class="lbl">Demo: Ansicht wechseln</div><div class="opts">${members().map(p => `<button class="opt" data-act="demoMe" data-pid="${p.id}" aria-pressed="${S.meId === p.id}">${av(p.id, 1)}${esc(p.name)}</button>`).join('')}</div>` : `<div class="muted" style="font-size:13px">Angemeldet als ${esc(S.email)}</div>`}
  </div></div>
  <div class="section"><h2>Haushalt</h2><div class="card" style="padding:14px;display:flex;flex-direction:column;gap:12px">
    <div class="opts">${members().map(p => `<span class="opt" style="cursor:default">${av(p.id, 1)}${esc(p.name)}</span>`).join('')}</div>
    ${DEMO ? '<div class="muted" style="font-size:13px">Im Demo-Modus kann niemand beitreten.</div>' : `<div class="lbl">Einladungscode</div><div class="codebox"><span class="code">${esc(hh.invite_code)}</span><button class="btn sec sm" data-act="shareCode">${svg('share')}Teilen</button></div>
    <div class="muted" style="font-size:13px">Wer beitreten will, erstellt in Klar Schiff ein eigenes Konto und gibt diesen Code ein. Bis zu vier Personen.</div>`}
  </div></div>
  <div class="section"><h2>Verteilung</h2><div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px">
    <div class="lbl">Standard für neue Aufgaben</div>
    <div class="opts">${Object.entries(MODES).filter(([k]) => k !== 'fixed').map(([k, l]) => `<button class="opt" data-act="defMode" data-m="${k}" aria-pressed="${(hh.default_mode || 'fair') === k}">${l}</button>`).join('')}</div>
    <div class="muted" style="font-size:13px">${MODE_HELP[hh.default_mode || 'fair']} Pro Aufgabe kannst du das im Raum jederzeit ändern. Mit „Ich mach’s“ kann sich jeder eine Aufgabe schnappen.</div>
    <div><button class="btn sec sm" data-act="applyMode">Auf alle Aufgaben anwenden</button></div></div></div>
  <div class="section"><h2>Erinnerungen</h2><div class="card" style="padding:0 14px">
    <div class="toggle" style="flex-direction:column;align-items:stretch">${pushBlock}</div>
    <div class="toggle"><div><b>Morgens erinnern</b><div class="muted" style="font-size:13px">Was heute für dich ansteht</div></div><select class="inline" id="remindHour" ${DEMO ? 'disabled' : ''}>${hours.map(([v, l]) => `<option value="${v}" ${String(me.remind_hour ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="toggle"><div><b>Bei Übergaben</b><div class="muted" style="font-size:13px">Wenn dir jemand eine Aufgabe gibt</div></div><button class="sw" role="switch" aria-checked="${me.notify_handover !== false}" data-act="notifyHandover" aria-label="Bei Übergaben benachrichtigen" ${DEMO ? 'disabled' : ''}></button></div>
  </div></div>
  <div class="section"><h2>Pause</h2><div class="card" style="padding:0 14px">
    <div class="toggle"><div><b>Urlaubsmodus</b><div class="muted" style="font-size:13px">Pausiert alle Fälligkeiten, bis ihr zurück seid.</div></div><button class="sw" role="switch" aria-checked="${vacation()}" data-act="vacation" aria-label="Urlaubsmodus"></button></div>
  </div></div>
  <div class="section"><div class="row" style="flex-wrap:wrap">${DEMO ? `<button class="btn sec sm" data-act="resetDemo">Demo zurücksetzen</button>` : `<button class="btn sec sm" data-act="logout">Abmelden</button>`}</div></div>`;
}

/* ---------- Login & onboarding ---------- */
function renderAuth() {
  const m = S.authMode;
  const title = { login: 'Anmelden', signup: 'Konto erstellen', reset: 'Passwort zurücksetzen', newpw: 'Neues Passwort' }[m];
  return `<div class="authwrap">
    <div class="setup" style="padding:0"><div class="intro"><div class="eyebrow" style="color:var(--sky-ink)">Willkommen an Bord</div><h1>Klar Schiff</h1><p style="margin:0">Euer gemeinsamer Putzplan. Jede Person hat ein eigenes Konto, beide sehen denselben Plan.</p></div></div>
    <h2 style="font-size:21px">${title}</h2>
    <form id="authForm" novalidate>
      ${m !== 'newpw' ? `<div class="field"><label for="aEmail">E-Mail</label><input type="email" id="aEmail" autocomplete="email" inputmode="email" required></div>` : ''}
      ${m !== 'reset' ? `<div class="field"><label for="aPw">${m === 'newpw' ? 'Neues Passwort' : 'Passwort'}</label><input type="password" id="aPw" autocomplete="${m === 'login' ? 'current-password' : 'new-password'}" minlength="6" required>${m !== 'login' ? '<span class="muted" style="font-size:13px">Mindestens 6 Zeichen</span>' : ''}</div>` : ''}
      ${S.authErr ? `<div class="err" role="alert">${esc(S.authErr)}</div>` : ''}
      ${S.authMsg ? `<div class="note" role="status">${esc(S.authMsg)}</div>` : ''}
      <button class="btn" type="submit" id="authBtn">${{ login: 'Anmelden', signup: 'Konto erstellen', reset: 'Link schicken', newpw: 'Passwort speichern' }[m]}</button>
    </form>
    ${m === 'login' ? `<button class="textbtn" data-act="authMode" data-m="signup">Noch kein Konto? Jetzt erstellen</button><button class="textbtn" data-act="authMode" data-m="reset">Passwort vergessen?</button>` : ''}
    ${m === 'signup' || m === 'reset' ? `<button class="textbtn" data-act="authMode" data-m="login">Ich habe schon ein Konto</button>` : ''}
    ${installCard()}
  </div>`;
}

function renderOnboard() {
  return `<div class="setup">
    <div class="intro"><div class="eyebrow" style="color:var(--sky-ink)">Fast geschafft</div><h1>Euer Haushalt</h1><p style="margin:0">Lege einen neuen Haushalt an oder tritt dem deiner Partnerin oder deines Partners bei.</p></div>
    <div class="seg" role="group" id="obTabs"><button data-act="obTab" data-t="create" aria-pressed="${S.onboardTab === 'create'}">Neuer Haushalt</button><button data-act="obTab" data-t="join" aria-pressed="${S.onboardTab === 'join'}">Mit Code beitreten</button></div>
    <div id="obCreate" ${S.onboardTab === 'create' ? '' : 'hidden'} style="display:flex;flex-direction:column;gap:18px">
      <div class="${DEMO ? 'grid2' : ''}"><div class="field"><label for="obName">Dein Name</label><input type="text" id="obName" maxlength="30" autocomplete="given-name" placeholder="z. B. Semyon"></div>
        ${DEMO ? `<div class="field"><label for="obPartner">Partner (Demo)</label><input type="text" id="obPartner" maxlength="30" placeholder="z. B. Anna"></div>` : ''}</div>
      <div class="section"><h2>Welche Räume?</h2><div class="card" style="padding:0 14px">
        ${USER_ROOMS.map(([n, t], i) => `<label class="sugg"><input type="checkbox" id="sr${i}" checked><div><div class="tname">${n}</div><div class="tmeta">${TYPES[t].tasks.filter(x => x[4]).length} Startaufgaben</div></div></label>`).join('')}</div>
        <div class="muted" style="font-size:13px">Die Aufgaben verteilen sich über die nächsten Tage, damit nicht alles auf einmal fällig ist. Weitere Räume kannst du später anlegen.</div></div>
      <div class="section"><h2>Wie wollt ihr verteilen?</h2>
        <div class="opts" id="setupMode">${['fair', 'rotate', 'open'].map((k, i) => `<button class="opt" data-act="setupMode" data-m="${k}" aria-pressed="${i === 0}">${MODES[k]}</button>`).join('')}</div>
        <div class="muted" style="font-size:13px" id="setupModeHelp">${MODE_HELP.fair}</div></div>
      <button class="btn" data-act="create" id="createBtn">Haushalt anlegen</button>
    </div>
    <div id="obJoin" ${S.onboardTab === 'join' ? '' : 'hidden'} style="display:flex;flex-direction:column;gap:14px">
      ${DEMO ? '<div class="note">Beitreten geht nur in der verbundenen Version, nicht im Demo-Modus.</div>' : `
      <div class="field"><label for="jCode">Einladungscode</label><input type="text" id="jCode" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="z. B. F556D6" style="text-transform:uppercase;letter-spacing:.15em;font-weight:700"></div>
      <div class="field"><label for="jName">Dein Name</label><input type="text" id="jName" maxlength="30" autocomplete="given-name"></div>
      <div class="muted" style="font-size:13px">Den Code findet dein Partner in Klar Schiff unter Einstellungen.</div>
      <button class="btn" data-act="join" id="joinBtn">Beitreten</button>`}
    </div>
    <div class="err" id="obErr" role="alert">${esc(S.onboardErr)}</div>
    ${DEMO ? '' : '<button class="textbtn" data-act="logout">Abmelden</button>'}
  </div>`;
}
function updateOnboard() {
  document.getElementById('obCreate').hidden = S.onboardTab !== 'create';
  document.getElementById('obJoin').hidden = S.onboardTab !== 'join';
  document.querySelectorAll('#obTabs button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === S.onboardTab));
  document.getElementById('obErr').textContent = S.onboardErr;
}

const AUTH_ERRORS = [
  [/invalid login credentials/i, 'E-Mail oder Passwort stimmt nicht.'],
  [/email not confirmed/i, 'Bitte bestätige zuerst den Link in der E-Mail, die wir dir geschickt haben.'],
  [/already registered|already been registered|user already exists/i, 'Zu dieser E-Mail gibt es schon ein Konto. Melde dich an.'],
  [/password should be at least|weak/i, 'Das Passwort ist zu kurz. Nimm mindestens 6 Zeichen.'],
  [/rate limit|too many/i, 'Zu viele Versuche. Warte ein paar Minuten und versuch es dann noch einmal.'],
  [/fetch|network|load failed/i, 'Keine Verbindung. Prüfe dein Internet und versuch es noch einmal.'],
  [/invalid.*email|email.*invalid/i, 'Diese E-Mail-Adresse sieht nicht richtig aus.']
];
const authError = msg => (AUTH_ERRORS.find(([r]) => r.test(msg || '')) || [0, 'Das hat nicht geklappt: ' + msg])[1];

document.addEventListener('submit', async e => {
  if (e.target.id !== 'authForm') return;
  e.preventDefault();
  const email = document.getElementById('aEmail')?.value.trim();
  const pw = document.getElementById('aPw')?.value;
  const btn = document.getElementById('authBtn');
  S.authErr = ''; S.authMsg = '';
  if (S.authMode !== 'newpw' && !/^\S+@\S+\.\S+$/.test(email || '')) { S.authErr = 'Bitte gib deine E-Mail-Adresse ein.'; render(); return; }
  if (S.authMode !== 'reset' && (!pw || pw.length < 6)) { S.authErr = 'Das Passwort braucht mindestens 6 Zeichen.'; render(); return; }
  btn.disabled = true; btn.textContent = 'Einen Moment …';
  let res;
  if (S.authMode === 'login') res = await sb.auth.signInWithPassword({ email, password: pw });
  else if (S.authMode === 'signup') res = await sb.auth.signUp({ email, password: pw, options: { emailRedirectTo: APP_URL } });
  else if (S.authMode === 'reset') res = await sb.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
  else res = await sb.auth.updateUser({ password: pw });
  if (res.error) { S.authErr = authError(res.error.message); render(); return; }
  if (S.authMode === 'reset') { S.authMsg = 'Wir haben dir einen Link geschickt. Öffne ihn, um ein neues Passwort festzulegen.'; render(); return; }
  if (S.authMode === 'signup' && !res.data.session) { S.authMode = 'login'; S.authMsg = 'Fast geschafft: Wir haben dir eine E-Mail geschickt. Tippe auf den Link darin und melde dich dann hier an.'; render(); return; }
  S.authMode = 'login';
  await refetch();
});

/* ---------- Sheets & toast ---------- */
const $sheet = document.getElementById('sheet');
function openSheet(html) { $sheet.innerHTML = `<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`; }
function closeSheet() { $sheet.innerHTML = ''; }
let toastTimer;
function toast(msg, undoId) {
  const el = document.getElementById('toast');
  el.innerHTML = `<div class="toast" role="status"><span>${msg}</span>${undoId ? `<button data-act="undo" data-did="${undoId}">Rückgängig</button>` : ''}</div>`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.innerHTML = '', 5000);
}

function assignSheet(tid) {
  const t = taskOf(tid); if (!t) return;
  const others = members().filter(m => m.id !== S.meId);
  openSheet(`<h2>${esc(t.name)}</h2><div class="muted" style="margin-top:-8px">${esc(roomOf(t.room_id)?.name || '')} · ${t.minutes} Min · ${pts(t)} Punkte · ${MODES[t.mode || 'fair']}</div>
    <div class="lbl">Wer macht’s diesmal?</div>
    <div class="opts"><button class="opt" data-act="claim" data-tid="${t.id}" data-pid="${S.meId}" aria-pressed="${t.claimed_by === S.meId}">${av(S.meId, 1)}Ich mach’s</button>
      ${others.map(p => `<button class="opt" data-act="claim" data-tid="${t.id}" data-pid="${p.id}" aria-pressed="${t.claimed_by === p.id}">${av(p.id, 1)}${esc(p.name)} geben</button>`).join('')}
      ${t.claimed_by ? `<button class="opt" data-act="claim" data-tid="${t.id}" data-pid="">Automatisch verteilen</button>` : ''}</div>
    ${others.length ? `<div class="lbl">Schon erledigt?</div><div class="opts">${others.map(p => `<button class="opt" data-act="doneBy" data-tid="${t.id}" data-pid="${p.id}">${av(p.id, 1)}${esc(p.name)} hat’s gemacht</button>`).join('')}</div>` : ''}
    <div class="actions"><button class="btn sec" data-act="editTask" data-tid="${t.id}">Aufgabe bearbeiten</button><button class="btn sec" data-act="close">Schließen</button></div>`);
}

function taskForm(t, roomId) {
  const isNew = !t; t = t || { name: '', freq: 7, minutes: 10, points: null, mode: S.household.default_mode || 'fair', tip: '', room_id: roomId, person: null };
  const rooms = [...S.rooms].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const custom = !FREQS.some(f => f[0] === t.freq);
  const per = t.person && member(t.person) ? t.person : S.meId;
  return `<div class="field"><label for="tName">Aufgabe</label><input type="text" id="tName" value="${esc(t.name)}" maxlength="80" placeholder="z. B. Fenster putzen"></div>
    <div class="grid2"><div class="field"><label for="tRoom">Raum</label><select id="tRoom">${rooms.map(r => `<option value="${r.id}" ${r.id === t.room_id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="tFreq">Wie oft</label><select id="tFreq">${FREQS.map(([n, l]) => `<option value="${n}" ${n === t.freq ? 'selected' : ''}>${l}</option>`).join('')}<option value="custom" ${custom ? 'selected' : ''}>Eigener Rhythmus …</option></select></div></div>
    <div class="field" id="tCustomWrap" ${custom ? '' : 'hidden'}><label for="tCustom">Alle wie viele Tage?</label><input type="number" id="tCustom" min="1" max="365" value="${t.freq}"></div>
    <div class="grid2"><div class="field"><label for="tMin">Dauer (Minuten)</label><input type="number" id="tMin" min="1" max="600" value="${t.minutes}"></div>
      <div class="field"><label for="tPts">Punkte</label><input type="number" id="tPts" min="0" max="999" value="${t.points ?? ''}" placeholder="= Minuten"></div></div>
    <div class="field"><span class="lbl">Verteilung</span><div class="opts" id="tModes">${Object.entries(MODES).map(([k, l]) => `<button class="opt" data-act="pickMode" data-m="${k}" aria-pressed="${(t.mode || 'fair') === k}">${l}</button>`).join('')}</div>
      <div class="opts" id="tPersonWrap" ${t.mode === 'fixed' ? '' : 'hidden'}>${members().map(p => `<button class="opt" data-act="pickPerson" data-pid="${p.id}" aria-pressed="${per === p.id}">${av(p.id, 1)}${esc(p.name)}</button>`).join('')}</div>
      <div class="muted" style="font-size:13px" id="tModeHelp">${MODE_HELP[t.mode || 'fair']}</div></div>
    <div class="field"><label for="tTip">Putztipp</label><textarea id="tTip" maxlength="300" placeholder="Was hilft bei dieser Aufgabe?">${esc(t.tip)}</textarea></div>
    <div class="actions"><button class="btn" data-act="saveTask" data-tid="${isNew ? '' : t.id}">${isNew ? 'Aufgabe anlegen' : 'Speichern'}</button>${isNew ? '' : `<button class="btn danger" data-act="delTask" data-tid="${t.id}">Löschen</button>`}</div>`;
}

let suggestions = [];
function addTaskSheet() {
  const r = roomOf(S.roomId), type = TYPES[r.type] ? r.type : 'other';
  const have = new Set(S.tasks.filter(t => t.room_id === r.id).map(t => t.name.toLowerCase()));
  suggestions = [...TYPES[type].tasks, ...(type !== 'other' ? TYPES.other.tasks : [])].filter((x, i, arr) => !have.has(x[0].toLowerCase()) && arr.findIndex(y => y[0] === x[0]) === i);
  openSheet(`<h2>Aufgabe für ${esc(r.name)}</h2>
    ${suggestions.length ? `<div class="lbl">Vorschläge</div><div>${suggestions.map((s, i) => `<label class="sugg"><input type="checkbox" id="sg${i}" data-sug="${i}"><div><div class="tname">${esc(s[0])}</div><div class="tmeta"><span>${freqLabel(s[1])}</span><span class="num">${s[2]} Min</span></div></div></label>`).join('')}</div>
      <button class="btn" data-act="addSugg">Ausgewählte hinzufügen</button>` : ''}
    <div class="lbl" style="padding-top:8px">Oder eigene Aufgabe</div>${taskForm(null, r.id)}`);
}

function roomSheet(r) {
  const isNew = !r; r = r || { name: '', type: 'other' };
  openSheet(`<h2>${isNew ? 'Raum anlegen' : 'Raum bearbeiten'}</h2>
    <div class="field"><label for="rName">Name</label><input type="text" id="rName" value="${esc(r.name)}" maxlength="40" placeholder="z. B. Gästezimmer"></div>
    <div class="field"><span class="lbl">Art des Raums</span><div class="opts" id="rTypes">${Object.entries(TYPES).map(([k, v]) => `<button class="opt" data-act="pickType" data-t="${k}" aria-pressed="${r.type === k}">${svg(k)}${v.label}</button>`).join('')}</div></div>
    ${isNew ? `<label class="sugg"><input type="checkbox" id="rSugg" checked><div><div class="tname">Startaufgaben hinzufügen</div><div class="tmeta">Passende Vorschläge direkt anlegen</div></div></label>` : ''}
    <div class="actions"><button class="btn" data-act="saveRoom" data-rid="${isNew ? '' : r.id}">${isNew ? 'Anlegen' : 'Speichern'}</button>${isNew ? '' : `<button class="btn danger" data-act="delRoom" data-rid="${r.id}">Raum löschen</button>`}</div>`);
}

/* ---------- Actions ---------- */
function newTask(tpl, roomId, hid, mode, stagger) {
  const [name, freq, minutes, tip] = tpl;
  const row = { id: uuid(), household_id: hid, room_id: roomId, name, freq, minutes, points: null, mode: mode || 'fair', person: null, tip, last_done: null, last_by: null, claimed_by: null, created_at: iso(Date.now()) };
  if (stagger !== undefined) {
    // Fälligkeiten über den Rhythmus verteilen: tägliche Aufgaben heute, wöchentliche über die Woche usw.
    const offset = Math.floor(((stagger * 0.618) % 1) * Math.min(freq, 28));
    row.last_done = iso(sod(Date.now()) + offset * D + 12 * 3600000 - freq * D);
  }
  return row;
}

async function complete(tid, by, quiet) {
  by = by || S.meId;
  const t = taskOf(tid); if (!t || S.busy.has(tid)) return;
  S.busy.add(tid);
  if (!quiet) {
    document.querySelectorAll(`[data-act="done"][data-tid="${tid}"]`).forEach(b => { b.classList.add('on'); b.closest('.trow,.mini')?.classList.add('gone'); });
    await new Promise(r => setTimeout(r, 380));
  }
  const id = uuid(), at = Date.now(), p = pts(t);
  mutate([
    { k: 'upsert', table: 'completions', row: { id, household_id: HID(), task_id: t.id, task_name: t.name, room_id: t.room_id, done_by: by, done_at: iso(at), minutes: +t.minutes || 0, points: p, prev_last: t.last_done, prev_last_by: t.last_by } },
    { k: 'update', table: 'tasks', id: t.id, patch: { last_done: iso(at), last_by: by, claimed_by: null } }
  ]);
  S.busy.delete(tid);
  if (!quiet) toast(`Erledigt · +${p} Punkte für ${esc(nameOf(by))}`, id);
}

function undo(did) {
  const d = S.done.find(x => x.id === did); if (!d) return;
  const t = taskOf(d.task_id);
  const ops = [{ k: 'delete', table: 'completions', id: did }];
  if (t && t.last === d.at) ops.push({ k: 'update', table: 'tasks', id: t.id, patch: { last_done: d.prev_last ?? null, last_by: d.prev_last_by ?? null } });
  mutate(ops);
  document.getElementById('toast').innerHTML = '';
  toast('Rückgängig gemacht');
}

function readTaskForm() {
  const fv = document.getElementById('tFreq').value;
  const freq = fv === 'custom' ? clamp(parseInt(document.getElementById('tCustom').value) || 7, 1, 365) : +fv;
  const ptsV = document.getElementById('tPts').value;
  const mode = document.querySelector('#tModes [aria-pressed="true"]')?.dataset.m || 'fair';
  const person = mode === 'fixed' ? (document.querySelector('#tPersonWrap [aria-pressed="true"]')?.dataset.pid || S.meId) : null;
  return {
    name: document.getElementById('tName').value.trim(), room_id: document.getElementById('tRoom').value, freq,
    minutes: clamp(parseInt(document.getElementById('tMin').value) || 5, 1, 600), points: ptsV === '' ? null : clamp(parseInt(ptsV) || 0, 0, 999),
    mode, person, tip: document.getElementById('tTip').value.trim()
  };
}

const press = (group, el) => group.querySelectorAll('[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', b === el ? 'true' : 'false'));
function confirmStep(el, text) { if (el.dataset.confirm === '1') return true; el.dataset.confirm = '1'; el.textContent = text; return false; }

async function callFn(body) {
  if (DEMO) return null;
  try { const { data, error } = await sb.functions.invoke(FN, { body }); if (error) throw error; return data; }
  catch (e) { return { error: e.message || String(e) }; }
}

async function shareCode() {
  const code = S.household.invite_code;
  const text = `Komm an Bord bei Klar Schiff! Öffne ${APP_URL}, erstelle ein Konto und gib diesen Code ein: ${code}`;
  try { if (navigator.share) { await navigator.share({ title: 'Klar Schiff', text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Einladung kopiert'); } catch (e) { toast('Code: ' + esc(code)); }
}

function b64ToU8(b64) { const p = '='.repeat((4 - b64.length % 4) % 4); const s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); }
async function enablePush(btn) {
  btn.disabled = true; btn.textContent = 'Einen Moment …';
  const fail = msg => { toast(msg); render(); };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return fail('Benachrichtigungen sind nicht erlaubt. Du kannst sie in den iPhone-Einstellungen unter „Mitteilungen“ für Klar Schiff einschalten.');
    const keyRes = await callFn({ action: 'vapid' });
    if (!keyRes?.publicKey) return fail('Der Erinnerungs-Dienst antwortet nicht. Ist die Funktion in Supabase eingerichtet?');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(keyRes.publicKey) });
    const j = sub.toJSON();
    const { error } = await sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, member_id: S.meId, household_id: HID(), p256dh: j.keys.p256dh, auth: j.keys.auth, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin' });
    if (error) return fail('Speichern hat nicht geklappt: ' + esc(error.message));
    S.pushOn = true; render(); toast('Erinnerungen sind an');
  } catch (e) { fail('Das hat nicht geklappt: ' + esc(e.message || e)); }
}

async function checkPush() {
  if (DEMO || !pushCapable || Notification.permission !== 'granted') return;
  try { const reg = await navigator.serviceWorker.ready; S.pushOn = !!(await reg.pushManager.getSubscription()); render(true); } catch (e) {}
}

function updateBadge() {
  if (!navigator.setAppBadge || S.phase !== 'app') return;
  try { const n = vacation() ? 0 : plan(1)[0].filter(i => i.who === S.meId).length; (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch (e) {}
}

document.addEventListener('change', e => {
  if (e.target.id === 'tFreq') document.getElementById('tCustomWrap').hidden = e.target.value !== 'custom';
  if (e.target.id === 'remindHour') { const v = e.target.value; mutate({ k: 'update', table: 'members', id: S.meId, patch: { remind_hour: v === '' ? null : +v } }); toast(v === '' ? 'Morgen-Erinnerung aus' : `Erinnerung um ${v}:00 Uhr`); }
  if (e.target.id === 'jCode') e.target.value = e.target.value.toUpperCase();
});

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  if (a === 'scrim') { if (e.target === el) closeSheet(); return; }
  switch (a) {
    case 'go': S.view = el.dataset.v; window.scrollTo(0, 0); render(); break;
    case 'room': S.view = 'room'; S.roomId = el.dataset.rid; window.scrollTo(0, 0); render(); break;
    case 'filter': S.filter = el.dataset.f; render(); break;
    case 'range': S.range = +el.dataset.r; render(); break;
    case 'toggleDone': S.showDone = !S.showDone; render(); break;
    case 'tip': { const k = el.dataset.tid; S.openTips.has(k) ? S.openTips.delete(k) : S.openTips.add(k); render(); break; }
    case 'close': closeSheet(); break;
    case 'hideInstall': ls.set('ks-hide-install', 1); render(); break;
    case 'authMode': S.authMode = el.dataset.m; S.authErr = ''; S.authMsg = ''; render(); break;
    case 'done': await complete(el.dataset.tid); break;
    case 'doneBy': closeSheet(); await complete(el.dataset.tid, el.dataset.pid); break;
    case 'undo': undo(el.dataset.did); break;
    case 'assign': assignSheet(el.dataset.tid); break;
    case 'claim': {
      const pid = el.dataset.pid || null, tid = el.dataset.tid; closeSheet();
      mutate({ k: 'update', table: 'tasks', id: tid, patch: { claimed_by: pid } });
      if (pid && pid !== S.meId) { toast(`${esc(nameOf(pid))} bekommt die Aufgabe`); callFn({ action: 'handover', task_id: tid, to: pid }); }
      else toast(pid ? 'Du hast die Aufgabe übernommen' : 'Wird wieder automatisch verteilt');
      break;
    }
    case 'editTask': { const t = taskOf(el.dataset.tid); if (t) openSheet(`<h2>Aufgabe bearbeiten</h2>${taskForm(t)}`); break; }
    case 'addTask': addTaskSheet(); break;
    case 'pickMode': press(document.getElementById('tModes'), el); document.getElementById('tPersonWrap').hidden = el.dataset.m !== 'fixed'; document.getElementById('tModeHelp').textContent = MODE_HELP[el.dataset.m]; break;
    case 'pickPerson': press(document.getElementById('tPersonWrap'), el); break;
    case 'pickType': { press(document.getElementById('rTypes'), el); const n = document.getElementById('rName'); if (!n.value.trim()) n.value = TYPES[el.dataset.t].label; break; }
    case 'saveTask': {
      const v = readTaskForm(); if (!v.name) { document.getElementById('tName').focus(); return; }
      const id = el.dataset.tid;
      if (id) mutate({ k: 'update', table: 'tasks', id, patch: v });
      else mutate({ k: 'upsert', table: 'tasks', row: { id: uuid(), household_id: HID(), ...v, last_done: null, last_by: null, claimed_by: null, created_at: iso(Date.now()) } });
      closeSheet(); toast(id ? 'Gespeichert' : 'Aufgabe angelegt'); break;
    }
    case 'delTask': if (!confirmStep(el, 'Wirklich löschen?')) return; mutate({ k: 'delete', table: 'tasks', id: el.dataset.tid }); closeSheet(); toast('Aufgabe gelöscht'); break;
    case 'addSugg': {
      const picked = [...document.querySelectorAll('[data-sug]:checked')].map(x => suggestions[+x.dataset.sug]);
      if (!picked.length) return;
      mutate({ k: 'upsert', table: 'tasks', rows: picked.map(s => newTask(s, S.roomId, HID(), S.household.default_mode)) });
      closeSheet(); toast(`${picked.length} ${picked.length === 1 ? 'Aufgabe' : 'Aufgaben'} hinzugefügt`); break;
    }
    case 'roomAll': {
      if (!confirmStep(el, 'Alle Aufgaben abhaken?')) return;
      for (const t of S.tasks.filter(t => t.room_id === S.roomId)) await complete(t.id, null, true);
      toast('Raum komplett geputzt'); break;
    }
    case 'addRoom': roomSheet(); break;
    case 'editRoom': roomSheet(roomOf(S.roomId)); break;
    case 'saveRoom': {
      const name = document.getElementById('rName').value.trim(), type = document.querySelector('#rTypes [aria-pressed="true"]')?.dataset.t || 'other';
      if (!name) { document.getElementById('rName').focus(); return; }
      const rid = el.dataset.rid;
      if (rid) { mutate({ k: 'update', table: 'rooms', id: rid, patch: { name, type } }); closeSheet(); toast('Gespeichert'); return; }
      const id = uuid(), sort = Math.max(0, ...S.rooms.map(r => r.sort ?? 0)) + 1;
      const ops = [{ k: 'upsert', table: 'rooms', row: { id, household_id: HID(), name, type, sort } }];
      if (document.getElementById('rSugg')?.checked) ops.push({ k: 'upsert', table: 'tasks', rows: TYPES[type].tasks.filter(t => t[4]).map(t => newTask(t, id, HID(), S.household.default_mode)) });
      mutate(ops); closeSheet(); S.view = 'room'; S.roomId = id; render(); toast('Raum angelegt'); break;
    }
    case 'delRoom': if (!confirmStep(el, 'Raum und Aufgaben löschen?')) return; mutate({ k: 'delete', table: 'rooms', id: el.dataset.rid }); closeSheet(); S.view = 'rooms'; render(); toast('Raum gelöscht'); break;
    case 'saveName': { const n = document.getElementById('myName').value.trim(); if (!n) return; mutate({ k: 'update', table: 'members', id: S.meId, patch: { name: n } }); toast('Name gespeichert'); break; }
    case 'demoMe': S.meId = el.dataset.pid; saveCache(); render(); break;
    case 'defMode': mutate({ k: 'update', table: 'households', id: HID(), patch: { default_mode: el.dataset.m } }); break;
    case 'applyMode': { if (!confirmStep(el, `Alle auf „${MODES[S.household.default_mode || 'fair']}“ setzen?`)) return; mutate({ k: 'updateAll', table: 'tasks', patch: { mode: S.household.default_mode || 'fair', person: null } }); toast('Verteilung angepasst'); break; }
    case 'notifyHandover': { const me = member(S.meId); mutate({ k: 'update', table: 'members', id: S.meId, patch: { notify_handover: me.notify_handover === false } }); break; }
    case 'vacation':
      if (!vacation()) { mutate({ k: 'update', table: 'households', id: HID(), patch: { vacation_since: iso(Date.now()) } }); toast('Urlaubsmodus an. Schöne Zeit!'); }
      else { mutate({ k: 'rpc', fn: 'end_vacation' }); toast('Willkommen zurück!'); }
      break;
    case 'enablePush': await enablePush(el); break;
    case 'testPush': { el.disabled = true; const r = await callFn({ action: 'test' }); el.disabled = false; toast(r?.sent ? 'Test verschickt. Er sollte gleich ankommen.' : 'Test hat nicht geklappt' + (r?.error ? ': ' + esc(r.error) : '')); break; }
    case 'shareCode': await shareCode(); break;
    case 'logout': if (!confirmStep(el, 'Wirklich abmelden?')) return; await sb.auth.signOut(); ls.del('ks-cache'); ls.del('ks-outbox'); outbox = []; location.reload(); break;
    case 'resetDemo': if (!confirmStep(el, 'Alle Demo-Daten löschen?')) return; ls.del('ks-demo'); location.reload(); break;
    case 'obTab': S.onboardTab = el.dataset.t; S.onboardErr = ''; render(); break;
    case 'setupMode': press(document.getElementById('setupMode'), el); document.getElementById('setupModeHelp').textContent = MODE_HELP[el.dataset.m]; break;
    case 'create': await createHousehold(el); break;
    case 'join': await joinHousehold(el); break;
  }
});

async function createHousehold(btn) {
  const name = document.getElementById('obName').value.trim();
  if (!name) { S.onboardErr = 'Bitte gib deinen Namen ein.'; render(); document.getElementById('obName').focus(); return; }
  const mode = document.querySelector('#setupMode [aria-pressed="true"]')?.dataset.m || 'fair';
  const picked = USER_ROOMS.filter((_, i) => document.getElementById('sr' + i).checked);
  btn.disabled = true; btn.textContent = 'Wird angelegt …'; S.onboardErr = '';
  const build = hid => {
    const rooms = [], tasks = []; let i = 0;
    picked.forEach(([rname, type]) => {
      const rid = uuid(); rooms.push({ id: rid, household_id: hid, name: rname, type, sort: USER_ROOMS.findIndex(x => x[1] === type) });
      TYPES[type].tasks.filter(t => t[4]).forEach(t => tasks.push(newTask(t, rid, hid, mode, i++)));
    });
    return { rooms, tasks };
  };
  if (DEMO) {
    const hid = uuid(), partner = document.getElementById('obPartner').value.trim() || 'Anna';
    const m1 = { id: uuid(), household_id: hid, name, color: 'sky', remind_hour: 8, notify_handover: true }, m2 = { id: uuid(), household_id: hid, name: partner, color: 'rose', remind_hour: 8, notify_handover: true };
    const { rooms, tasks } = build(hid);
    Object.assign(S, { household: { id: hid, invite_code: 'DEMO', default_mode: mode, vacation_since: null }, members: [m1, m2], rooms, tasks: tasks.map(normTask), done: [], meId: m1.id, phase: 'app' });
    saveCache(); render(); return;
  }
  const { data: hid, error } = await sb.rpc('create_household', { p_name: name, p_mode: mode });
  if (error) { S.onboardErr = /already_member/.test(error.message) ? 'Du gehörst schon zu einem Haushalt.' : 'Das hat nicht geklappt: ' + error.message; btn.disabled = false; btn.textContent = 'Haushalt anlegen'; render(); if (/already_member/.test(error.message)) refetch(); return; }
  const { rooms, tasks } = build(hid);
  const r1 = rooms.length ? await sb.from('rooms').insert(rooms) : {};
  const r2 = tasks.length && !r1.error ? await sb.from('tasks').insert(tasks) : {};
  if (r1.error || r2.error) toast('Die Startaufgaben konnten nicht alle angelegt werden. Du kannst sie in den Räumen ergänzen.');
  await refetch();
}

async function joinHousehold(btn) {
  const code = document.getElementById('jCode').value.trim().toUpperCase(), name = document.getElementById('jName').value.trim();
  if (code.length !== 6) { S.onboardErr = 'Der Code hat 6 Zeichen.'; render(); return; }
  if (!name) { S.onboardErr = 'Bitte gib deinen Namen ein.'; render(); return; }
  btn.disabled = true; btn.textContent = 'Einen Moment …'; S.onboardErr = '';
  const { error } = await sb.rpc('join_household', { p_code: code, p_name: name });
  if (error) {
    const m = error.message || '';
    S.onboardErr = /invalid_code/.test(m) ? 'Diesen Code gibt es nicht. Prüfe ihn noch einmal in den Einstellungen deines Partners.'
      : /household_full/.test(m) ? 'Dieser Haushalt ist schon voll (höchstens vier Personen).'
      : /already_member/.test(m) ? 'Du gehörst schon zu einem Haushalt.' : 'Das hat nicht geklappt: ' + m;
    btn.disabled = false; btn.textContent = 'Beitreten'; render(); return;
  }
  await refetch();
}

/* ---------- Start ---------- */
(async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (DEMO) {
    if (loadCache()) S.phase = 'app'; else S.phase = 'onboard';
    render(); return;
  }
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { S.phase = 'auth'; S.authMode = 'newpw'; S.authErr = ''; S.authMsg = ''; render(); }
    else if (event === 'SIGNED_OUT') { S.phase = 'auth'; render(); }
  });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { S.phase = 'auth'; render(); return; }
  S.uid = session.user.id; S.email = session.user.email || '';
  if (loadCache(S.uid)) { outbox.forEach(applyLocal); S.phase = 'app'; render(); }
  await refetch();
  if (S.phase === 'loading') { S.phase = 'auth'; S.authErr = 'Keine Verbindung. Prüfe dein Internet.'; render(); }
  flush(); checkPush();
  window.addEventListener('online', () => { S.online = true; flush(); refetch(); });
  window.addEventListener('offline', () => { S.online = false; updateSync(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { flush(); refetch(); } });
  setInterval(() => { if (!document.querySelector('.scrim')) render(true); }, 60000);
})();
