import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==================================================================
//  Couche de persistance (double backend)
//  - DATABASE_URL défini -> PostgreSQL (production, durable).
//  - Sinon               -> fichier JSON (dev / tests).
//  L'interface est identique (getDb / save / insert / find / …).
//
//  MODÈLE (v2 — zéro argent stocké sur l'app) :
//   - users        : clients + gérants (login par téléphone)
//   - gerants      : contacts "gérants" ajoutés par un client
//   - demandes     : demandes de services (unités/minutes/internet)
//   - Aucune notion de solde / caisse.
// ==================================================================

const DATA_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');
const DATABASE_URL = process.env.DATABASE_URL || '';
const COLLECTIONS = ['users', 'gerants', 'demandes', 'notifications'];

const now = Date.now();
const in30 = () => now + 30 * 24 * 3600 * 1000;

const seed = () => ({
  users: [
    // --- Client de démo (pour tester côté client ; compte réel sans gérant inscrit) ---
    { id: 'u_client', role: 'client', name: 'Jean Dupont', phone: '0101010101', email: 'jean@example.com', passwordHash: '$2b$10$V3Ed.oiA.jq72LkYfH7z2.xU8v3P1k/uXYeFKrazPJBotSmf.kbrO', waveNumber: '0101010101', subscription: { status: 'trial', trialEndsAt: in30(), subscribedUntil: 0 }, createdAt: now },
    // --- Aucun gérant de démo : seuls les gérants RÉELLEMENT inscrits apparaissent. ---
  ],

  // Aucun contact ni demande de démo : l'app démarre propre. Les gérants
  // inscrits et les contacts ajoutés par les clients seront créés en usage réel.
  gerants: [],
  demandes: [],
  notifications: [],
});

// S'assure que toutes les collections existent (utile pour une base Postgres
// déjà initialisée avant l'ajout d'une nouvelle collection).
function normalize(dbData) {
  for (const c of COLLECTIONS) {
    if (!Array.isArray(dbData[c])) dbData[c] = [];
  }
  return dbData;
}

// Identifiants des gérants de démo (faux comptes) à ne jamais afficher.
const FAKE_GERANT_IDS = ['u_amadou', 'u_fatou', 'u_moussa', 'u_marie'];

// Purge les profils « gérant » qui ne correspondent pas à de vrais inscrits :
//  - les comptes de démo (FAKE_GERANT_IDS),
//  - les comptes créés à la volée sans mot de passe (fantômes).
// On retire aussi leurs contacts et leurs demandes associées pour éviter
// toute incohérence. Idempotent : ne touche pas aux gérants réellement inscrits.
function cleanupFakeGerants(dbData) {
  if (!Array.isArray(dbData.users)) return dbData;
  const removable = new Set(
    dbData.users
      .filter((u) => u.role === 'gerant' && (FAKE_GERANT_IDS.includes(u.id) || !u.passwordHash))
      .map((u) => u.id),
  );
  if (removable.size === 0) return dbData;

  dbData.users = dbData.users.filter((u) => !(u.role === 'gerant' && removable.has(u.id)));
  dbData.gerants = (dbData.gerants || []).filter((g) => !removable.has(g.userId));
  dbData.demandes = (dbData.demandes || []).filter((d) => !removable.has(d.gerantUserId));
  dbData.notifications = (dbData.notifications || []).filter((n) => !removable.has(n.userId));
  return dbData;
}

// Purge COMPLÈTE et UNE SEULE FOIS de tous les gérants (comptes de test / démo
// accumulés avant la mise en production réelle). Un marqueur est écrit en base
// pour ne pas re-purger ensuite : seuls les gérants RÉELLEMENT inscrits
// apparaîtront, et les futurs inscrits sont conservés.
function resetStaleGerants(dbData) {
  if (dbData.__gerantResetDone) return dbData;
  const gids = new Set((dbData.users || []).filter((u) => u.role === 'gerant').map((u) => u.id));
  if (gids.size) {
    dbData.users = (dbData.users || []).filter((u) => u.role !== 'gerant');
    dbData.gerants = (dbData.gerants || []).filter((g) => !gids.has(g.userId));
    dbData.demandes = (dbData.demandes || []).filter((d) => !gids.has(d.gerantUserId));
    dbData.notifications = (dbData.notifications || []).filter((n) => !gids.has(n.userId));
  }
  dbData.__gerantResetDone = true;
  return dbData;
}

// ------------------------- JSON (dev) -------------------------
function loadFile() {
  if (fs.existsSync(DATA_FILE)) {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { /* reseed */ }
  }
  return seed();
}
function writeFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// ------------------------- PostgreSQL (production) -------------------------
async function ensureSchema(p) {
  await p.query(`CREATE TABLE IF NOT EXISTS app_state (key text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
}
async function loadFromPg(p) {
  const { rows } = await p.query('SELECT data FROM app_state WHERE key = $1', ['app']);
  return rows.length ? rows[0].data : null;
}
async function persistToPg(p) {
  await pool.query(
    `INSERT INTO app_state (key, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    ['app', JSON.stringify(db)],
  );
}

// ------------------------- Initialisation -------------------------
export async function initDb() {
  if (db) return db;
  if (DATABASE_URL) {
    try {
      pool = new Pool({ connectionString: DATABASE_URL, ssl: DATABASE_URL.includes('render') ? { rejectUnauthorized: false } : undefined });
      await ensureSchema(pool);
      const loaded = await loadFromPg(pool);
      db = loaded && loaded.users ? resetStaleGerants(cleanupFakeGerants(normalize(loaded))) : seed();
      usingPg = true;
      await persistToPg(pool);
      console.log(`[db] PostgreSQL connecté`);
      return db;
    } catch (e) {
      console.error('[db] PostgreSQL indisponible, repli JSON :', e.message);
      pool = null;
    }
  }
  db = resetStaleGerants(cleanupFakeGerants(normalize(loadFile())));
  writeFile();
  return db;
}

let db = null;
let pool = null;
let usingPg = false;

function persist() {
  if (usingPg && pool) persistToPg(pool).catch((e) => console.error('[db] persist PostgreSQL :', e.message));
  else writeFile();
}

export function getDb() {
  if (!db) throw new Error('Base non initialisée : appelez initDb() au démarrage');
  return db;
}
export function save() { persist(); }

// ------------------------- Helpers (interface inchangée) -------------------------
export function insert(collection, item) {
  const d = getDb();
  const record = { id: nanoid(12), ...item };
  d[collection].push(record);
  save();
  return record;
}
export function find(collection, pred) { return getDb()[collection].filter(pred); }
export function findOne(collection, pred) { return getDb()[collection].find(pred) || null; }
export function update(collection, pred, patch) {
  const d = getDb();
  let updated = null;
  d[collection] = d[collection].map((r) => { if (pred(r)) { updated = { ...r, ...patch }; return updated; } return r; });
  save();
  return updated;
}
export function remove(collection, pred) {
  const d = getDb();
  d[collection] = d[collection].filter((r) => !pred(r));
  save();
  return d[collection];
}
