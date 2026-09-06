import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==================================================================
//  Couche de persistance (double backend)
//  - Si DATABASE_URL est défini  -> PostgreSQL (production, durable).
//      Les données sont stockées dans une table `app_state` (JSONB),
//      persistées à chaque écriture et rechargées au démarrage.
//  - Sinon                        -> fichier JSON (dev / tests).
//
//  L'interface exposée est la même (getDb / save / insert / find / …)
//  et s'appuie sur un miroir en mémoire pour les lectures. Aucune
//  route n'a besoin d'être modifiée.
// ==================================================================

const DATA_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');
const DATABASE_URL = process.env.DATABASE_URL || '';
const COLLECTIONS = ['users', 'balances', 'subscriptions', 'gerants', 'clients', 'transactions', 'demandes'];

let db = null;
let pool = null;
let usingPg = false;

// ------------------------- Seed / données de démo -------------------------
const seed = () => ({
  users: [
    { id: 'u_client', role: 'client', name: 'Jean Dupont', phone: '0101010101', email: 'jean@example.com', passwordHash: '', createdAt: Date.now() },
    { id: 'u_gerant', role: 'gerant', name: 'Marie Diallo', phone: '0202020202', email: 'marie@example.com', passwordHash: '', createdAt: Date.now() },
  ],
  balances: { u_client: 15000, u_gerant: 45000 },
  subscriptions: { u_client: { plan: 'minutes', name: 'Forfait Minutes', amount: 3000, renews: '15/10/2026' } },
  gerants: [
    { id: 'g1', ownerId: 'u_client', name: 'Boutique Amadou', phone: '771234567', rating: 4.8, tx: 156, online: true },
    { id: 'g2', ownerId: 'u_client', name: 'Kiosque Fatou', phone: '789876543', rating: 4.6, tx: 89, online: false },
    { id: 'g3', ownerId: 'u_client', name: 'Cabine Moussa', phone: '765554433', rating: 4.2, tx: 234, online: true },
  ],
  clients: [
    { id: 'c1', ownerId: 'u_gerant', name: 'Jean Dupont', phone: '771112233', tx: 45, online: true, added: '09/09/2025' },
    { id: 'c2', ownerId: 'u_gerant', name: 'Marie Diallo', phone: '784445566', tx: 23, online: true, added: '12/09/2025' },
    { id: 'c3', ownerId: 'u_gerant', name: 'Ibrahima Fall', phone: '767778899', tx: 67, online: false, added: '04/02/2025' },
  ],
  transactions: [
    { id: 'tx_client_seed_1', role: 'client', type: 'recharge', label: 'Recharge', amount: 10000, date: '14 sept. à 21:51', userId: 'u_client', status: 'reussi' },
    { id: 'tx_client_seed_2', role: 'client', type: 'internet', label: 'internet', amount: -2000, date: '14 sept. à 18:51', userId: 'u_client', pour: '789876543', status: 'reussi' },
    { id: 'tx_client_seed_3', role: 'client', type: 'minutes', label: 'minutes', amount: -1500, date: '13 sept. à 23:51', userId: 'u_client', pour: '771234567', status: 'reussi' },
    { id: 'tx_gerant_seed_1', role: 'gerant', type: 'unites', label: 'units', amount: 5000, date: 'Il y a 3 jours', userId: 'u_gerant', pour: 'Jean Dupont', status: 'reussi' },
    { id: 'tx_gerant_seed_2', role: 'gerant', type: 'retrait', label: 'Retrait Wave', amount: -10000, date: 'Il y a 2 jours', userId: 'u_gerant', status: 'reussi' },
    { id: 'tx_gerant_seed_3', role: 'gerant', type: 'internet', label: 'internet', amount: 3000, date: 'Hier', userId: 'u_gerant', pour: 'Fatou Sow', status: 'reussi' },
  ],
  demandes: [
    { id: 'd_seed_1', ref: 'demande:seed1', type: 'minutes', amount: 3000, client: 'Moussa Ndiaye', clientId: 'u_client', benef: '765554433', gerantId: 'g3', gerantPhone: '765554433', gerantName: 'Cabine Moussa', createdAt: Date.now() - 5 * 60000, expiresIn: 220, status: 'en_attente', paid: false },
    { id: 'd_seed_2', ref: 'demande:seed2', type: 'internet', amount: 2000, client: 'Fatou Sow', clientId: 'u_client', benef: '781234567', gerantId: 'g2', gerantPhone: '789876543', gerantName: 'Kiosque Fatou', createdAt: Date.now() - 2 * 3600000, expiresIn: 150, status: 'en_attente', paid: false },
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
  await p.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key        text PRIMARY KEY,
      data       jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
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
      console.log(`[db] PostgreSQL connecté (${COLLECTIONS.length} collections)`);
      return db;
    } catch (e) {
      console.error('[db] PostgreSQL indisponible, repli sur fichier JSON :', e.message);
      pool = null;
    }
  }

  db = loadFile();
  writeFile();
  return db;
}

function persist() {
  if (usingPg && pool) {
    persistToPg(pool).catch((e) => console.error('[db] persist PostgreSQL :', e.message));
  } else {
    writeFile();
  }
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

export function find(collection, pred) {
  return getDb()[collection].filter(pred);
}

export function findOne(collection, pred) {
  return getDb()[collection].find(pred) || null;
}

export function update(collection, pred, patch) {
  const d = getDb();
  let updated = null;
  d[collection] = d[collection].map((r) => {
    if (pred(r)) { updated = { ...r, ...patch }; return updated; }
    return r;
  });
  save();
  return updated;
}

export function remove(collection, pred) {
  const d = getDb();
  d[collection] = d[collection].filter((r) => !pred(r));
  save();
  return d[collection];
}
