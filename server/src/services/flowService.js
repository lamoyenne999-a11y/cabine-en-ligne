import { getDb, save, insert, findOne, find, update, remove } from '../db.js';
import { config } from '../config.js';

// ==================================================================
//  Logique métier (v2 — zéro argent stocké sur l'app)
//  - L'app ne stocke AUCUN argent : elle met en relation.
//  - Le client paie DIRECTEMENT au gérant (Wave marchand) hors app.
//  - Le gérant accepte / refuse les demandes puis sert le client.
//  - Abonnement 100 FCFA/mois + 1 mois d'essai gratuit.
// ==================================================================

const MONTH_MS = 30 * 24 * 3600 * 1000;
const YEAR_MS = 365 * 24 * 3600 * 1000;
// Plans d'abonnement : mensuel 100 FCFA / annuel 1000 FCFA
export const SUB_PLANS = {
  monthly: { price: 100, ms: MONTH_MS, label: 'mensuel', priceLabel: '100 FCFA / mois' },
  annual: { price: 1000, ms: YEAR_MS, label: 'annuel', priceLabel: '1000 FCFA / an' },
};
const SUB_DEFAULT_PLAN = 'monthly';
const SUB_PRICE = SUB_PLANS[SUB_DEFAULT_PLAN].price; // 100 FCFA (compat)

// Libellé des types de service
export const TYPE_LABEL = { unites: 'Unités', minutes: 'Minutes', internet: 'Internet' };

// ---- Abonnement (mensuel 100 FCFA / annuel 1000 FCFA) ----
export function subscriptionFor(user) {
  const s = user.subscription || { status: 'trial', trialEndsAt: 0, subscribedUntil: 0 };
  const plan = SUB_PLANS[s.plan] ? s.plan : SUB_DEFAULT_PLAN;
  const price = s.price || SUB_PLANS[plan].price;
  const periodLabel = SUB_PLANS[plan].label;
  const now = Date.now();
  if (s.status === 'active' && s.subscribedUntil > now) {
    return { status: 'active', plan, price, periodLabel, priceLabel: SUB_PLANS[plan].priceLabel, trialEndsAt: s.trialEndsAt, subscribedUntil: s.subscribedUntil, daysLeft: Math.ceil((s.subscribedUntil - now) / 86400000) };
  }
  if (s.status === 'trial' && s.trialEndsAt > now) {
    return { status: 'trial', plan, price, periodLabel, priceLabel: SUB_PLANS[plan].priceLabel, trialEndsAt: s.trialEndsAt, subscribedUntil: 0, daysLeft: Math.ceil((s.trialEndsAt - now) / 86400000) };
  }
  return { status: 'expired', plan, price, periodLabel, priceLabel: SUB_PLANS[plan].priceLabel, trialEndsAt: s.trialEndsAt, subscribedUntil: s.subscribedUntil, daysLeft: 0 };
}

export function activateSubscription(user, plan = SUB_DEFAULT_PLAN) {
  const now = Date.now();
  const conf = SUB_PLANS[plan] || SUB_PLANS[SUB_DEFAULT_PLAN];
  const s = user.subscription || {};
  const prev = s.subscribedUntil > now ? s.subscribedUntil : now;
  const subscribedUntil = prev + conf.ms;
  const fresh = { status: 'active', plan: Object.keys(SUB_PLANS).includes(plan) ? plan : SUB_DEFAULT_PLAN, price: conf.price, trialEndsAt: s.trialEndsAt || now + MONTH_MS, subscribedUntil };
  update('users', (u) => u.id === user.id, { subscription: fresh });
  return { ...subscriptionFor({ ...user, subscription: fresh }), justActivated: true };
}

export const SUB_PRICE_FCFA = SUB_PRICE;

// ---- Notifications (reçues par les gérants) ----
export function notificationsFor(userId) {
  return find('notifications', (n) => n.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}
export function unreadCount(userId) {
  return notificationsFor(userId).filter((n) => !n.read).length;
}
export function createNotification({ userId, type, text, demandeId }) {
  return insert('notifications', {
    userId,
    type,             // 'new_demande' | 'demande_accepted' | 'demande_declined' | 'demande_canceled' | 'demande_paid' | 'demande_completed'
    text,
    demandeId: demandeId || '',
    read: false,
    createdAt: Date.now(),
  });
}
export function markNotificationRead({ id, userId }) {
  const n = findOne('notifications', (x) => x.id === id && x.userId === userId);
  if (!n) throw Object.assign(new Error('Notification introuvable'), { status: 404 });
  update('notifications', (x) => x.id === id, { read: true });
  return findOne('notifications', (x) => x.id === id);
}
export function markAllNotificationsRead(userId) {
  notificationsFor(userId).forEach((n) => update('notifications', (x) => x.id === n.id, { read: true }));
  return { ok: true };
}

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

// Gérants réellement inscrits sur la plateforme, proposés au client pour
// simplifier sa tâche. On exclut les comptes sans mot de passe (fantômes /
// créés à la volée) pour n'afficher que des gérants enregistrés.
export function availableGerants(clientId) {
  const added = gerantsFor(clientId).map((g) => g.userId);
  return find('users', (u) => u.role === 'gerant' && u.passwordHash)
    .map((u) => ({ userId: u.id, name: u.name, phone: u.phone, waveNumber: u.waveNumber || u.phone, payLink: u.payLink || '', alreadyAdded: added.includes(u.id) }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export function addGerant({ clientId, phone, name }) {
  const phoneTrim = String(phone || '').replace(/[^0-9]/g, '');
  if (!phoneTrim) throw Object.assign(new Error('Numéro requis'), { status: 400 });

  // Gérant déjà ajouté ?
  const existing = findOne('gerants', (g) => g.ownerId === clientId && g.phone === phoneTrim);
  if (existing) return { gerant: existing, created: false };

  // On n'ajoute que les gérants réellement INSCRITS sur la plateforme.
  // Aucun compte ne doit être créé à la volée (évite les profils fantômes).
  const user = findOne('users', (u) => u.phone === phoneTrim && u.role === 'gerant');
  if (!user) {
    throw Object.assign(new Error("Ce numéro ne correspond à aucun gérant inscrit sur Cabine En Ligne. Invitez-le à s'inscrire, ou tapez le numéro exact."), { status: 404 });
  }

  const gerant = insert('gerants', {
    ownerId: clientId,
    userId: user.id,
    name: user.name,
    phone: user.phone,
    waveNumber: user.waveNumber || user.phone,
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
export function createDemande({ client, gerantId, gerantUserId, type, amount, benefName, benefPhone }) {
  // On accepte soit un contact déjà ajouté (gerantId), soit directement un
  // gérant inscrit (gerantUserId). Si c'est un gérant inscrit non encore
  // ajouté, on crée le contact automatiquement pour simplifier la tâche du client.
  let g = gerantId ? findOne('gerants', (x) => x.id === gerantId && x.ownerId === client.id) : null;
  if (!g && gerantUserId) {
    const u = findOne('users', (x) => x.id === gerantUserId && x.role === 'gerant');
    if (u) {
      g = findOne('gerants', (x) => x.ownerId === client.id && x.userId === u.id);
      if (!g) g = insert('gerants', {
        ownerId: client.id, userId: u.id, name: u.name, phone: u.phone,
        waveNumber: u.waveNumber || u.phone, payLink: u.payLink || '', rating: 4.0, online: true,
      });
    }
  }
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
    status: 'pending',           // pending | accepted | declined | paid | completed | canceled
    createdAt: Date.now(),
    expiresAt: Date.now() + config.demandeExpireMs,
    acceptedAt: 0,
    paidAt: 0,
    canceledAt: 0,
  });
  // Notifie le gérant qu'une nouvelle demande est arrivée
  if (g.userId) createNotification({ userId: g.userId, type: 'new_demande', text: `Nouvelle demande de ${client.name} — ${TYPE_LABEL[type] || type}  ${d.amount} F`, demandeId: d.id });
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
  const counts = { pending: 0, accepted: 0, declined: 0, paid: 0, completed: 0, canceled: 0 };
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

// Le client peut annuler sa demande tant qu'il n'a PAS ENCORE PAYÉ
// (statut 'pending' ou 'accepted'). Dès qu'il a payé ('paid') ou que la
// demande est déjà traitée ('completed') / refusée ('declined') / annulée,
// elle ne peut plus être annulée. Le gérant est notifié.
export function cancelDemande({ id, clientId }) {
  const d = findOne('demandes', (x) => x.id === id && x.clientId === clientId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (!['pending', 'accepted'].includes(d.status)) {
    throw Object.assign(new Error('Cette demande ne peut plus être annulée (déjà payée ou traitée)'), { status: 400 });
  }
  update('demandes', (x) => x.id === id, { status: 'canceled', canceledAt: Date.now() });
  const updated = findOne('demandes', (x) => x.id === id);
  // Notifie le gérant que le client a annulé (avant paiement)
  if (updated && updated.gerantUserId) {
    createNotification({
      userId: updated.gerantUserId,
      type: 'demande_canceled',
      text: `${updated.clientName} a annulé sa demande — ${TYPE_LABEL[updated.type] || updated.type}  ${updated.amount} F (avant paiement)`,
      demandeId: updated.id,
    });
  }
  return updated;
}

export function decideDemande({ id, gerantUserId, decision }) {
  const d = findOne('demandes', (x) => x.id === id && x.gerantUserId === gerantUserId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (decision === 'decline') {
    if (d.status !== 'pending') throw Object.assign(new Error('Impossible de refuser une demande déjà payée ou traitée'), { status: 400 });
    update('demandes', (x) => x.id === id, { status: 'declined', acceptedAt: Date.now() });
    const upd = findOne('demandes', (x) => x.id === id);
    if (upd && upd.clientId) createNotification({ userId: upd.clientId, type: 'demande_declined', text: `${upd.gerantName} a refusé votre demande — ${TYPE_LABEL[upd.type] || upd.type}  ${upd.amount} F`, demandeId: upd.id });
    return upd;
  } else {
    // Acceptation possible en attente OU après paiement anticipé du client
    if (!['pending', 'paid'].includes(d.status)) throw Object.assign(new Error('Demande déjà traitée'), { status: 400 });
    update('demandes', (x) => x.id === id, { status: 'accepted', acceptedAt: Date.now() });
    const upd = findOne('demandes', (x) => x.id === id);
    // Notifie le client que sa demande a été acceptée
    if (upd && upd.clientId) createNotification({ userId: upd.clientId, type: 'demande_accepted', text: `${upd.gerantName} a accepté votre demande — ${TYPE_LABEL[upd.type] || upd.type}  ${upd.amount} F`, demandeId: upd.id });
    return upd;
  }
}

export function markPaid({ id, clientId }) {
  const d = findOne('demandes', (x) => x.id === id && x.clientId === clientId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  // Le client peut payer AVANT que le gérant accepte (pending) ou APRÈS (accepted)
  if (!['pending', 'accepted'].includes(d.status)) throw Object.assign(new Error('Cette demande ne peut plus être payée'), { status: 400 });
  update('demandes', (x) => x.id === id, { status: 'paid', paidAt: Date.now() });
  const updated = findOne('demandes', (x) => x.id === id);
  // Notifie le gérant que le client a payé
  if (updated && updated.gerantUserId) {
    createNotification({
      userId: updated.gerantUserId,
      type: 'demande_paid',
      text: `${updated.clientName} a payé ${updated.amount} F pour sa demande ${TYPE_LABEL[updated.type] || updated.type}`,
      demandeId: updated.id,
    });
  }
  return updated;
}

export function markCompleted({ id, gerantUserId }) {
  const d = findOne('demandes', (x) => x.id === id && x.gerantUserId === gerantUserId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (!['paid', 'accepted'].includes(d.status)) throw Object.assign(new Error('Demande non payée'), { status: 400 });
  update('demandes', (x) => x.id === id, { status: 'completed' });
  return findOne('demandes', (x) => x.id === id);
}
