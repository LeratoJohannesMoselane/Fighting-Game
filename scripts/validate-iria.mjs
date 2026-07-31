/**
 * Validates Iria Sol content JSON shape (zero deps).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fighter = JSON.parse(
  readFileSync(join(root, 'packages/content/fighters/iria_sol.json'), 'utf8'),
);
const bots = JSON.parse(
  readFileSync(join(root, 'packages/content/bots/iria_sol_bots.json'), 'utf8'),
);

const errors = [];

function req(obj, path, pred) {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || !(p in cur)) {
      errors.push(`missing ${path}`);
      return;
    }
    cur = cur[p];
  }
  if (pred && !pred(cur)) errors.push(`invalid ${path}`);
}

req(fighter, 'fighterId', (v) => v === 'iria_sol');
req(fighter, 'version');
req(fighter, 'base.hp', (v) => v === 920);
req(fighter, 'base.walk', (v) => typeof v === 'number');
req(fighter, 'resources.prismCharges.max', (v) => v === 3);
req(fighter, 'normals', (v) => Array.isArray(v) && v.length >= 3);
req(fighter, 'specials', (v) => Array.isArray(v) && v.length === 2);
req(fighter, 'ranged.id');
req(fighter, 'ultimate.meterCost', (v) => v === 100);
req(fighter, 'ultimate.cameraLock', (v) => typeof v === 'number' && v <= 20);
req(fighter, 'ultimate.onHit.damage', (v) => v >= 250 && v <= 320);
req(fighter, 'moves', (v) => Array.isArray(v) && v.length >= 4);
req(fighter, 'animations.idle');
req(fighter, 'audio.voiceLines.ultimate');
req(fighter, 'vfx.ultimate');

// Every normal has frame data
for (const n of fighter.normals) {
  if (n.startup < 4) errors.push(`${n.id} startup < 4`);
  if (!n.onHit || n.onHit.damage <= 0) errors.push(`${n.id} bad onHit`);
  if (!Array.isArray(n.cancelTo)) errors.push(`${n.id} cancelTo`);
}

// Ultimate damage cap
if (fighter.ultimate.onHit.maxDamage > 320) errors.push('ult maxDamage > 320');

// Bots
for (const k of ['easy', 'normal', 'hard']) {
  if (!bots.botProfiles[k]) errors.push(`missing bot ${k}`);
}

// Cancel targets exist in move ids
const ids = new Set([
  ...fighter.normals.map((m) => m.id),
  ...fighter.specials.map((m) => m.id),
  fighter.ranged.id,
  fighter.ultimate.id,
]);
for (const n of fighter.normals) {
  for (const c of n.cancelTo) {
    if (!ids.has(c)) errors.push(`cancelTo unknown: ${n.id} -> ${c}`);
  }
}

if (errors.length) {
  console.error('VALIDATION FAILED:');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}

console.log('iria_sol content validation OK');
console.log(
  JSON.stringify(
    {
      fighterId: fighter.fighterId,
      normals: fighter.normals.length,
      specials: fighter.specials.length,
      ultDamage: fighter.ultimate.onHit.damage,
      cameraLock: fighter.ultimate.cameraLock,
      bots: Object.keys(bots.botProfiles),
    },
    null,
    2,
  ),
);
