import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------
//  Couche de persistance — stocke les données dans un fichier JSON.
//  Elle expose une petite API de type "collection" pour rester agnostique
//  de la base finale. Pour passer en Postgres, il suffit de remplacer
//  ce module par une implémentation utilisant un pilote SQL.
// ------------------------------------------------------------------

const DATA_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');

const seed = () => ({
  users: [
    {
      id: 'u_client', role: 'client', name: 'Jean Dupont',
      phone: '0101010101', email: 'jean@example.com',
      passwordHash: '', createdAt: Date.now(),
    },
    {
      id: 'u_gerant', role: 'gerant', name: 'Marie Diallo',
      phone: '0202020202', email: 'marie@example.com',
      passwordHash: '', createdAt: Date.now(),
    },
  ],

  balances: { u_client: 15000, u_gerant: 45000 },

  subscriptions: {
    u_client: { plan: 'minutes', name: 'Forfait Minutes', amount: 3000, renews: '15/10/2026' },
  },

  // Gérants connus (vue côté client)
  gerants: [
    { id: 'g1', ownerId: 'u_client', name: 'Boutique Amadou', phone: '771234567', rating: 4.8, tx: 156, online: true },
    { id: 'g2', ownerId: 'u_client', name: 'Kiosque Fatou', phone: '789876543', rating: 4.6, tx: 89, online: false },
    { id: 'g3', ownerId: 'u_client', name: 'Cabine Moussa', phone: '765554433', rating: 4.2, tx: 234, online: true },
  ],

  // Clients connus (vue côté gérant)
  clients: [
    { id: 'c1', ownerId: 'u_gerant', name: 'Jean Dupont', phone: '771112233', tx: 45, online: true, added: '09/09/2025' },
    { id: 'c2', ownerId: 'u_gerant', name: 'Marie Diallo', phone: '784445566', tx: 23, online: true, added: '12/09/2025' },
    { id: 'c3', ownerId: 'u_gerant', name: 'Ibrahima Fall', phone: '767778899', tx: 67, online: false, added: '04/02/2025' },
  ],

  // Transactions de démo (rattachées aux comptes de démonstration)
  transactions: [
    { id: 'tx_client_seed_1', role: 'client', type: 'recharge', label: 'Recharge', amount: 10000, date: '14 sept. à 21:51', userId: 'u_client', status: 'reussi' },
    { id: 'tx_client_seed_2', role: 'client', type: 'internet', label: 'internet', amount: -2000, date: '14 sept. à 18:51', userId: 'u_client', pour: '789876543', status: 'reussi' },
    { id: 'tx_client_seed_3', role: 'client', type: 'minutes', label: 'minutes', amount: -1500, date: '13 sept. à 23:51', userId: 'u_client', pour: '771234567', status: 'reussi' },
    { id: 'tx_gerant_seed_1', role: 'gerant', type: 'unites', label: 'units', amount: 5000, date: 'Il y a 3 jours', userId: 'u_gerant', pour: 'Jean Dupont', status: 'reussi' },
    { id: 'tx_gerant_seed_2', role: 'gerant', type: 'retrait', label: 'Retrait Wave', amount: -10000, date: 'Il y a 2 jours', userId: 'u_gerant', status: 'reussi' },
    { id: 'tx_gerant_seed_3', role: 'gerant', type: 'internet', label: 'internet', amount: 3000, date: 'Hier', userId: 'u_gerant', pour: 'Fatou Sow', status: 'reussi' },
  ],

  // Demandes de démo (à traiter par le gérant)
  demandes: [
    { id: 'd_seed_1', ref: 'demande:seed1', type: 'minutes', amount: 3000, client: 'Moussa Ndiaye', clientId: 'u_client', benef: '765554433', gerantId: 'g3', gerantPhone: '765554433', gerantName: 'Cabine Moussa', createdAt: Date.now() - 5 * 60000, expiresIn: 220, status: 'en_attente', paid: false },
    { id: 'd_seed_2', ref: 'demande:seed2', type: 'internet', amount: 2000, client: 'Fatou Sow', clientId: 'u_client', benef: '781234567', gerantId: 'g2', gerantPhone: '789876543', gerantName: 'Kiosque Fatou', createdAt: Date.now() - 2 * 3600000, expiresIn: 150, status: 'en_attente', paid: false },
  ],
});

let db = null;

function load() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
      /* corrupted -> reseed */
    }
  }
  return seed();
}

function persist() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

export function initDb() {
  db = load();
  persist();
  return db;
}

export function getDb() {
  if (!db) initDb();
  return db;
}

export function save() {
  persist();
}

// Small collection helpers -------------------------------------------------
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
    if (pred(r)) {
      updated = { ...r, ...patch };
      return updated;
    }
    return r;
  });
  save();
  return updated;
}

export function remove(collection, pred) {
  const d = getDb();
  const before = d[collection].length;
  d[collection] = d[collection].filter((r) => !pred(r));
  save();
  return d[collection].length < before;
}
