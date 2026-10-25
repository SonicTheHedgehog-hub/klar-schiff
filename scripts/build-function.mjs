// Kopiert plan.js in die Edge Function, damit App und Server dieselbe Verteilung rechnen.
// Nach jeder Änderung an plan.js ausführen: node scripts/build-function.mjs
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.copyFileSync(path.join(root, 'plan.js'), path.join(root, 'supabase/functions/klar-schiff-push/plan.js'));
console.log('plan.js kopiert');
