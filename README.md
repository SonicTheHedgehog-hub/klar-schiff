# Klar Schiff

Euer gemeinsamer Putz- und Haushaltsplan als Web-App für den Home-Bildschirm.
Räume, Aufgaben mit Rhythmus und Dauer, faire Verteilung nach Punkten, Wochenplan, Statistik,
Putztipps, Urlaubsmodus, Offline-Nutzung und Push-Erinnerungen.

## Aufbau

| Teil | Wo | Was |
|---|---|---|
| App | dieses Repository, gehostet über GitHub Pages | `index.html`, `app.js`, `styles.css`, `sw.js` (offline + Push) |
| Verteilungslogik | `plan.js` | wird von App **und** Server benutzt |
| Datenbank | Supabase (`supabase/schema.sql`) | Tabellen, Zugriffsregeln, Beitritt per Code, Live-Abgleich |
| Erinnerungen | Supabase Edge Function `klar-schiff-push` | Web Push; alle 15 Min. per `pg_cron` angestoßen |

Verbindung zur Datenbank steht in `config.js`. Der Schlüssel dort ist öffentlich gedacht;
die Daten schützen die Zugriffsregeln (Row Level Security): Jede Person sieht nur ihren eigenen Haushalt.

## Einrichtung (einmalig)

1. **Supabase**: Schema (`supabase/schema.sql`), Edge Function und Zeitplan (`supabase/cron.sql`) sind eingespielt.
2. **GitHub Pages**: Repository → *Settings* → *Pages* → *Source: Deploy from a branch* → Branch `main`, Ordner `/ (root)` → *Save*.
   Nach ca. 1 Minute läuft die App unter `https://<benutzername>.github.io/klar-schiff/`.
3. **Supabase-Login-Links**: Supabase → *Authentication* → *URL Configuration* →
   *Site URL* auf die GitHub-Pages-Adresse setzen und dieselbe Adresse unter *Redirect URLs* eintragen.
   Sonst führen Bestätigungs- und Passwort-Links ins Leere.

## Auf dem iPhone installieren

1. Adresse in **Safari** öffnen → Teilen-Symbol → **Zum Home-Bildschirm**.
2. Klar Schiff vom Home-Bildschirm starten, Konto erstellen, E-Mail bestätigen, anmelden.
3. Person 1 legt den Haushalt an. Person 2 wählt **Mit Code beitreten** und gibt den Code aus
   *Einstellungen → Haushalt* ein.
4. *Einstellungen → Erinnerungen → Aktivieren*. Funktioniert ab iOS 16.4, nur aus der Home-Bildschirm-App.

## Änderungen

- An der Verteilung (`plan.js`) etwas geändert? `node scripts/build-function.mjs` ausführen und die Edge Function neu deployen.
- Ohne Werte in `config.js` startet die App im Demo-Modus nur auf dem Gerät.
- Nach einer Änderung an App-Dateien die Versionsnummer `CACHE` in `sw.js` erhöhen.
