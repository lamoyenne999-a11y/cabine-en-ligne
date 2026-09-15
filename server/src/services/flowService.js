import { getDb, save, insert, findOne, find, update, remove } from '../db.js';
import { config } from '../config.js';
import { sendWebPushToUser } from './pushService.js';

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
export const TYPE_LABEL = { unites: 'Unités', minutes: 'Minutes', internet: 'Internet', forfait: 'Appel + Internet' };

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
  // On retire aussi les abonnements push de ses appareils : plus aucune
  // notification ne doit partir vers un compte supprimé.
  remove('push_tokens', (t) => t.userId === id);
  remove('push_subscriptions', (s) => s.userId === id);
  recordEvent({ type: 'user_deleted', name: u.name, phone: u.phone, role: u.role });
  return { removed: true, name: u.name, phone: u.phone, role: u.role };
}

// Suspend / réactive un compte (bloque les activités sans supprimer les données).
// Réservé au propriétaire : utile pour stopper un utilisateur qui ne paie pas,
// mais réversible (on peut le réactiver ensuite).
export function setUserFrozen(phone, frozen) {
  const u = findOne('users', (x) => x.phone === String(phone).trim());
  if (!u) return { ok: false, error: 'Compte introuvable' };
  update('users', (x) => x.id === u.id, { frozen: !!frozen });
  return { ok: true, phone: u.phone, name: u.name, role: u.role, frozen: !!frozen };
}

// Certification d'un gérant : badge « Certifié » visible par les clients.
export function setUserCertified(phone, certified) {
  const u = findOne('users', (x) => x.phone === String(phone).trim());
  if (!u) return { ok: false, error: 'Compte introuvable' };
  if (u.role !== 'gerant') return { ok: false, error: 'Seul un gérant peut être certifié' };
  update('users', (x) => x.id === u.id, { certified: !!certified, certifiedAt: certified ? Date.now() : 0 });
  recordEvent({ type: certified ? 'gerant_certified' : 'gerant_uncertified', name: u.name, phone: u.phone, role: u.role });
  createNotification({
    userId: u.id,
    type: certified ? 'certified' : 'uncertified',
    text: certified
      ? 'Félicitations ! Votre cabine est désormais « Certifiée » : les clients voient votre badge de confiance.'
      : 'Votre badge « Certifié » a été retiré par l\'administration.',
  });
  return { ok: true, phone: u.phone, name: u.name, certified: !!certified };
}

// Offrir du temps gratuit (récompense / reconduction d'essai) : { days }.
//  - Essai en cours  : on prolonge la fin d'essai.
//  - Abonnement actif: on prolonge la date de fin d'abonnement.
//  - Expiré          : on rouvre une période gratuite (statut « trial ») à partir d'aujourd'hui.
export function grantFreeTime(phone, days, note = '') {
  const n = parseInt(days, 10);
  if (!(n > 0) || n > 3660) throw Object.assign(new Error('Durée invalide (1 à 3660 jours)'), { status: 400 });
  const u = findOne('users', (x) => x.phone === String(phone).trim());
  if (!u) return { ok: false, error: 'Compte introuvable' };
  const now = Date.now();
  const add = n * 86400000;
  const cur = subscriptionFor(u);
  const s = u.subscription || {};
  let patch;
  if (cur.status === 'active') patch = { ...s, subscribedUntil: (s.subscribedUntil || now) + add, expiryNotified: false };
  else if (cur.status === 'trial') patch = { ...s, status: 'trial', trialEndsAt: (s.trialEndsAt || now) + add, expiryNotified: false };
  else patch = { ...s, status: 'trial', trialEndsAt: now + add, subscribedUntil: 0, expiryNotified: false };
  update('users', (x) => x.id === u.id, { subscription: patch, lastGift: { days: n, at: now, note } });
  insert('gifts', { userId: u.id, phone: u.phone, name: u.name, role: u.role, days: n, note, createdAt: now });
  recordEvent({ type: 'free_time_granted', name: u.name, phone: u.phone, role: u.role, amount: n });
  const label = n % 30 === 0 ? `${n / 30} mois` : n % 7 === 0 ? `${n / 7} semaine${n / 7 > 1 ? 's' : ''}` : `${n} jour${n > 1 ? 's' : ''}`;
  createNotification({
    userId: u.id,
    type: 'gift',
    text: `Cadeau ! Cabine En Ligne vous offre ${label} d'utilisation gratuite${note ? ' — ' + note : ''}. Profitez-en !`,
  });
  return { ok: true, phone: u.phone, name: u.name, days: n, subscription: subscriptionFor(findOne('users', (x) => x.id === u.id)) };
}
export function giftsForAdmin(limit = 100) {
  return find('gifts', () => true).sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

// ------------------------------------------------------------------
//  BLOCAGE (sanction) — liste noire de numéros de téléphone.
//  Un numéro bloqué ne peut plus se connecter ni se réinscrire, même
//  après suppression du compte. Seul le propriétaire peut débloquer.
// ------------------------------------------------------------------
export function isPhoneBlocked(phone) {
  const p = String(phone || '').trim();
  return !!findOne('blocked', (b) => b.phone === p);
}

export function blockUser({ phone, reason = '' }) {
  const p = String(phone || '').trim();
  if (!p) return { ok: false, error: 'Numéro requis' };
  if (isPhoneBlocked(p)) return { ok: false, error: 'Ce numéro est déjà bloqué' };
  const u = findOne('users', (x) => x.phone === p);
  insert('blocked', {
    phone: p,
    name: u?.name || '',
    role: u?.role || '',
    reason: String(reason || '').slice(0, 300),
    blockedAt: Date.now(),
  });
  // On suspend aussi les activités du compte s'il existe.
  if (u) update('users', (x) => x.id === u.id, { frozen: true });
  recordEvent({ type: 'user_blocked', name: u?.name || '', phone: p, role: u?.role || '' });
  return { ok: true, phone: p, name: u?.name || '', role: u?.role || '' };
}

export function unblockUser({ phone }) {
  const p = String(phone || '').trim();
  const b = findOne('blocked', (x) => x.phone === p);
  if (!b) return { ok: false, error: 'Ce numéro n\'est pas bloqué' };
  remove('blocked', (x) => x.phone === p);
  // On réactive le compte s'il existe encore.
  const u = findOne('users', (x) => x.phone === p);
  if (u) update('users', (x) => x.id === u.id, { frozen: false });
  recordEvent({ type: 'user_unblocked', name: b.name || u?.name || '', phone: p, role: b.role || u?.role || '' });
  return { ok: true, phone: p };
}

export function blockedList() {
  return find('blocked', () => true).sort((a, b) => b.blockedAt - a.blockedAt);
}

// Un utilisateur bloqué (non connecté) dépose une demande de déblocage.
// Un seul en attente par numéro : les doublons sont ignorés.
export function createUnblockRequest({ phone, message = '' }) {
  const p = String(phone || '').trim();
  if (!p) return { ok: false, error: 'Numéro requis' };
  if (!isPhoneBlocked(p)) return { ok: false, error: 'Ce numéro n\'est pas bloqué.' };
  const b = findOne('blocked', (x) => x.phone === p);
  const existing = findOne('unblock_requests', (r) => r.phone === p && r.status === 'pending');
  if (existing) return { ok: true, request: existing, duplicate: true };
  const request = insert('unblock_requests', {
    phone: p,
    name: b?.name || '',
    role: b?.role || '',
    message: String(message || '').slice(0, 600),
    status: 'pending',
    createdAt: Date.now(),
  });
  recordEvent({ type: 'unblock_request', name: b?.name || '', phone: p, role: b?.role || '' });
  return { ok: true, request };
}

export function unblockRequestsPending() {
  return find('unblock_requests', (r) => r.status === 'pending').sort((a, b) => b.createdAt - a.createdAt);
}

// Décision du propriétaire sur une demande de déblocage :
//  - 'unblock' : retire le numéro de la liste noire (le compte redevient utilisable).
//  - 'delete'  : supprime définitivement le compte MAIS garde le numéro bloqué
//               (il ne pourra plus jamais se réinscrire).
export function resolveUnblockRequest(id, decision) {
  const r = findOne('unblock_requests', (x) => x.id === id);
  if (!r) return { ok: false, error: 'Demande introuvable' };
  update('unblock_requests', (x) => x.id === id, {
    status: decision === 'unblock' ? 'approved' : 'rejected',
    resolvedAt: Date.now(),
  });
  if (decision === 'unblock') {
    unblockUser({ phone: r.phone });
  } else if (decision === 'delete') {
    // Suppression définitive : la blacklist reste (on n'appelle PAS unblockUser).
    deleteAccountAll(r.phone);
  } else {
    return { ok: false, error: 'Décision invalide (unblock ou delete)' };
  }
  return { ok: true, id, decision };
}

// ------------------------------------------------------------------
//  JOURNAL D'ACTIVITÉ (entrées / sorties) pour l'Espace propriétaire.
//  Chaque événement clé est enregistré : inscription, paiement,
//  expiration, suppression, blocage. Le propriétaire suit ainsi les
//  entrées et sorties d'utilisateurs en direct.
// ------------------------------------------------------------------
export function recordEvent({ type, name = '', phone = '', role = '', amount = 0, plan = '', reference = '' }) {
  return insert('events', {
    type,                 // user_registered | user_deleted | subscription_paid | subscription_expired | user_blocked | user_unblocked | unblock_request
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
  for (const type of ['user_registered', 'user_deleted', 'subscription_paid', 'subscription_expired', 'user_blocked', 'user_unblocked', 'unblock_request', 'free_time_granted', 'gerant_certified']) {
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
  const n = insert('notifications', {
    userId,
    type,             // 'new_demande' | 'demande_accepted' | 'demande_declined' | 'demande_canceled' | 'demande_paid' | 'demande_received' | 'demande_not_received' | 'demande_partial' | 'client_completed' | 'client_says_full' | 'demande_served_unpaid' | 'demande_completed'
    text,
    demandeId: demandeId || '',
    read: false,
    createdAt: Date.now(),
  });
  // En complément de la notif in-app, on alerte le téléphone de l'utilisateur
  // (si l'appareil a enregistré son jeton et que l'envoi est activé).
  notifyPush(userId, { type, text, demandeId: n.demandeId });
  return n;
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

// ------------------------------------------------------------------
//  NOTIFICATIONS PUSH (Expo) — alerte sur le téléphone de l'utilisateur,
//  en complément de la notification in-app.
//  - L'appareil enregistre son jeton Expo via POST /api/auth/push-token.
//  - À chaque notification créée, on envoie une push à tous les jetons de
//    l'utilisateur, si l'envoi est activé (config.pushEnabled).
//  - L'envoi est "fire-and-forget" : jamais bloquant pour le flux métier.
// ------------------------------------------------------------------
export function registerPushToken(userId, token) {
  const t = String(token || '').trim();
  if (!t) throw Object.assign(new Error('Jeton de notification requis'), { status: 400 });
  const existing = findOne('push_tokens', (p) => p.userId === userId && p.token === t);
  if (existing) return existing;
  return insert('push_tokens', { userId, token: t, createdAt: Date.now() });
}

// Supprime un jeton de notification (désactivation volontaire sur l'appareil).
export function removePushToken(userId, token) {
  if (!token) return { removed: 0 };
  const t = String(token).trim();
  const matched = find('push_tokens', (p) => p.userId === userId && p.token === t);
  if (matched.length) remove('push_tokens', (p) => p.userId === userId && p.token === t);
  return { removed: matched.length };
}

// Envoie une push à tous les appareils enregistrés pour un utilisateur.
export async function sendPushToUser(userId, { title = 'Cabine En Ligne', body = '', data = {} }) {
  if (!config.pushEnabled) return { skipped: 'disabled' };
  const tokens = find('push_tokens', (p) => p.userId === userId).map((p) => p.token);
  if (!tokens.length) return { skipped: 'no_tokens' };
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.expoAccessToken ? { authorization: `Bearer ${config.expoAccessToken}` } : {}),
      },
      body: JSON.stringify({ to: tokens, title, body, data, sound: 'default', channelId: 'default' }),
    });
    const json = await res.json().catch(() => ({}));
    return { sent: tokens.length, receipts: json.data || [] };
  } catch (e) {
    console.error('[push] envoi Expo échoué :', e.message);
    return { error: e.message };
  }
}

// Fire-and-forget : déclenche l'envoi push (natif + web) sans bloquer la notif.
function notifyPush(userId, { type, text, demandeId }) {
  // Push native (app mobile / Expo)
  sendPushToUser(userId, { body: text, data: { type, demandeId } }).catch(() => {});
  // Web Push (PWA installée dans le navigateur)
  sendWebPushToUser(userId, { title: 'Cabine En Ligne', body: text }).catch(() => {});
}

// ---- Public profile (lien de partage) ----
export function publicProfile(id) {
  const u = findOne('users', (x) => x.id === id);
  if (!u) return null;
  return { id: u.id, name: u.name, phone: u.phone, role: u.role, waveNumber: u.waveNumber, payLink: u.payLink || '' };
}

// ---- Gérants (contacts) d'un client ----
export function gerantsFor(clientId) {
  // On enrichit chaque contact avec les coordonnées Wave À JOUR du compte gérant
  // (numéro + lien marchand), pour que le client voie toujours le lien en direct
  // même si le contact a été ajouté avant que le gérant ne configure son lien.
  // Un gérant suspendu par le propriétaire est marqué `suspended` : le client
  // ne peut plus lui envoyer de demande tant que la suspension n'est pas levée.
  return find('gerants', (g) => g.ownerId === clientId).map((g) => {
    if (g.userId) {
      const u = findOne('users', (x) => x.id === g.userId);
      if (u) {
        return { ...g, waveNumber: u.waveNumber || g.waveNumber, payLink: u.payLink || g.payLink || '', suspended: !!u.frozen, certified: !!u.certified };
      }
    }
    return g;
  });
}

// Gérants réellement inscrits sur la plateforme, proposés au client pour
// simplifier sa tâche. On exclut les comptes sans mot de passe (fantômes /
// créés à la volée) pour n'afficher que des gérants enregistrés. Un gérant
// SUSPENDU (frozen) est retiré de la liste : il ne réapparaît que lorsque sa
// suspension est annulée par le propriétaire.
export function availableGerants(clientId) {
  const added = gerantsFor(clientId).map((g) => g.userId);
  return find('users', (u) => u.role === 'gerant' && u.passwordHash && !u.frozen)
    .map((u) => ({
      userId: u.id, name: u.name, phone: u.phone, waveNumber: u.waveNumber || u.phone, payLink: u.payLink || '',
      alreadyAdded: added.includes(u.id),
      // "Certifié" : badge attribué UNIQUEMENT par le propriétaire (Espace propriétaire).
      certified: !!u.certified,
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
  // Compte suspendu par l'administrateur (non-paiement, fraude…) => on bloque les activités.
  if (client.frozen) {
    throw Object.assign(new Error('Votre compte a été suspendu. Contactez l\'administration pour le réactiver.'), { status: 403 });
  }
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
  // Le gérant ciblé peut être suspendu par le propriétaire : on bloque la demande
  // pour qu'il ne reçoive rien tant que sa suspension n'est pas annulée.
  if (g.userId) {
    const gTarget = findOne('users', (x) => x.id === g.userId);
    if (gTarget && gTarget.frozen) {
      throw Object.assign(new Error(`${g.name} est actuellement suspendu. Choisissez un autre gérant.`), { status: 403 });
    }
  }
  if (!['unites', 'minutes', 'internet', 'forfait'].includes(type)) throw Object.assign(new Error('Type invalide'), { status: 400 });
  if (!(parseInt(amount, 10) > 0)) throw Object.assign(new Error('Montant invalide'), { status: 400 });

  // Récupère TOUJOURS le lien Wave marchand À JOUR du gérant (pas un instantané figé).
  // Si le gérant a ajouté/modifié son lien après la création du contact, on le reprend.
  let liveWave = g.waveNumber;
  let livePayLink = g.payLink || '';
  if (g.userId) {
    const guser = findOne('users', (x) => x.id === g.userId);
    if (guser) {
      liveWave = guser.waveNumber || liveWave;
      livePayLink = guser.payLink || '';
    }
  }

  const d = insert('demandes', {
    ref: `demande:${Date.now()}`,
    clientId: client.id,
    clientName: client.name,
    clientPhone: client.phone,
    gerantId: g.id,
    gerantUserId: g.userId || '',
    gerantName: g.name,
    gerantPhone: g.phone,
    gerantWave: liveWave,
    gerantPayLink: livePayLink,
    type,
    amount: parseInt(amount, 10),
    benefName: benefName || client.name,
    benefPhone: benefPhone || client.phone,
    status: 'pending',           // pending | accepted | declined | paid | completed | canceled
    moneyReceived: false,        // true quand le GÉRANT confirme avoir reçu l'argent (receivedAt)
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
  let totalReceived = 0; // somme dont le gérant a CONFIRMÉ la réception
  let awaitingPayment = 0; // demandes servies mais paiement non confirmé
  for (const d of demandes || []) {
    if (counts[d.status] !== undefined) counts[d.status] += 1;
    if (d.status === 'paid' || d.status === 'completed') totalSpent += d.amount || 0;
    if (d.status === 'completed') totalServed += d.amount || 0;
    if (d.moneyReceived) totalReceived += d.amount || 0;
    if (d.status === 'completed' && !d.moneyReceived) awaitingPayment += 1;
  }
  return { count: (demandes || []).length, counts, totalSpent, totalServed, totalReceived, awaitingPayment };
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
  if (g && g.frozen) {
    throw Object.assign(new Error('Votre compte a été suspendu. Contactez l\'administration pour le réactiver.'), { status: 403 });
  }
  if (g && !serviceAllowed(subscriptionFor(g))) {
    throw Object.assign(new Error('Votre abonnement a expiré. Renouvelez-le pour continuer à traiter les demandes.'), { status: 403 });
  }
  if (decision === 'decline') {
    // Le gérant peut refuser UNE DEMANDE EN ATTENTE OU DÉJÀ PAYÉE.
    if (!['pending', 'paid'].includes(d.status)) throw Object.assign(new Error('Impossible de refuser une demande déjà traitée'), { status: 400 });
    const wasPaid = d.status === 'paid';
    update('demandes', (x) => x.id === id, { status: 'declined', acceptedAt: Date.now() });
    const upd = findOne('demandes', (x) => x.id === id);
    if (upd && upd.clientId) createNotification({
      userId: upd.clientId,
      type: 'demande_declined',
      // Si le client avait déjà payé, on lui rappelle que le montant doit lui être remboursé.
      text: wasPaid
        ? `${upd.gerantName} a refusé votre demande — ${TYPE_LABEL[upd.type] || upd.type}  ${upd.amount} F. Vous avez déjà payé via Wave : le montant doit vous être remboursé. Contactez ${upd.gerantName} si besoin.`
        : `${upd.gerantName} a refusé votre demande — ${TYPE_LABEL[upd.type] || upd.type}  ${upd.amount} F`,
      demandeId: upd.id,
    });
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

// Le gérant confirme avoir REÇU l'argent du client sur son Wave.
//  - Demande en attente / acceptée : elle passe « payée » (réception confirmée).
//  - Demande déjà « payée » (déclarée par le client) : réception confirmée, à traiter.
//  - Demande déjà servie (« completed ») sans paiement : elle devient réglée.
// Le client est notifié à chaque fois : il sait où en est sa demande.
export function markReceived({ id, gerantUserId }) {
  const d = findOne('demandes', (x) => x.id === id && x.gerantUserId === gerantUserId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (['declined', 'canceled'].includes(d.status)) throw Object.assign(new Error('Cette demande est refusée ou annulée'), { status: 400 });
  if (d.moneyReceived) return d;
  const patch = { moneyReceived: true, receivedAt: Date.now(), partialAt: 0, clientDisputedAt: 0 };
  if (['pending', 'accepted'].includes(d.status)) { patch.status = 'paid'; patch.paidAt = d.paidAt || Date.now(); if (!d.acceptedAt) patch.acceptedAt = Date.now(); }
  update('demandes', (x) => x.id === id, patch);
  const upd = findOne('demandes', (x) => x.id === id);
  if (upd && upd.clientId) {
    const label = `${TYPE_LABEL[upd.type] || upd.type}  ${upd.amount} F`;
    createNotification({
      userId: upd.clientId,
      type: upd.status === 'completed' ? 'demande_completed' : 'demande_received',
      text: upd.status === 'completed'
        ? `${upd.gerantName} a confirmé la réception de votre paiement — ${label}. Votre demande est entièrement réglée. Merci !`
        : `${upd.gerantName} a bien reçu votre paiement — ${label}. Votre demande est en cours de traitement.`,
      demandeId: upd.id,
    });
  }
  return upd;
}

// Le gérant signale qu'il n'a PAS reçu l'argent alors que le client dit avoir payé.
// La demande repasse « acceptée / à payer » et le client est notifié : il doit
// vérifier son transfert Wave (numéro, montant) ou contacter le gérant.
export function markNotReceived({ id, gerantUserId }) {
  const d = findOne('demandes', (x) => x.id === id && x.gerantUserId === gerantUserId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (d.moneyReceived) throw Object.assign(new Error('Vous avez déjà confirmé la réception de ce paiement'), { status: 400 });
  if (!['paid', 'completed'].includes(d.status)) throw Object.assign(new Error('Le client n\'a pas encore signalé de paiement'), { status: 400 });
  const patch = { moneyReceived: false, notReceivedAt: Date.now(), notReceivedCount: (d.notReceivedCount || 0) + 1 };
  if (d.status === 'paid') { patch.status = 'accepted'; patch.paidAt = 0; if (!d.acceptedAt) patch.acceptedAt = Date.now(); }
  update('demandes', (x) => x.id === id, patch);
  const upd = findOne('demandes', (x) => x.id === id);
  if (upd && upd.clientId) {
    createNotification({
      userId: upd.clientId,
      type: 'demande_not_received',
      text: `${upd.gerantName} n'a PAS reçu votre paiement de ${upd.amount} F — ${TYPE_LABEL[upd.type] || upd.type}. Vérifiez votre transfert Wave (numéro ${upd.gerantWave || 'du gérant'}, montant) puis appuyez à nouveau sur « J'ai payé », ou contactez ${upd.gerantName}.`,
      demandeId: upd.id,
    });
  }
  return upd;
}

// Le gérant a reçu l'argent mais PAS le montant complet (souvent : frais Wave 1 %
// déduits par le client). Le client est notifié du complément à envoyer.
export function markPartial({ id, gerantUserId, received }) {
  const d = findOne('demandes', (x) => x.id === id && x.gerantUserId === gerantUserId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (d.moneyReceived) throw Object.assign(new Error('Vous avez déjà confirmé la réception complète'), { status: 400 });
  if (!['paid', 'completed', 'accepted'].includes(d.status)) throw Object.assign(new Error('Le client n\'a pas encore signalé de paiement'), { status: 400 });
  const total = d.amount || 0;
  let got = parseInt(received, 10);
  if (!(got >= 0) || got >= total) got = Math.round(total * 0.99); // défaut : 1 % manquant
  const missing = total - got;
  update('demandes', (x) => x.id === id, { partialAt: Date.now(), partialReceived: got, partialMissing: missing, clientDisputedAt: 0 });
  const upd = findOne('demandes', (x) => x.id === id);
  if (upd && upd.clientId) createNotification({
    userId: upd.clientId, type: 'demande_partial', demandeId: upd.id,
    text: `${upd.gerantName} a reçu ${got} F au lieu de ${total} F (frais Wave déduits ?). Merci de compléter ${missing} F sur son Wave${upd.gerantWave ? ' (' + upd.gerantWave + ')' : ''}, puis appuyez sur « J'ai complété ».`,
  });
  return upd;
}

// Le client répond après un « montant incomplet » : soit il a complété, soit il
// affirme avoir tout payé. Dans les deux cas le gérant est notifié et revérifie.
export function clientPaymentReply({ id, clientId, kind }) {
  const d = findOne('demandes', (x) => x.id === id && x.clientId === clientId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (!d.partialAt) throw Object.assign(new Error('Aucun montant incomplet signalé pour cette demande'), { status: 400 });
  const full = kind === 'full';
  const patch = full ? { clientDisputedAt: Date.now() } : { partialCompletedAt: Date.now(), clientDisputedAt: 0 };
  if (d.status === 'accepted') { patch.status = 'paid'; patch.paidAt = Date.now(); }
  update('demandes', (x) => x.id === id, patch);
  const upd = findOne('demandes', (x) => x.id === id);
  if (upd && upd.gerantUserId) createNotification({
    userId: upd.gerantUserId, type: full ? 'client_says_full' : 'client_completed', demandeId: upd.id,
    text: full
      ? `${upd.clientName} affirme avoir payé la totalité (${upd.amount} F) pour ${TYPE_LABEL[upd.type] || upd.type}. Vérifiez à nouveau votre Wave puis confirmez « Argent reçu » ou contactez-le.`
      : `${upd.clientName} a complété les ${upd.partialMissing || ''} F manquants pour ${TYPE_LABEL[upd.type] || upd.type} ${upd.amount} F. Vérifiez votre Wave puis confirmez « Argent reçu ».`,
  });
  return upd;
}

// Le gérant a SERVI le client (unités / minutes / internet crédités).
// Possible même si le paiement n'est pas encore confirmé : la demande est
// alors « servie, paiement en attente » et le client est invité à régler.
export function markCompleted({ id, gerantUserId }) {
  const d = findOne('demandes', (x) => x.id === id && x.gerantUserId === gerantUserId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (!['pending', 'accepted', 'paid'].includes(d.status)) throw Object.assign(new Error('Cette demande ne peut plus être servie'), { status: 400 });
  const patch = { status: 'completed', completedAt: Date.now() };
  if (!d.acceptedAt) patch.acceptedAt = Date.now();
  update('demandes', (x) => x.id === id, patch);
  const upd = findOne('demandes', (x) => x.id === id);
  if (upd && upd.clientId) {
    const label = `${TYPE_LABEL[upd.type] || upd.type}  ${upd.amount} F`;
    createNotification({
      userId: upd.clientId,
      type: upd.moneyReceived ? 'demande_completed' : 'demande_served_unpaid',
      text: upd.moneyReceived
        ? `${upd.gerantName} vous a servi — ${label}. Demande complétée. Merci !`
        : `${upd.gerantName} vous a servi — ${label}. Le paiement n'a pas encore été reçu : merci de régler ${upd.amount} F sur son Wave${upd.gerantWave ? ' (' + upd.gerantWave + ')' : ''}.`,
      demandeId: upd.id,
    });
  }
  return upd;
}
