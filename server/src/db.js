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
const COLLECTIONS = ['users', 'gerants', 'demandes'];

const now = Date.now();
const in30 = () => now + 30 * 24 * 3600 * 1000;

const seed = () => ({
  users: [
    // --- Clients de démo ---
    { id: 'u_client', role: 'client', name: 'Jean Dupont', phone: '0101010101', email: 'jean@example.com', passwordHash: '$2b$10$V3Ed.oiA.jq72LkYfH7z2.xU8v3P1k/uXYeFKrazPJBotSmf.kbrO', waveNumber: '0101010101', subscription: { status: 'trial', trialEndsAt: in30(), subscribedUntil: 0 }, createdAt: now },
    // --- Gérants de démo (chacun a son Wave marchand) ---
    { id: 'u_amadou', role: 'gerant', name: 'Boutique Amadou', phone: '771234567', email: 'amadou@example.com', passwordHash: '$2b$10$V3Ed.oiA.jq72LkYfH7z2.xU8v3P1k/uXYeFKrazPJBotSmf.kbrO', waveNumber: '771234567', payLink: '', subscription: { status: 'trial', trialEndsAt: in30(), subscribedUntil: 0 }, createdAt: now },
    { id: 'u_fatou', role: 'gerant', name: 'Kiosque Fatou', phone: '789876543', email: 'fatou@example.com', passwordHash: '$2b$10$V3Ed.oiA.jq72LkYfH7z2.xU8v3P1k/uXYeFKrazPJBotSmf.kbrO', waveNumber: '789876543', payLink: '', subscription: { status: 'trial', trialEndsAt: in30(), subscribedUntil: 0 }, createdAt: now },
    { id: 'u_moussa', role: 'gerant', name: 'Cabine Moussa', phone: '765554433', email: 'moussa@example.com', passwordHash: '$2b$10$V3Ed.oiA.jq72LkYfH7z2.xU8v3P1k/uXYeFKrazPJBotSmf.kbrO', waveNumber: '765554433', payLink: '', subscription: { status: 'trial', trialEndsAt: in30(), subscribedUntil: 0 }, createdAt: now },
    { id: 'u_marie', role: 'gerant', name: 'Cabine Marie', phone: '0202020202', email: 'marie@example.com', passwordHash: '$2b$10$V3Ed.oiA.jq72LkYfH7z2.xU8v3P1k/uXYeFKrazPJBotSmf.kbrO', waveNumber: '0202020202', payLink: '', subscription: { status: 'trial', trialEndsAt: in30(), subscribedUntil: 0 }, createdAt: now },
  ],

  // Gérants que le client de démo a déjà ajoutés (contacts)
  gerants: [
    { id: 'g1', ownerId: 'u_client', userId: 'u_amadou', name: 'Boutique Amadou', phone: '771234567', waveNumber: '771234567', payLink: '', rating: 4.8, online: true },
    { id: 'g2', ownerId: 'u_client', userId: 'u_fatou', name: 'Kiosque Fatou', phone: '789876543', waveNumber: '789876543', payLink: '', rating: 4.6, online: false },
    { id: 'g3', ownerId: 'u_client', userId: 'u_moussa', name: 'Cabine Moussa', phone: '765554433', waveNumber: '765554433', payLink: '', rating: 4.2, online: true },
  ],

  // Quelques demandes d'exemple pour la démo (historique + totaux)
  demandes: [
    {
      id: 'd_demo_1', ref: 'demande:demo1',
      clientId: 'u_client', clientName: 'Jean Dupont', clientPhone: '0101010101',
      gerantId: 'g1', gerantUserId: 'u_amadou', gerantName: 'Boutique Amadou', gerantPhone: '771234567', gerantWave: '771234567',
      type: 'internet', amount: 3000, benefName: 'Jean Dupont', benefPhone: '0101010101',
      status: 'completed', createdAt: now - 5 * 24 * 3600 * 1000, acceptedAt: now - 5 * 24 * 3600 * 1000 + 120000, paidAt: now - 5 * 24 * 3600 * 1000 + 240000,
    },
    {
      id: 'd_demo_2', ref: 'demande:demo2',
      clientId: 'u_client', clientName: 'Jean Dupont', clientPhone: '0101010101',
      gerantId: 'g2', gerantUserId: 'u_fatou', gerantName: 'Kiosque Fatou', gerantPhone: '789876543', gerantWave: '789876543',
      type: 'unites', amount: 1500, benefName: 'Jean Dupont', benefPhone: '0101010101',
      status: 'paid', createdAt: now - 2 * 24 * 3600 * 1000, acceptedAt: now - 2 * 24 * 3600 * 1000 + 60000, paidAt: now - 2 * 24 * 3600 * 1000 + 180000,
    },
    {
      id: 'd_demo_3', ref: 'demande:demo3',
      clientId: 'u_client', clientName: 'Jean Dupont', clientPhone: '0101010101',
      gerantId: 'g3', gerantUserId: 'u_moussa', gerantName: 'Cabine Moussa', gerantPhone: '765554433', gerantWave: '765554433',
      type: 'minutes', amount: 1000, benefName: 'Mariam', benefPhone: '0707070707',
      status: 'declined', createdAt: now - 1 * 24 * 3600 * 1000, acceptedAt: 0, paidAt: 0,
    },
    {
      id: 'd_demo_4', ref: 'demande:demo4',
      clientId: 'u_client', clientName: 'Jean Dupont', clientPhone: '0101010101',
      gerantId: 'g1', gerantUserId: 'u_amadou', gerantName: 'Boutique Amadou', gerantPhone: '771234567', gerantWave: '771234567',
      type: 'minutes', amount: 2000, benefName: 'Jean Dupont', benefPhone: '0101010101',
      status: 'pending', createdAt: now - 3 * 3600 * 1000, acceptedAt: 0, paidAt: 0,
    },
  ],
});

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
      db = loaded && loaded.users ? loaded : seed();
      usingPg = true;
      if (!loaded) await persistToPg(pool);
      console.log(`[db] PostgreSQL connecté`);
      return db;
    } catch (e) {
      console.error('[db] PostgreSQL indisponible, repli JSON :', e.message);
      pool = null;
    }
  }
  db = loadFile();
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
