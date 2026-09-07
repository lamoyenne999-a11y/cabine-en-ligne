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

// Plans d'abonnement DIFFÉRENCIÉS PAR RÔLE.
//  - Client  : mensuel 100 FCFA / annuel 1000 FCFA
//  - Gérant  : mensuel 200 FCFA / annuel 2000 FCFA  (ce sont eux qui
//    bénéficient le plus : demandes illimitées + traitement + badge).
const SUB_PLANS_CLIENT = {
  monthly: { price: 100, ms: MONTH_MS, label: 'mensuel', priceLabel: '100 FCFA / mois' },
  annual: { price: 1000, ms: YEAR_MS, label: 'annuel', priceLabel: '1000 FCFA / an' },
};
const SUB_PLANS_GERANT = {
  monthly: { price: 200, ms: MONTH_MS, label: 'mensuel', priceLabel: '200 FCFA / mois' },
  annual: { price: 2000, ms: YEAR_MS, label: 'annuel', priceLabel: '2000 FCFA / an' },
};
// Rétro-compat : SUB_PLANS pointe vers les plans client (défaut).
export const SUB_PLANS = SUB_PLANS_CLIENT;
const SUB_DEFAULT_PLAN = 'monthly';

// Retourne le bon référentiel de plans selon le rôle de l'utilisateur.
export function plansFor(role) {
  return (role === 'gerant' ? SUB_PLANS_GERANT : SUB_PLANS_CLIENT);
}

// Libellé des types de service
export const TYPE_LABEL = { unites: 'Unités', minutes: 'Minutes', internet: 'Internet' };

// ---- Abonnement (prix selon le rôle) ----
export function subscriptionFor(user) {
  const plans = plansFor(user.role);
  const s = user.subscription || { status: 'trial', trialEndsAt: 0, subscribedUntil: 0 };
  const plan = s.plan && plans[s.plan] ? s.plan : SUB_DEFAULT_PLAN;
  const price = s.price || plans[plan].price;
  const periodLabel = plans[plan].label;
  const now = Date.now();
  // Dernier paiement d'abonnement enregistré (reçu affiché à l'utilisateur).
  const lastPayment = find('subscriptions', (p) => p.userId === user.id).sort((a, b) => b.paidAt - a.paidAt)[0] || null;
  const base = {
    plan, price, periodLabel, priceLabel: plans[plan].priceLabel,
    trialEndsAt: s.trialEndsAt, subscribedUntil: s.subscribedUntil,
    lastPayment: lastPayment ? { reference: lastPayment.reference, amount: lastPayment.amount, priceLabel: lastPayment.priceLabel, paidAt: lastPayment.paidAt, validUntil: lastPayment.validUntil, plan: lastPayment.plan } : null,
  };
  if (s.status === 'active' && s.subscribedUntil > now) {
    return { ...base, status: 'active', daysLeft: Math.ceil((s.subscribedUntil - now) / 86400000) };
  }
  if (s.status === 'trial' && s.trialEndsAt > now) {
    return { ...base, status: 'trial', subscribedUntil: 0, daysLeft: Math.ceil((s.trialEndsAt - now) / 86400000) };
  }
  return { ...base, status: 'expired', daysLeft: 0 };
}

export function activateSubscription(user, plan = SUB_DEFAULT_PLAN) {
  const plans = plansFor(user.role);
  const now = Date.now();
  const conf = plans[plan] || plans[SUB_DEFAULT_PLAN];
  const s = user.subscription || {};
  const prev = s.subscribedUntil > now ? s.subscribedUntil : now;
  const subscribedUntil = prev + conf.ms;
  const fresh = { status: 'active', plan: conf === plans[plan] ? plan : SUB_DEFAULT_PLAN, price: conf.price, trialEndsAt: s.trialEndsAt || now + MONTH_MS, subscribedUntil };
  update('users', (u) => u.id === user.id, { subscription: fresh });
  return { ...subscriptionFor({ ...user, subscription: fresh }), justActivated: true };
}

// ------------------------------------------------------------------
//  Registre des paiements d'abonnement.
//  Chaque activation d'abonnement crée une ligne traçable : qui, quel
//  plan, quel montant, quand, valable jusqu'à quelle date + une référence.
//  C'est ce qui permet au client et au propriétaire de SAVOIR que le
//  paiement a été déclaré, et au propriétaire de vérifier qu'il a bien
//  reçu le montant sur son compte (Payout Wave / relevé).
// ------------------------------------------------------------------
function makeSubscriptionReference() {
  return 'SUB-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function paySubscription(user, plan = SUB_DEFAULT_PLAN) {
  const plans = plansFor(user.role);
  const now = Date.now();
  const conf = plans[plan] || plans[SUB_DEFAULT_PLAN];
  // Détermine la nouvelle date de fin (cumul si déjà actif).
  const s = user.subscription || {};
  const prev = s.subscribedUntil > now ? s.subscribedUntil : now;
  const validUntil = prev + conf.ms;

  // 1) Active l'abonnement côté utilisateur.
  const fresh = { status: 'active', plan: conf === plans[plan] ? plan : SUB_DEFAULT_PLAN, price: conf.price, trialEndsAt: s.trialEndsAt || now + MONTH_MS, subscribedUntil: validUntil, expiryNotified: false };
  update('users', (u) => u.id === user.id, { subscription: fresh });

  // 2) Enregistre le paiement (traçabilité propriétaire).
  const reference = makeSubscriptionReference();
  const payment = insert('subscriptions', {
    id: 'sub_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    reference,
    userId: user.id,
    role: user.role,
    name: user.name,
    phone: user.phone,
    plan: conf === plans[plan] ? plan : SUB_DEFAULT_PLAN,
    amount: conf.price,
    priceLabel: conf.priceLabel,
    paidAt: now,
    validUntil,
  });

  // 3) Crédite la commission du parrain (si l'utilisateur a été parrainé).
  const referralCommission = recordReferralCommission(user, payment);

  // 4) Journal : signale le paiement dans l'Espace propriétaire.
  recordEvent({ type: 'subscription_paid', name: user.name, phone: user.phone, role: user.role, amount: conf.price, plan: conf === plans[plan] ? plan : SUB_DEFAULT_PLAN, reference });

  return {
    subscription: subscriptionFor({ ...user, subscription: fresh }),
    payment,
    referralCommission,
  };
}

// Le service est autorisé si l'abonnement est en ESSAI (pas expiré) ou ACTIF.
export function serviceAllowed(subscription) {
  const st = subscription?.status;
  return st === 'active' || st === 'trial';
}

// ---- Vue propriétaire : tous les paiements d'abonnement déclarés ----
export function subscriptionPayments() {
  return find('subscriptions', () => true).sort((a, b) => b.paidAt - a.paidAt);
}
export function subscriptionTotals() {
  const rows = subscriptionPayments();
  return {
    count: rows.length,
    totalReceived: rows.reduce((sum, r) => sum + (r.amount || 0), 0),
    byPlan: rows.reduce((acc, r) => {
      acc[r.plan] = (acc[r.plan] || 0) + (r.amount || 0);
      return acc;
    }, {}),
  };
}

export const SUB_PRICE_FCFA = SUB_PLANS_CLIENT[SUB_DEFAULT_PLAN].price; // 100 FCFA (compat client)

// ------------------------------------------------------------------
//  PARRAINAGE / COMMISSION (paliers 5 / 10 / 20 % selon les INSCRITS)
//  - Chaque utilisateur peut créer son propre code de parrainage
//    (libre, 6-12 lettres/chiffres, UNIQUE). Aucun code n'est attribué
//    automatiquement : l'utilisateur crée le sien s'il le souhaite.
//  - À l'inscription, le nouvel utilisateur peut saisir un code ; cela
//    l'attache durablement à un parrain.
//  - Quand un inscrit paie son abonnement (mensuel OU annuel), le parrain
//    est CRÉDITÉ : commission = taux % du montant payé.
//  - Le palier se base sur le NOMBRE D'INSCRITS (parrainés) :
//      < 100  inscrits -> 0 %   (aucune commission avant 100)
//      >= 100           -> 5 %
//      >= 1000          -> 10 %
//      >= 10000         -> 20 %
//    (l'app n'affiche PAS « 0 % » : elle montre le palier à atteindre.)
//  - Versement : les gains sont « suivis » dans l'app (parrain + propriétaire),
//    puis le propriétaire paie le parrain manuellement (Wave). Aucun argent
//    n'est stocké ni envoyé automatiquement par l'app.
// ------------------------------------------------------------------
export function referralRateFor(count) {
  const c = count || 0;
  if (c >= 10000) return 20;
  if (c >= 1000) return 10;
  if (c >= 100) return 5;
  return 0;
}
// Prochain palier à atteindre (pour l'affichage) ; null = taux max.
export function referralNextTier(count) {
  const c = count || 0;
  if (c < 100) return { need: 100, rate: 5 };
  if (c < 1000) return { need: 1000, rate: 10 };
  if (c < 10000) return { need: 10000, rate: 20 };
  return null;
}

// Attache un parrain au nouvel utilisateur (code saisi à l'inscription).
export function applyReferral(user, code) {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return;
  const referrer = findOne('users', (u) => u.referralCode === c);
  if (!referrer) throw Object.assign(new Error('Code de parrainage invalide'), { status: 400 });
  if (referrer.id === user.id) throw Object.assign(new Error('Vous ne pouvez pas vous parrainer vous-même'), { status: 400 });
  update('users', (u) => u.id === user.id, { referredBy: referrer.id });
}

export function referredUsersCount(userId) {
  return find('users', (u) => u.referredBy === userId).length;
}
// Nombre de PAIEMENTS d'abonnement générés par les invités (pour l'historique).
export function referralPaymentCount(userId) {
  return find('referrals', (r) => r.referrerId === userId).length;
}

// Crédite la commission du parrain à CHAQUE paiement d'abonnement de l'invité.
// Le taux dépend du NOMBRE D'INSCRITS (parrainés) au moment du paiement :
// il faut 100 inscrits pour passer à 5 %, 1000 à 10 %, 10000 à 20 %.
// En dessous de 100 inscrits, le taux réel est 0 % (mais on ne l'affiche pas).
export function recordReferralCommission(payer, payment) {
  if (!payer?.referredBy) return null;
  const referrer = findOne('users', (u) => u.id === payer.referredBy);
  if (!referrer) return null;
  const rate = referralRateFor(referredUsersCount(referrer.id));
  const commission = Math.round(((payment.amount || 0) * rate) / 100);
  return insert('referrals', {
    referrerId: referrer.id,
    referredUserId: payer.id,
    referredName: payer.name,
    referredPhone: payer.phone,
    referredRole: payer.role,
    plan: payment.plan,
    amount: payment.amount,
    priceLabel: payment.priceLabel,
    rate,
    commission,
    reference: payment.reference,
    paidAt: payment.paidAt,
  });
}

// Vue « parrain » : mon code, mes inscrits (palier), mes gains, l'historique
// des commissions + la liste des inscrits avec leur statut.
export function referralInfoFor(user) {
  const referrals = find('users', (u) => u.referredBy === user.id)
    .map((u) => ({
      id: u.id, name: u.name, phone: u.phone, role: u.role,
      createdAt: u.createdAt || 0, subscription: subscriptionFor(u).status,
    }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const earnings = find('referrals', (r) => r.referrerId === user.id).sort((a, b) => b.paidAt - a.paidAt);
  const registeredCount = referrals.length; // inscrits -> palier
  const rate = referralRateFor(registeredCount);
  const totalCommission = earnings.reduce((s, r) => s + (r.commission || 0), 0);
  return {
    code: user.referralCode || '',
    registeredCount,           // utilisateurs inscrits avec son code (palier)
    count: registeredCount,    // alias (palier basé sur les inscrits)
    payments: earnings.length, // nombre de paiements d'abonnement générés
    rate,
    nextTier: referralNextTier(registeredCount),
    totalCommission,
    earnings,
    referrals,
  };
}

// Crée / modifie le code de parrainage personnalisé (unique, libre).
export function setReferralCode(user, raw) {
  const c = String(raw || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(c)) {
    throw Object.assign(new Error('Code invalide : 6 à 12 caractères (lettres/chiffres), sans espace ni accent.'), { status: 400 });
  }
  if (c === (user.referralCode || '')) return c; // inchangé
  const taken = findOne('users', (u) => u.referralCode === c);
  if (taken) throw Object.assign(new Error('Ce code est déjà utilisé par un autre parrain.'), { status: 409 });
  update('users', (u) => u.id === user.id, { referralCode: c });
  return c;
}

// Vue propriétaire : total des commissions à verser + détail par parrain.
export function referralSummary() {
  const rows = find('referrals', () => true);
  const byReferrer = {};
  for (const r of rows) {
    const u = byReferrer[r.referrerId] || (byReferrer[r.referrerId] = { referrerId: r.referrerId, count: 0, totalCommission: 0 });
    u.count += 1;
    u.totalCommission += (r.commission || 0);
  }
  const referrers = Object.values(byReferrer).map((x) => ({
    ...x,
    name: (findOne('users', (u) => u.id === x.referrerId) || {}).name || '',
    phone: (findOne('users', (u) => u.id === x.referrerId) || {}).phone || '',
    rate: referralRateFor(referredUsersCount(x.referrerId)),
  }));
  return {
    totalCommission: rows.reduce((s, r) => s + (r.commission || 0), 0),
    count: rows.length,
    referrers,
  };
}

// Supprime un compte et TOUTES ses données liées (contacts gérant, demandes,
// notifications, paiements d'abonnement, commissions de parrainage).
// Utilisé par le propriétaire (via une clé admin) pour retirer un compte.
export function deleteAccountAll(phone) {
  const u = findOne('users', (x) => x.phone === String(phone).trim());
  if (!u) return { removed: false, error: 'Compte introuvable' };
  const id = u.id;
  remove('users', (x) => x.id === id);
  remove('gerants', (g) => g.ownerId === id || g.userId === id);
  remove('demandes', (d) => d.clientId === id || d.gerantUserId === id);
  remove('notifications', (n) => n.userId === id);
  remove('subscriptions', (s) => s.userId === id);
  remove('referrals', (r) => r.referrerId === id || r.referredUserId === id);
  recordEvent({ type: 'user_deleted', name: u.name, phone: u.phone, role: u.role });
  return { removed: true, name: u.name, phone: u.phone, role: u.role };
}

// ------------------------------------------------------------------
//  JOURNAL D'ACTIVITÉ (entrées / sorties) pour l'Espace propriétaire.
//  Chaque événement clé est enregistré : inscription, paiement,
//  expiration, suppression. Le propriétaire suit ainsi les entrées et
//  sorties d'utilisateurs en direct.
// ------------------------------------------------------------------
export function recordEvent({ type, name = '', phone = '', role = '', amount = 0, plan = '', reference = '' }) {
  return insert('events', {
    type,                 // user_registered | user_deleted | subscription_paid | subscription_expired
    name, phone, role,
    amount, plan, reference,
    createdAt: Date.now(),
  });
}
export function eventsForAdmin(limit = 100) {
  return find('events', () => true).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}
// Compteurs par type d'événement.
export function eventsCounters() {
  const rows = find('events', () => true);
  const c = { total: rows.length };
  for (const type of ['user_registered', 'user_deleted', 'subscription_paid', 'subscription_expired']) {
    c[type] = rows.filter((r) => r.type === type).length;
  }
  return c;
}

// ------------------------------------------------------------------
//  ANALYSE CODES DE PARRAINAGE : combien de codes utilisés à l'inscription,
//  et combien d'utilisateurs rattachés à chaque code.
// ------------------------------------------------------------------
export function referralCodeStats() {
  const users = find('users', () => true);
  const withRef = users.filter((u) => u.referredBy);
  const byCode = {};
  // On retrouve le code d'un utilisateur via son parrain.
  for (const u of withRef) {
    const referrer = findOne('users', (x) => x.id === u.referredBy);
    const code = (referrer?.referralCode || '').trim();
    if (!code) continue;
    byCode[code] = byCode[code] || { code, count: 0, referrerName: referrer.name, referrerPhone: referrer.phone };
    byCode[code].count += 1;
  }
  return {
    registeredWithCode: withRef.length,          // nb d'utilisateurs inscrits via un code
    registeredWithoutCode: users.length - withRef.length,
    uniqueCodesUsed: Object.keys(byCode).length, // nb de codes différents utilisés
    byCode: Object.values(byCode).sort((a, b) => b.count - a.count),
  };
}

// ------------------------------------------------------------------
//  ABONNEMENTS EXPIRÉS : liste des utilisateurs dont l'abonnement est
//  expiré (ne peut plus utiliser le service). Pour que le propriétaire
//  soit informé des « sorties » par expiration.
// ------------------------------------------------------------------
export function expiredUsers() {
  const now = Date.now();
  return find('users', () => true)
    .map((u) => ({ user: u, subscription: subscriptionFor(u) }))
    .filter((x) => x.subscription.status === 'expired')
    .map((x) => ({ id: x.user.id, name: x.user.name, phone: x.user.phone, role: x.user.role, subscribedUntil: x.subscription.subscribedUntil }));
}

// Détecte les abonnements qui viennent d'expirer et enregistre UNE fois
// l'événement dans le journal (pour informer le propriétaire de la sortie).
// Idempotent : ne signale pas deux fois la même expiration.
export function reconcileExpiredEvents() {
  const now = Date.now();
  const expired = find('users', () => true).filter((u) => {
    const s = u.subscription || {};
    return (s.subscribedUntil > 0 && s.subscribedUntil <= now) && !s.expiryNotified;
  });
  for (const u of expired) {
    recordEvent({ type: 'subscription_expired', name: u.name, phone: u.phone, role: u.role });
    const s = { ...(u.subscription || {}) };
    s.expiryNotified = true;
    update('users', (x) => x.id === u.id, { subscription: s });
  }
  return expired.length;
}

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
    .map((u) => ({
      userId: u.id, name: u.name, phone: u.phone, waveNumber: u.waveNumber || u.phone, payLink: u.payLink || '',
      alreadyAdded: added.includes(u.id),
      // "Certifié" : gérant dont la confiance est renforcée (profil lié au compte
      // + lien Wave marchand configuré). À terme : KYC complet / badge vérifié.
      certified: !!(u.certified || u.payLink),
    }))
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
  // L'abonnement doit être valide (essai non expiré ou payé) pour créer une demande.
  if (!serviceAllowed(subscriptionFor(client))) {
    throw Object.assign(new Error('Votre abonnement a expiré. Renouvelez-le pour continuer à envoyer des demandes.'), { status: 403 });
  }
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
  // Le gérant doit avoir un abonnement valide pour traiter (accepter/refuser) les demandes.
  const g = findOne('users', (x) => x.id === gerantUserId);
  if (g && !serviceAllowed(subscriptionFor(g))) {
    throw Object.assign(new Error('Votre abonnement a expiré. Renouvelez-le pour continuer à traiter les demandes.'), { status: 403 });
  }
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
