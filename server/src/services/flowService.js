import { getDb, save, insert, findOne, find, update, remove } from '../db.js';

// ==================================================================
//  Logique métier (v2 — zéro argent stocké sur l'app)
//  - L'app ne stocke AUCUN argent : elle met en relation.
//  - Le client paie DIRECTEMENT au gérant (Wave marchand) hors app.
//  - Le gérant accepte / refuse les demandes puis sert le client.
//  - Abonnement 100 FCFA/mois + 1 mois d'essai gratuit.
// ==================================================================

const MONTH_MS = 30 * 24 * 3600 * 1000;
const SUB_PRICE = 100; // FCFA / mois

// Libellé des types de service
export const TYPE_LABEL = { unites: 'Unités', minutes: 'Minutes', internet: 'Internet' };

// ---- Abonnement ----
export function subscriptionFor(user) {
  const s = user.subscription || { status: 'trial', trialEndsAt: 0, subscribedUntil: 0 };
  const now = Date.now();
  if (s.status === 'active' && s.subscribedUntil > now) {
    return { status: 'active', price: SUB_PRICE, trialEndsAt: s.trialEndsAt, subscribedUntil: s.subscribedUntil, daysLeft: Math.ceil((s.subscribedUntil - now) / 86400000) };
  }
  if (s.status === 'trial' && s.trialEndsAt > now) {
    return { status: 'trial', price: SUB_PRICE, trialEndsAt: s.trialEndsAt, subscribedUntil: 0, daysLeft: Math.ceil((s.trialEndsAt - now) / 86400000) };
  }
  return { status: 'expired', price: SUB_PRICE, trialEndsAt: s.trialEndsAt, subscribedUntil: s.subscribedUntil, daysLeft: 0 };
}

export function activateSubscription(user) {
  const now = Date.now();
  const s = user.subscription || {};
  const prev = s.subscribedUntil > now ? s.subscribedUntil : now;
  const subscribedUntil = prev + MONTH_MS;
  update('users', (u) => u.id === user.id, { subscription: { status: 'active', trialEndsAt: s.trialEndsAt || now + MONTH_MS, subscribedUntil } });
  return subscriptionFor({ ...user, subscription: { status: 'active', trialEndsAt: s.trialEndsAt || now + MONTH_MS, subscribedUntil } });
}

export const SUB_PRICE_FCFA = SUB_PRICE;

// ---- Public profile (lien de partage) ----
export function publicProfile(id) {
  const u = findOne('users', (x) => x.id === id);
  if (!u) return null;
  return { id: u.id, name: u.name, phone: u.phone, role: u.role, waveNumber: u.waveNumber, payLink: u.payLink || '' };
}

// ---- Gérants (contacts) d'un client ----
export function gerantsFor(clientId) {
  return find('gerants', (g) => g.ownerId === clientId);
}

export function addGerant({ clientId, phone, name }) {
  const phoneTrim = String(phone || '').replace(/[^0-9]/g, '');
  if (!phoneTrim) throw Object.assign(new Error('Numéro requis'), { status: 400 });

  // Gérant déjà ajouté ?
  const existing = findOne('gerants', (g) => g.ownerId === clientId && g.phone === phoneTrim);
  if (existing) return { gerant: existing, created: false };

  // Cherche un utilisateur enregistré avec ce numéro
  let user = findOne('users', (u) => u.phone === phoneTrim && u.role === 'gerant');
  let newUser;
  if (!user) {
    // Crée un compte gérant (activé plus tard) pour que le lien/le traitement fonctionnent
    newUser = insert('users', {
      role: 'gerant',
      name: name || `Gérant ${phoneTrim.slice(-4)}`,
      phone: phoneTrim,
      email: '',
      passwordHash: '',
      waveNumber: phoneTrim,
      payLink: '',
      subscription: { status: 'trial', trialEndsAt: Date.now() + MONTH_MS, subscribedUntil: 0 },
      createdAt: Date.now(),
    });
    user = newUser;
  }

  const gerant = insert('gerants', {
    ownerId: clientId,
    userId: user.id,
    name: user.name,
    phone: user.phone,
    waveNumber: user.waveNumber,
    payLink: user.payLink || '',
    rating: 4.0,
    online: true,
  });
  return { gerant, created: true };
}

// ---- Profil gérant (nom, téléphone, numéro + lien Wave marchand) ----
export function gerantProfile(user) {
  return {
    name: user.name,
    phone: user.phone,
    waveNumber: user.waveNumber,
    payLink: user.payLink || '',
  };
}

export function updateGerantProfile({ userId, waveNumber, payLink }) {
  const patch = {};
  if (waveNumber !== undefined) patch.waveNumber = String(waveNumber).replace(/[^0-9]/g, '');
  if (payLink !== undefined) patch.payLink = String(payLink).trim();

  if (Object.keys(patch).length) {
    update('users', (u) => u.id === userId, patch);
    // Propage le changement à tous les contacts « gérants » qui le référencent
    find('gerants', (g) => g.userId === userId).forEach((g) => {
      update('gerants', (x) => x.id === g.id, patch);
    });
  }
  const u = findOne('users', (x) => x.id === userId);
  return u ? gerantProfile(u) : null;
}

export function removeGerant({ clientId, gerantId }) {
  remove('gerants', (g) => g.id === gerantId && g.ownerId === clientId);
}

// ---- Demandes ----
export function createDemande({ client, gerantId, type, amount, benefName, benefPhone }) {
  const g = findOne('gerants', (g) => g.id === gerantId);
  if (!g) throw Object.assign(new Error('Gérant introuvable'), { status: 404 });
  if (!['unites', 'minutes', 'internet'].includes(type)) throw Object.assign(new Error('Type invalide'), { status: 400 });
  if (!(parseInt(amount, 10) > 0)) throw Object.assign(new Error('Montant invalide'), { status: 400 });

  const d = insert('demandes', {
    ref: `demande:${Date.now()}`,
    clientId: client.id,
    clientName: client.name,
    clientPhone: client.phone,
    gerantId: g.id,
    gerantUserId: g.userId || '',
    gerantName: g.name,
    gerantPhone: g.phone,
    gerantWave: g.waveNumber,
    gerantPayLink: g.payLink || '',
    type,
    amount: parseInt(amount, 10),
    benefName: benefName || client.name,
    benefPhone: benefPhone || client.phone,
    status: 'pending',           // pending | accepted | declined | paid | completed
    createdAt: Date.now(),
    acceptedAt: 0,
    paidAt: 0,
  });
  return d;
}

export function demandesForClient(clientId) {
  return find('demandes', (d) => d.clientId === clientId).sort((a, b) => b.createdAt - a.createdAt);
}

export function demandesForGerant(userId) {
  return find('demandes', (d) => d.gerantUserId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

// ---- Résumé / historique (v2 : on suit les demandes, pas d'argent stocké) ----
export function demandeSummary(demandes) {
  const counts = { pending: 0, accepted: 0, declined: 0, paid: 0, completed: 0 };
  let totalSpent = 0; // somme payée par le client (paid + completed)
  let totalServed = 0; // somme servie par le gérant (completed)
  for (const d of demandes || []) {
    if (counts[d.status] !== undefined) counts[d.status] += 1;
    if (d.status === 'paid' || d.status === 'completed') totalSpent += d.amount || 0;
    if (d.status === 'completed') totalServed += d.amount || 0;
  }
  return { count: (demandes || []).length, counts, totalSpent, totalServed };
}

export function clientHistory(clientId) {
  const demandes = demandesForClient(clientId);
  return { demandes, summary: demandeSummary(demandes) };
}

export function gerantHistory(userId) {
  const demandes = demandesForGerant(userId);
  return { demandes, summary: demandeSummary(demandes) };
}

export function decideDemande({ id, gerantUserId, decision }) {
  const d = findOne('demandes', (x) => x.id === id && x.gerantUserId === gerantUserId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (d.status !== 'pending') throw Object.assign(new Error('Demande déjà traitée'), { status: 400 });
  const status = decision === 'accept' ? 'accepted' : 'declined';
  update('demandes', (x) => x.id === id, { status, acceptedAt: Date.now() });
  return findOne('demandes', (x) => x.id === id);
}

export function markPaid({ id, clientId }) {
  const d = findOne('demandes', (x) => x.id === id && x.clientId === clientId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (d.status !== 'accepted') throw Object.assign(new Error('Demande non acceptée'), { status: 400 });
  update('demandes', (x) => x.id === id, { status: 'paid', paidAt: Date.now() });
  return findOne('demandes', (x) => x.id === id);
}

export function markCompleted({ id, gerantUserId }) {
  const d = findOne('demandes', (x) => x.id === id && x.gerantUserId === gerantUserId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (d.status !== 'paid') throw Object.assign(new Error('Demande non payée'), { status: 400 });
  update('demandes', (x) => x.id === id, { status: 'completed' });
  return findOne('demandes', (x) => x.id === id);
}
