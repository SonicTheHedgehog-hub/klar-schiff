// Klar Schiff – Erinnerungen per Web Push.
// Aktionen (POST, JSON): vapid | test | handover | cron
// Wird mit verify_jwt = false betrieben; prüft angemeldete Personen selbst.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

import { D, planDays } from "./plan.js";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

let vapidReady: string | null = null;
async function vapid(): Promise<string> {
  if (vapidReady) return vapidReady;
  let { data } = await sb.from("push_config").select("*").eq("id", 1).maybeSingle();
  if (!data) {
    const k = webpush.generateVAPIDKeys();
    await sb.from("push_config").upsert({ id: 1, public_key: k.publicKey, private_key: k.privateKey }, { onConflict: "id", ignoreDuplicates: true });
    ({ data } = await sb.from("push_config").select("*").eq("id", 1).single());
  }
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:klar-schiff@users.noreply.github.com", data!.public_key, data!.private_key);
  vapidReady = data!.public_key;
  return vapidReady!;
}

type Sub = { endpoint: string; p256dh: string; auth: string; member_id: string; tz: string; last_reminded: string | null };

async function send(subs: Sub[], payload: Record<string, unknown>) {
  await vapid();
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "normal" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      else console.error("push failed", code, (e as Error).message);
    }
  }
  return sent;
}

async function caller(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || token.startsWith("sb_")) return null;
  const { data } = await sb.auth.getUser(token);
  if (!data?.user) return null;
  const { data: m } = await sb.from("members").select("*").eq("user_id", data.user.id).maybeSingle();
  return m;
}

async function loadHousehold(hid: string) {
  const since = new Date(Date.now() - 9 * D).toISOString();
  const [h, m, r, t, c] = await Promise.all([
    sb.from("households").select("*").eq("id", hid).single(),
    sb.from("members").select("*").eq("household_id", hid).order("created_at"),
    sb.from("rooms").select("id,sort").eq("household_id", hid),
    sb.from("tasks").select("*").eq("household_id", hid),
    sb.from("completions").select("done_by,done_at,points").eq("household_id", hid).gte("done_at", since),
  ]);
  const roomOrder: Record<string, number> = {};
  (r.data || []).forEach((x: { id: string; sort: number }) => (roomOrder[x.id] = x.sort));
  return {
    household: h.data,
    members: m.data || [],
    roomOrder,
    tasks: (t.data || []).map((x: Record<string, unknown>) => ({ ...x, last: x.last_done ? Date.parse(x.last_done as string) : null, created: Date.parse(x.created_at as string) })),
    completions: (c.data || []).map((x: Record<string, unknown>) => ({ by: x.done_by, at: Date.parse(x.done_at as string), points: x.points })),
  };
}

function localParts(tz: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const g = (k: string) => p.find((x) => x.type === k)!.value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: +g("hour") };
}

async function cron() {
  const { data: subs } = await sb.from("push_subscriptions").select("*, members!inner(id, household_id, remind_hour, name)");
  const due = (subs || []).filter((s: Sub & { members: { remind_hour: number | null } }) => {
    const rh = s.members.remind_hour;
    if (rh === null || rh === undefined) return false;
    const { date, hour } = localParts(s.tz || "Europe/Berlin");
    return hour >= rh && hour < rh + 3 && s.last_reminded !== date;
  });
  const byHousehold = new Map<string, typeof due>();
  due.forEach((s: { household_id: string }) => byHousehold.set(s.household_id, [...(byHousehold.get(s.household_id) || []), s]));
  let sent = 0;
  for (const [hid, list] of byHousehold) {
    const H = await loadHousehold(hid);
    if (!H.household) continue;
    for (const s of list) {
      const tz = s.tz || "Europe/Berlin";
      const { date } = localParts(tz);
      await sb.from("push_subscriptions").update({ last_reminded: date }).eq("endpoint", s.endpoint);
      if (H.household.vacation_since) continue;
      const today = planDays({ tasks: H.tasks, members: H.members, completions: H.completions, roomOrder: H.roomOrder, days: 1, tz })[0];
      const mine = today.filter((i: { who: string | null }) => i.who === s.member_id);
      const open = today.filter((i: { who: string | null }) => !i.who);
      if (!mine.length && !open.length) continue;
      const min = mine.reduce((a: number, i: { t: { minutes: number } }) => a + (+i.t.minutes || 0), 0);
      const names = mine.slice(0, 3).map((i: { t: { name: string } }) => i.t.name).join(", ") + (mine.length > 3 ? " …" : "");
      const body = mine.length
        ? `${mine.length} ${mine.length === 1 ? "Aufgabe" : "Aufgaben"} · ca. ${min} Min: ${names}${open.length ? ` (+${open.length} zum Aussuchen)` : ""}`
        : `${open.length} ${open.length === 1 ? "Aufgabe wartet" : "Aufgaben warten"} darauf, dass sich jemand sie schnappt.`;
      sent += await send([s], { title: "Heute bei Klar Schiff", body, tag: "daily", badge: mine.length });
    }
  }
  return { checked: (subs || []).length, sent, ready: await readyAlerts() };
}

// Folgeaufgaben mit Wartezeit (z. B. Wäsche aufhängen 2 Std. nach dem Waschen): Bescheid geben, sobald es so weit ist.
async function readyAlerts() {
  const { data: deps } = await sb.from("tasks").select("id, name, household_id, after_task, after_delay_min, last_done, ready_notified_at, mode, person, claimed_by")
    .not("after_task", "is", null).gte("after_delay_min", 30);
  if (!deps?.length) return 0;
  const { data: preds } = await sb.from("tasks").select("id, name, last_done, last_by").in("id", [...new Set(deps.map((d) => d.after_task))]);
  const byId = new Map((preds || []).map((p) => [p.id, p]));
  const now = Date.now();
  let sent = 0;
  for (const t of deps) {
    const p = byId.get(t.after_task);
    if (!p?.last_done) continue;
    const predAt = Date.parse(p.last_done), ownAt = t.last_done ? Date.parse(t.last_done) : 0;
    if (predAt <= ownAt) continue;                                   // noch nicht ausgelöst
    const readyAt = predAt + t.after_delay_min * 60000;
    if (readyAt > now || readyAt < now - 6 * 3600000) continue;      // noch nicht so weit oder zu lange her
    if (t.ready_notified_at && Date.parse(t.ready_notified_at) >= readyAt) continue;
    await sb.from("tasks").update({ ready_notified_at: new Date().toISOString() }).eq("id", t.id);
    const who = t.claimed_by || (t.mode === "fixed" ? t.person : t.mode === "open" ? null : p.last_by);
    let q = sb.from("push_subscriptions").select("*").eq("household_id", t.household_id);
    if (who) q = q.eq("member_id", who);
    const { data: subs } = await q;
    sent += await send(subs || [], { title: `Jetzt dran: ${t.name}`, body: `„${p.name}“ ist fertig.`, tag: "ready-" + t.id });
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let body: Record<string, string> = {};
  try { body = await req.json(); } catch (_) { /* leer */ }
  try {
    switch (body.action) {
      case "vapid":
        return json({ publicKey: await vapid() });
      case "cron":
        return json(await cron());
      case "test": {
        const me = await caller(req);
        if (!me) return json({ error: "not_signed_in" }, 401);
        const { data: subs } = await sb.from("push_subscriptions").select("*").eq("member_id", me.id);
        const sent = await send(subs || [], { title: "Klar Schiff", body: `Hallo ${me.name}, Erinnerungen funktionieren!`, tag: "test" });
        return json({ sent });
      }
      case "handover": {
        const me = await caller(req);
        if (!me) return json({ error: "not_signed_in" }, 401);
        const { data: task } = await sb.from("tasks").select("name, household_id, claimed_by").eq("id", body.task_id).maybeSingle();
        const { data: to } = await sb.from("members").select("id, household_id, notify_handover").eq("id", body.to).maybeSingle();
        if (!task || !to || task.household_id !== me.household_id || to.household_id !== me.household_id || to.id === me.id) return json({ error: "not_allowed" }, 403);
        if (!to.notify_handover) return json({ sent: 0 });
        const { data: subs } = await sb.from("push_subscriptions").select("*").eq("member_id", to.id);
        const sent = await send(subs || [], { title: "Neue Aufgabe für dich", body: `${me.name} hat dir „${task.name}“ gegeben.`, tag: "handover-" + body.task_id });
        return json({ sent });
      }
      default:
        return json({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
