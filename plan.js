// Klar Schiff – Planungslogik. Wird von der App und vom Erinnerungs-Server gemeinsam genutzt.
// Zeiten sind Millisekunden. Eine Aufgabe: { id, room_id, name, freq, minutes, points, mode, person,
// last (ms|null), last_by, claimed_by, created (ms), after_task, after_delay_min, one_off }.
// Ein Mitglied: { id, name, ... } in fester Reihenfolge.

export const D = 86400000;
export const MIN = 60000;

function tzOffsetMin(ms, tz) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(ms));
  const g = k => +p.find(x => x.type === k).value;
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(ms / 1000) * 1000) / 60000;
}

/** Beginn des Kalendertags (lokal bzw. in Zeitzone tz). */
export function startOfDay(ms, tz) {
  if (!tz) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  const off = tzOffsetMin(ms, tz);
  const localMidnight = Math.floor((ms + off * 60000) / D) * D;
  const guess = localMidnight - off * 60000;
  return localMidnight - tzOffsetMin(guess, tz) * 60000;
}

/** Ganze Kalendertage zwischen zwei Tagesanfängen (robust bei Sommer-/Winterzeit). */
export const dayDiff = (a, b) => Math.round((a - b) / D);

export const pts = t => (t.points !== null && t.points !== undefined && t.points !== '') ? +t.points : (+t.minutes || 0);

/**
 * Folgeaufgaben: Eine Aufgabe mit after_task wird erst fällig, wenn ihr Vorgänger erledigt wurde
 * (nach ihrem eigenen letzten Erledigen), plus after_delay_min Minuten Wartezeit.
 * Setzt t.chain = null | { pred, triggered, readyAt, waiting, locked }.
 */
export function annotate(tasks, now = Date.now()) {
  const byId = {};
  tasks.forEach(t => byId[t.id] = t);
  for (const t of tasks) {
    const pred = t.after_task ? byId[t.after_task] : null;
    if (!pred) { t.chain = null; continue; }
    const triggered = !!pred.last && (!t.last || pred.last > t.last);
    const readyAt = triggered ? pred.last + (+t.after_delay_min || 0) * MIN : null;
    t.chain = { pred, triggered, readyAt, waiting: triggered && readyAt > now, locked: !triggered };
  }
  return byId;
}

/** Erledigte einmalige Aufgaben tauchen nirgends mehr auf. */
export const isHidden = t => !!(t.one_off && t.last);

export function dueAt(t, tz) {
  if (t.chain) return t.chain.triggered ? t.chain.readyAt : Infinity;
  if (t.one_off) return t.last ? Infinity : startOfDay(t.created || Date.now(), tz);
  return t.last ? t.last + (t.freq || 7) * D : startOfDay(t.created || Date.now(), tz);
}

export function cleanOf(t, now) {
  if (t.chain) return (t.chain.triggered && !t.chain.waiting) ? Math.max(0, Math.min(1, 1 - (now - t.chain.readyAt) / D)) : 1;
  if (t.one_off) return t.last ? 1 : 0.5;
  return t.last ? Math.max(0, Math.min(1, 1 - (now - t.last) / ((t.freq || 7) * D))) : 0;
}

export function recentPoints(members, completions, now, days, tz) {
  const since = startOfDay(now, tz) - (days - 1) * D;
  const o = {};
  members.forEach(m => o[m.id] = 0);
  completions.forEach(c => { if (c.at >= since && o[c.by] !== undefined) o[c.by] += c.points || 0; });
  return o;
}

/**
 * Plant die nächsten `days` Tage. Liefert je Tag eine Liste von
 * { t, d, k, overdue, waiting, who, fair }. who = Mitglieds-ID oder null (offen zum Aussuchen).
 * Folgeaufgaben und einmalige Aufgaben erscheinen nur einmal; Folgeaufgaben gehen (außer bei fest/offen/übernommen)
 * an die Person, die den Vorgänger erledigt hat.
 */
export function planDays({ tasks, members, completions, roomOrder = {}, vacation = false, now = Date.now(), days = 7, tz }) {
  const out = Array.from({ length: days }, () => []);
  if (vacation || !members.length) return out;
  annotate(tasks, now);
  const today0 = startOfDay(now, tz);
  const ids = members.map(m => m.id);
  const valid = id => ids.includes(id);
  for (const t of tasks) {
    if (isHidden(t)) continue;
    const due = dueAt(t, tz);
    if (!isFinite(due)) continue;
    const once = !!(t.chain || t.one_off);
    const f = Math.max(1, t.freq || 7);
    let d = Math.max(0, dayDiff(startOfDay(due, tz), today0)), k = 0;
    while (d < days) {
      out[d].push({ t, d, k, overdue: k === 0 && due < today0, waiting: k === 0 && !!t.chain?.waiting });
      if (once) break;
      d += f; k++;
    }
  }
  const load = recentPoints(members, completions, now, 7, tz);
  out.forEach((items, day) => {
    const fair = [];
    for (const it of items) {
      const t = it.t;
      if (it.k === 0 && t.claimed_by && valid(t.claimed_by)) it.who = t.claimed_by;
      else if (t.mode === 'fixed') it.who = valid(t.person) ? t.person : ids[0];
      else if (t.mode === 'open') it.who = null;
      else if (t.chain && valid(t.chain.pred.last_by)) it.who = t.chain.pred.last_by;
      else if (t.mode === 'rotate') {
        const start = valid(t.last_by) ? (ids.indexOf(t.last_by) + 1) % ids.length : 0;
        it.who = ids[(start + it.k) % ids.length];
      }
      else { fair.push(it); continue; }
      if (it.who) load[it.who] = (load[it.who] || 0) + pts(t);
    }
    fair.sort((a, b) => pts(b.t) - pts(a.t) || a.t.name.localeCompare(b.t.name));
    for (const it of fair) {
      const order = (day % 2) ? [...ids].reverse() : ids;
      let best = order[0];
      for (const id of order) if ((load[id] || 0) < (load[best] || 0)) best = id;
      it.who = best; it.fair = true; load[best] += pts(it.t);
    }
    items.sort((a, b) => (a.waiting - b.waiting) || (b.overdue - a.overdue) || ((roomOrder[a.t.room_id] ?? 0) - (roomOrder[b.t.room_id] ?? 0)) || a.t.name.localeCompare(b.t.name));
  });
  return out;
}
