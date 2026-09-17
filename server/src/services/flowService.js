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
  const lastPayment = find('subscriptions', (p) => p.userId === user.id && (!p.status || p.status === 'confirmed')).sort((a, b) => b.paidAt - a.paidAt)[0] || null;
  // Déclaration de paiement en attente de vérification par le propriétaire.
  const pending = findOne('subscriptions', (p) => p.userId === user.id && p.status === 'pending');
  const base = {
    plan, price, periodLabel, priceLabel: plans[plan].priceLabel,
    trialEndsAt: s.trialEndsAt, subscribedUntil: s.subscribedUntil,
    lastPayment: lastPayment ? { reference: lastPayment.reference, amount: lastPayment.amount, priceLabel: lastPayment.priceLabel, paidAt: lastPayment.paidAt, validUntil: lastPayment.validUntil, plan: lastPayment.plan } : null,
    pendingPayment: pending ? { reference: pending.reference, amount: pending.amount, priceLabel: pending.priceLabel, plan: pending.plan, declaredAt: pending.declaredAt } : null,
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

// ÉTAPE 1 (utilisateur) : « J'ai payé » → on enregistre une DÉCLARATION de paiement,
// en attente de vérification. L'abonnement n'est PAS activé ici : le propriétaire
// vérifie la réception sur son Wave puis confirme depuis l'Espace propriétaire.
// (Évite qu'un utilisateur s'attribue un abonnement sans payer.)
export function paySubscription(user, plan = SUB_DEFAULT_PLAN) {
  const plans = plansFor(user.role);
  const now = Date.now();
  const conf = plans[plan] || plans[SUB_DEFAULT_PLAN];
  const planKey = conf === plans[plan] ? plan : SUB_DEFAULT_PLAN;

  // Une déclaration déjà en attente pour cet utilisateur ? On la renvoie (pas de doublon).
  const existing = findOne('subscriptions', (p) => p.userId === user.id && p.status === 'pending');
  if (existing) {
    return { subscription: subscriptionFor(user), payment: existing, pending: true, duplicate: true };
  }

  const reference = makeSubscriptionReference();
  const payment = insert('subscriptions', {
    id: 'sub_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    reference,
    status: 'pending',        // pending | confirmed | rejected
    userId: user.id,
    role: user.role,
    name: user.name,
    phone: user.phone,
    plan: planKey,
    amount: conf.price,
    priceLabel: conf.priceLabel,
    declaredAt: now,
    paidAt: 0,                // renseigné à la confirmation
    validUntil: 0,            // renseigné à la confirmation
  });
  recordEvent({ type: 'subscription_declared', name: user.name, phone: user.phone, role: user.role, amount: conf.price, plan: planKey, reference });
  return { subscription: subscriptionFor(user), payment, pending: true };
}

// ÉTAPE 2 (propriétaire) : confirme la réception → active l'abonnement, crédite le
// parrain, journalise et notifie l'utilisateur.
export function confirmSubscriptionPayment(paymentId) {
  const p = findOne('subscriptions', (x) => x.id === paymentId || x.reference === paymentId);
  if (!p) return { ok: false, error: 'Paiement introuvable.' };
  if (p.status === 'confirmed') return { ok: false, error: 'Déjà confirmé.' };
  const user = findOne('users', (u) => u.id === p.userId);
  if (!user) return { ok: false, error: 'Utilisateur introuvable.' };
  const plans = plansFor(user.role);
  const conf = plans[p.plan] || plans[SUB_DEFAULT_PLAN];
  const now = Date.now();
  const s = user.subscription || {};
  const prev = s.subscribedUntil > now ? s.subscribedUntil : now;
  const validUntil = prev + conf.ms;
  const fresh = { status: 'active', plan: p.plan, price: conf.price, trialEndsAt: s.trialEndsAt || now + MONTH_MS, subscribedUntil: validUntil, expiryNotified: false, alerts: null };
  update('users', (u) => u.id === user.id, { subscription: fresh });
  const payment = update('subscriptions', (x) => x.id === p.id, { status: 'confirmed', paidAt: now, validUntil, confirmedAt: now });
  const referralCommission = recordReferralCommission(user, payment);
  recordEvent({ type: 'subscription_paid', name: user.name, phone: user.phone, role: user.role, amount: conf.price, plan: p.plan, reference: p.reference });
  createNotification({
    userId: user.id, type: 'subscription_confirmed',
    text: `Paiement reçu, merci ! Votre abonnement ${conf.label} (${conf.priceLabel}) est actif jusqu'au ${new Date(validUntil).toLocaleDateString('fr-FR')}. Réf. ${p.reference}.`,
  });
  return { ok: true, payment, subscription: subscriptionFor({ ...user, subscription: fresh }), referralCommission };
}

// Le propriétaire n'a rien reçu : la déclaration est rejetée, l'utilisateur est prévenu.
export function rejectSubscriptionPayment(paymentId, note) {
  const p = findOne('subscriptions', (x) => x.id === paymentId || x.reference === paymentId);
  if (!p) return { ok: false, error: 'Paiement introuvable.' };
  if (p.status !== 'pending') return { ok: false, error: 'Ce paiement n\'est plus en attente.' };
  const payment = update('subscriptions', (x) => x.id === p.id, { status: 'rejected', rejectedAt: Date.now(), rejectNote: note || '' });
  createNotification({
    userId: p.userId, type: 'subscription_rejected',
    text: `Nous n'avons pas trouvé votre paiement de ${p.amount} F (réf. ${p.reference}). Vérifiez votre transfert Wave puis déclarez-le à nouveau depuis « S'abonner ».${note ? ' Message : ' + note : ''}`,
  });
  return { ok: true, payment };
}

// Le service est autorisé si l'abonnement est en ESSAI (pas expiré) ou ACTIF.
export function serviceAllowed(subscription) {
  const st = subscription?.status;
  return st === 'active' || st === 'trial';
}

// ---- Vue propriétaire : tous les paiements d'abonnement déclarés ----
export function subscriptionPayments() {
  // Paiements CONFIRMÉS (les anciens enregistrements sans `status` datent d'avant la
  // validation manuelle : ils étaient activés directement, on les garde comme confirmés).
  return find('subscriptions', (p) => !p.status || p.status === 'confirmed').sort((a, b) => b.paidAt - a.paidAt);
}
export function pendingSubscriptionPayments() {
  return find('subscriptions', (p) => p.status === 'pending').sort((a, b) => b.declaredAt - a.declaredAt);
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
// Motifs de suspension (affichés à l'utilisateur suspendu).
export const SUSPEND_REASONS = {
  unpaid_subscription: { label: 'Non-paiement de l\'abonnement', client: true, gerant: true },
  client_unpaid_demandes: { label: 'Demandes traitées non payées (signalé par un gérant)', client: true, gerant: false },
  gerant_not_served: { label: 'Paiement reçu sans traiter la demande ni rembourser (signalé par un client)', client: false, gerant: true },
  other: { label: 'Autre manquement aux règles', client: true, gerant: true },
};
export function suspendReasonText(user, reason, note) {
  const r = SUSPEND_REASONS[reason] || SUSPEND_REASONS.other;
  let how;
  if (reason === 'unpaid_subscription') how = 'Renouvelez votre abonnement depuis votre Profil, puis demandez la réactivation.';
  else if (reason === 'client_unpaid_demandes') how = 'Réglez les demandes en attente de paiement dans votre Historique (bloc Wave du gérant), puis contactez-nous pour la réactivation.';
  else if (reason === 'gerant_not_served') how = 'Servez ou remboursez le client concerné, puis contactez-nous pour la réactivation.';
  else how = 'Contactez-nous pour en discuter.';
  return `Votre compte a été suspendu. Motif : ${r.label}.${note ? ' Précision : ' + note + '.' : ''} ${how} Vous pouvez toujours consulter votre historique et vos notifications.`;
}

export function setUserFrozen(phone, frozen, reason = 'other', note = '') {
  const u = findOne('users', (x) => x.phone === String(phone).trim());
  if (!u) return { ok: false, error: 'Compte introuvable' };
  const patch = frozen
    ? { frozen: true, frozenAt: Date.now(), frozenReason: SUSPEND_REASONS[reason] ? reason : 'other', frozenNote: String(note || '').slice(0, 200) }
    : { frozen: false, frozenAt: 0, frozenReason: '', frozenNote: '' };
  update('users', (x) => x.id === u.id, patch);
  recordEvent({ type: frozen ? 'user_suspended' : 'user_reactivated', name: u.name, phone: u.phone, role: u.role, reason: patch.frozenReason || '' });
  createNotification({
    userId: u.id,
    type: frozen ? 'account_suspended' : 'account_reactivated',
    text: frozen ? suspendReasonText(u, patch.frozenReason, patch.frozenNote) : 'Bonne nouvelle : votre compte a été réactivé. Vous pouvez de nouveau utiliser Cabine En Ligne normalement.',
  });
  return { ok: true, phone: u.phone, name: u.name, role: u.role, frozen: !!frozen, frozenReason: patch.frozenReason, frozenNote: patch.frozenNote };
}

// ---------- Signalements (client → gérant, gérant → client) ----------
// Motifs autorisés selon qui signale. Le signalement est rattaché à UNE demande,
// et l'état de la demande doit rendre le motif plausible (pas de signalement gratuit).
export const REPORT_REASONS = {
  // Client signale un gérant
  paid_not_served: { by: 'client', label: 'J\'ai payé, le gérant ne m\'a pas servi (ni remboursé)' },
  paid_declined_no_refund: { by: 'client', label: 'J\'ai payé, le gérant a refusé / était indisponible mais ne m\'a pas remboursé' },
  // Gérant signale un client
  served_not_paid: { by: 'gerant', label: 'J\'ai servi le client, il n\'a pas payé' },
};
export function createReport({ reporter, demandeId, reason, message = '' }) {
  const r = REPORT_REASONS[reason];
  if (!r || r.by !== reporter.role) throw Object.assign(new Error('Motif de signalement invalide'), { status: 400 });
  const d = findOne('demandes', (x) => x.id === demandeId && (reporter.role === 'client' ? x.clientId === reporter.id : x.gerantUserId === reporter.id));
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  // Cohérence avec l'état réel de la demande
  if (reason === 'paid_not_served' && !(d.moneyReceived && d.status !== 'completed')) {
    throw Object.assign(new Error('Ce motif ne s\'applique que si le gérant a confirmé avoir reçu votre argent sans vous servir.'), { status: 400 });
  }
  if (reason === 'paid_declined_no_refund' && !(d.paidAt && ['declined', 'unavailable'].includes(d.status))) {
    throw Object.assign(new Error('Ce motif ne s\'applique que si vous aviez payé une demande refusée ou indisponible.'), { status: 400 });
  }
  if (reason === 'served_not_paid' && !(d.status === 'completed' && !d.moneyReceived)) {
    throw Object.assign(new Error('Ce motif ne s\'applique que si vous avez servi le client sans recevoir son paiement.'), { status: 400 });
  }
  const dup = findOne('reports', (x) => x.demandeId === d.id && x.reporterId === reporter.id && x.status === 'open');
  if (dup) return { report: dup, duplicate: true };
  const targetId = reporter.role === 'client' ? d.gerantUserId : d.clientId;
  const target = findOne('users', (u) => u.id === targetId);
  const report = insert('reports', {
    status: 'open',            // open | resolved | dismissed
    reason, reasonLabel: r.label,
    message: String(message || '').slice(0, 300),
    demandeId: d.id, demandeType: d.type, amount: d.amount, demandeStatus: d.status,
    reporterId: reporter.id, reporterName: reporter.name, reporterPhone: reporter.phone, reporterRole: reporter.role,
    targetId, targetName: target?.name || (reporter.role === 'client' ? d.gerantName : d.clientName), targetPhone: target?.phone || '', targetRole: reporter.role === 'client' ? 'gerant' : 'client',
    createdAt: Date.now(),
  });
  update('demandes', (x) => x.id === d.id, { reportedAt: Date.now(), reportedBy: reporter.role });
  recordEvent({ type: 'report_created', name: reporter.name, phone: reporter.phone, role: reporter.role, reason, targetName: report.targetName, targetPhone: report.targetPhone });
  // La personne signalée est prévenue (transparence + chance de régulariser avant sanction).
  if (targetId) createNotification({
    userId: targetId, type: 'reported', demandeId: d.id,
    text: reporter.role === 'client'
      ? `${reporter.name} vous a signalé à Cabine En Ligne pour la demande ${TYPE_LABEL[d.type] || d.type} ${d.amount} F : « ${r.label} ». Servez-le ou remboursez-le rapidement ; sans régularisation, votre compte pourra être suspendu.`
      : `${reporter.name} vous a signalé à Cabine En Ligne pour la demande ${TYPE_LABEL[d.type] || d.type} ${d.amount} F : « ${r.label} ». Réglez cette demande rapidement ; sans régularisation, votre compte pourra être suspendu.`,
  });
  return { report, duplicate: false };
}
export function reportsForAdmin() {
  return find('reports', () => true).sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.createdAt - a.createdAt).slice(0, 200);
}
export function openReportsCountFor(userId) {
  return find('reports', (r) => r.targetId === userId && r.status === 'open').length;
}
// Le propriétaire clôture un signalement : 'resolved' (fondé / régularisé) ou 'dismissed' (non fondé).
export function resolveReport(id, decision) {
  const r = findOne('reports', (x) => x.id === id);
  if (!r) return { ok: false, error: 'Signalement introuvable' };
  if (r.status !== 'open') return { ok: false, error: 'Déjà traité' };
  const status = decision === 'dismiss' ? 'dismissed' : 'resolved';
  const upd = update('reports', (x) => x.id === id, { status, resolvedAt: Date.now() });
  createNotification({ userId: r.reporterId, type: 'report_update', demandeId: r.demandeId,
    text: status === 'resolved' ? `Votre signalement concernant ${r.targetName} a été traité par Cabine En Ligne. Merci de contribuer à la confiance sur l'app.` : `Votre signalement concernant ${r.targetName} a été examiné et classé sans suite.` });
  return { ok: true, report: upd };
}

// Disponibilité du gérant (En ligne / Hors ligne), visible par les clients.
export function setGerantAvailability(userId, available) {
  update('users', (x) => x.id === userId, { available: !!available, availableChangedAt: Date.now() });
  return { available: !!available };
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
  if (cur.status === 'active') patch = { ...s, subscribedUntil: (s.subscribedUntil || now) + add, expiryNotified: false, alerts: null };
  else if (cur.status === 'trial') patch = { ...s, status: 'trial', trialEndsAt: (s.trialEndsAt || now) + add, expiryNotified: false, alerts: null };
  else patch = { ...s, status: 'trial', trialEndsAt: now + add, subscribedUntil: 0, expiryNotified: false, alerts: null };
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
  if (u) update('users', (x) => x.id === u.id, { frozen: true, frozenAt: Date.now(), frozenReason: 'other', frozenNote: String(reason || '').slice(0, 200) });
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
  if (u) update('users', (x) => x.id === u.id, { frozen: false, frozenAt: 0, frozenReason: '', frozenNote: '' });
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
  for (const type of ['user_registered', 'user_deleted', 'subscription_declared', 'subscription_paid', 'user_suspended', 'user_reactivated', 'report_created', 'announcement_sent', 'subscription_expired', 'user_blocked', 'user_unblocked', 'unblock_request', 'free_time_granted', 'gerant_certified']) {
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
    type,             // 'new_demande' | 'demande_accepted' | 'payment_requested' | 'demande_declined' | 'demande_unavailable' | 'demande_canceled' | 'demande_paid' | 'demande_received' | 'demande_not_received' | 'demande_partial' | 'client_completed' | 'client_says_full' | 'client_not_served' | 'client_confirmed' | 'demande_served_unpaid' | 'demande_completed'
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
  return { id: u.id, name: u.name, phone: u.phone, role: u.role, waveNumber: u.waveNumber, payLink: u.payLink || '', certified: !!u.certified, rating: u.role === 'gerant' ? gerantRating(u.id) : undefined };
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
        return { ...g, waveNumber: u.waveNumber || g.waveNumber, payLink: u.payLink || g.payLink || '', suspended: !!u.frozen, certified: !!u.certified, online: u.available !== false, rating: gerantRating(u.id) };
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
      alreadyAdded: added.includes(u.id), online: u.available !== false,
      // "Certifié" : badge attribué UNIQUEMENT par le propriétaire (Espace propriétaire).
      certified: !!u.certified,
      rating: gerantRating(u.id),
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
    available: user.available !== false,
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
    status: 'pending',           // pending | accepted | declined | unavailable | paid | completed | canceled
    moneyReceived: false,        // true quand le GÉRANT confirme avoir reçu l'argent (receivedAt)
    createdAt: Date.now(),
    expiresAt: Date.now() + config.demandeExpireMs,
    acceptedAt: 0,
    paidAt: 0,
    canceledAt: 0,
  });
  // Notifie le gérant qu'une nouvelle demande est arrivée
  const forOther = d.benefPhone && d.benefPhone !== client.phone;
  if (g.userId) createNotification({ userId: g.userId, type: 'new_demande', text: `Nouvelle demande de ${client.name} (${client.phone}) — ${TYPE_LABEL[type] || type} ${d.amount} F${forOther ? ` à créditer sur ${d.benefPhone} (une autre personne). Le paiement Wave viendra de ${client.name}.` : ''}`, demandeId: d.id });
  return d;
}

export function demandesForClient(clientId) {
  return find('demandes', (d) => d.clientId === clientId).sort((a, b) => b.createdAt - a.createdAt);
}

export function demandesForGerant(userId) {
  const rows = find('demandes', (d) => d.gerantUserId === userId).sort((a, b) => b.createdAt - a.createdAt);
  // Badge « Client fiable » calculé une fois par client présent dans la liste.
  const cache = new Map();
  return rows.map((d) => {
    if (!cache.has(d.clientId)) cache.set(d.clientId, isReliableClient(d.clientId));
    return { ...d, clientReliable: cache.get(d.clientId) };
  });
}

// ---- Résumé / historique (v2 : on suit les demandes, pas d'argent stocké) ----
export function demandeSummary(demandes) {
  const counts = { pending: 0, accepted: 0, declined: 0, unavailable: 0, paid: 0, completed: 0, canceled: 0 };
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

export function decideDemande({ id, gerantUserId, decision, reason }) {
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
  if (decision === 'unavailable') {
    // Le gérant n'est PAS DISPONIBLE (pas à la cabine / pas de matériel) : ce n'est
    // pas un refus. Le client est invité à choisir un autre gérant. Si le client
    // avait déjà payé, on lui rappelle que le montant doit être remboursé.
    if (!['pending', 'paid'].includes(d.status)) throw Object.assign(new Error('Demande déjà traitée'), { status: 400 });
    const wasPaid = d.status === 'paid';
    const REASONS = { away: 'pas à la cabine actuellement', nomaterial: 'sans son matériel pour le moment', later: 'indisponible pour le moment' };
    const why = REASONS[reason] || REASONS.later;
    update('demandes', (x) => x.id === id, { status: 'unavailable', unavailableReason: reason || 'later', acceptedAt: Date.now() });
    // Le gérant passe « hors ligne » pour les clients (il peut se remettre en ligne depuis son profil).
    update('users', (x) => x.id === gerantUserId, { available: false, availableChangedAt: Date.now() });
    const upd = findOne('demandes', (x) => x.id === id);
    if (upd && upd.clientId) createNotification({
      userId: upd.clientId, type: 'demande_unavailable', demandeId: upd.id,
      text: wasPaid
        ? `${upd.gerantName} n'est pas disponible (${why}) et ne peut pas traiter votre demande ${TYPE_LABEL[upd.type] || upd.type} ${upd.amount} F. Vous aviez déjà payé : le montant doit vous être remboursé par Wave. Contactez-le, ou renvoyez votre demande à un autre gérant.`
        : `${upd.gerantName} n'est pas disponible (${why}) et ne peut pas traiter votre demande ${TYPE_LABEL[upd.type] || upd.type} ${upd.amount} F. Ce n'est pas un refus : renvoyez simplement votre demande à un autre gérant en ligne.`,
    });
    return upd;
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
    if (upd && upd.clientId) createNotification({ userId: upd.clientId, type: 'demande_accepted', text: `${upd.gerantName} a bien reçu votre demande — ${TYPE_LABEL[upd.type] || upd.type}  ${upd.amount} F — et s'en occupe.${upd.status === 'accepted' && !upd.paidAt ? ' Payez via Wave pour qu\'il puisse vous servir.' : ''}`, demandeId: upd.id });
    return upd;
  }
}

export function markPaid({ id, clientId }) {
  const d = findOne('demandes', (x) => x.id === id && x.clientId === clientId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (d.moneyReceived) throw Object.assign(new Error('Le gérant a déjà confirmé la réception de ce paiement'), { status: 400 });
  const now = Date.now();
  if (d.status === 'completed') {
    // Déjà SERVI mais le gérant n'a pas (encore) vu l'argent : le client (re)déclare son
    // paiement. La demande reste « completed » ; on trace la déclaration et on relance
    // le gérant, qui doit trancher : « Argent reçu » (clôture) ou « Pas reçu » (relance).
    const patch = { paidAt: now, clientPaidDeclaredAt: now, clientPaidDeclaredCount: (d.clientPaidDeclaredCount || 0) + 1, notReceivedAt: 0 };
    update('demandes', (x) => x.id === id, patch);
    const upd = findOne('demandes', (x) => x.id === id);
    if (upd && upd.gerantUserId) createNotification({
      userId: upd.gerantUserId, type: 'client_says_paid', demandeId: upd.id,
      text: `${upd.clientName} affirme avoir payé ${upd.amount} F (${TYPE_LABEL[upd.type] || upd.type}, déjà servi)${upd.clientPaidDeclaredCount > 1 ? ' — ' + upd.clientPaidDeclaredCount + 'e fois' : ''}. Vérifiez votre Wave (numéro ${upd.clientPhone || 'du client'}) puis confirmez « Argent reçu » pour clôturer, ou « Pas reçu ».`,
    });
    return upd;
  }
  // Le client peut payer AVANT que le gérant accepte (pending) ou APRÈS (accepted)
  if (!['pending', 'accepted'].includes(d.status)) throw Object.assign(new Error('Cette demande ne peut plus être payée'), { status: 400 });
  update('demandes', (x) => x.id === id, { status: 'paid', paidAt: now, notReceivedAt: 0 });
  const updated = findOne('demandes', (x) => x.id === id);
  // Notifie le gérant que le client a payé
  if (updated && updated.gerantUserId) {
    createNotification({
      userId: updated.gerantUserId,
      type: 'demande_paid',
      text: `${updated.clientName} a payé ${updated.amount} F pour sa demande ${TYPE_LABEL[updated.type] || updated.type}${updated.notReceivedCount ? ' (nouvelle déclaration après votre « Pas reçu » — vérifiez à nouveau votre Wave)' : ''}`,
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
      text: `${upd.gerantName} n'a PAS reçu votre paiement de ${upd.amount} F — ${TYPE_LABEL[upd.type] || upd.type}${upd.notReceivedCount > 1 ? ' (' + upd.notReceivedCount + 'e vérification)' : ''}. Vérifiez dans votre app Wave que le transfert vers ${upd.gerantWave || 'son numéro'} est bien « Réussi » et du bon montant. Si oui, appuyez sur « J'ai bien payé » pour qu'il revérifie ; sinon, payez maintenant. En cas de désaccord persistant, contactez ${upd.gerantName} au ${upd.gerantPhone || upd.gerantWave || ''}.`,
      demandeId: upd.id,
    });
  }
  return upd;
}

// Le gérant demande au client de PAYER AVANT traitement (client avait choisi « Plus tard »).
export function requestPayment({ id, gerantUserId }) {
  const d = findOne('demandes', (x) => x.id === id && x.gerantUserId === gerantUserId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (!['pending', 'accepted'].includes(d.status)) throw Object.assign(new Error('Le client a déjà signalé son paiement'), { status: 400 });
  const patch = { paymentRequestedAt: Date.now(), paymentRequestCount: (d.paymentRequestCount || 0) + 1 };
  if (d.status === 'pending') { patch.status = 'accepted'; patch.acceptedAt = Date.now(); }
  update('demandes', (x) => x.id === id, patch);
  const upd = findOne('demandes', (x) => x.id === id);
  if (upd && upd.clientId) createNotification({
    userId: upd.clientId, type: 'payment_requested', demandeId: upd.id,
    text: `${upd.gerantName} a bien reçu votre demande ${TYPE_LABEL[upd.type] || upd.type} ${upd.amount} F et vous demande de payer d'abord : envoyez ${upd.amount} F (+ frais Wave) au ${upd.gerantWave || 'numéro Wave indiqué'}, puis appuyez sur « J'ai payé ». Il vous servira dès réception.`,
  });
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

// Le client CONFIRME avoir bien reçu sa recharge : clôture définitive, gérant notifié.
export function clientConfirmServed({ id, clientId }) {
  const d = findOne('demandes', (x) => x.id === id && x.clientId === clientId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (d.status !== 'completed') throw Object.assign(new Error('Cette demande n\'est pas marquée comme servie'), { status: 400 });
  if (d.clientConfirmedAt) return d;
  update('demandes', (x) => x.id === id, { clientConfirmedAt: Date.now(), notServedAt: 0 });
  const upd = findOne('demandes', (x) => x.id === id);
  if (upd && upd.gerantUserId) createNotification({
    userId: upd.gerantUserId, type: 'client_confirmed', demandeId: upd.id,
    text: `${upd.clientName} confirme avoir bien reçu ${TYPE_LABEL[upd.type] || upd.type} ${upd.amount} F. Merci pour votre service !`,
  });
  return upd;
}

// Le client conteste : le gérant a marqué « servi » mais le client n'a rien reçu.
// La demande repasse en « à traiter » (paid si l'argent est confirmé/déclaré,
// sinon accepted) et le gérant est notifié. Le client garde la trace (notServedAt).
export function clientNotServed({ id, clientId }) {
  const d = findOne('demandes', (x) => x.id === id && x.clientId === clientId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (d.status !== 'completed') throw Object.assign(new Error('Cette demande n\'est pas marquée comme servie'), { status: 400 });
  const back = (d.moneyReceived || d.paidAt) ? 'paid' : 'accepted';
  update('demandes', (x) => x.id === id, { status: back, completedAt: 0, clientConfirmedAt: 0, notServedAt: Date.now(), notServedCount: (d.notServedCount || 0) + 1 });
  const upd = findOne('demandes', (x) => x.id === id);
  if (upd && upd.gerantUserId) createNotification({
    userId: upd.gerantUserId, type: 'client_not_served', demandeId: upd.id,
    text: `${upd.clientName} indique NE PAS avoir reçu ${TYPE_LABEL[upd.type] || upd.type} ${upd.amount} F (numéro ${upd.benefPhone || ''}). Vérifiez le numéro crédité, servez-le, puis appuyez à nouveau sur « J'ai servi le client ».`,
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
  try { checkGerantMilestone(gerantUserId); } catch {}
  if (upd && upd.clientId) {
    const label = `${TYPE_LABEL[upd.type] || upd.type}  ${upd.amount} F`;
    createNotification({
      userId: upd.clientId,
      type: upd.moneyReceived ? 'demande_completed' : 'demande_served_unpaid',
      text: upd.moneyReceived
        ? (d.notServedAt
          ? `${upd.gerantName} indique vous avoir servi à nouveau — ${label}. Vérifiez votre solde. Si ce n'est toujours pas bon, contactez-le ou signalez-le encore.`
          : `${upd.gerantName} vous a servi — ${label}. Demande complétée. Merci !`)
        : `${upd.gerantName} vous a servi — ${label}. Le paiement n'a pas encore été reçu : merci de régler ${upd.amount} F sur son Wave${upd.gerantWave ? ' (' + upd.gerantWave + ')' : ''}.`,
      demandeId: upd.id,
    });
  }
  return upd;
}

// ------------------------------------------------------------------
//  ALERTES D'ABONNEMENT (automatiques, prudentes, idempotentes)
//  - J-5 et J-1 avant la fin de l'essai ou de l'abonnement, puis le jour de
//    l'expiration. Chaque alerte est envoyée UNE seule fois par période
//    (drapeaux dans user.subscription.alerts, remis à zéro à chaque
//    prolongation : confirmation de paiement, cadeau).
//  - Jamais rétroactif : au 1er déploiement, une échéance dépassée depuis plus
//    de 2 jours est simplement marquée comme déjà traitée (aucune notification).
// ------------------------------------------------------------------
const DAY_MS = 86400000;
function subscriptionDeadline(u) {
  const s = u.subscription || {};
  if (s.status === 'active' && s.subscribedUntil > 0) return { at: s.subscribedUntil, kind: 'active' };
  if ((s.status === 'trial' || !s.status) && s.trialEndsAt > 0) return { at: s.trialEndsAt, kind: 'trial' };
  return null;
}
function alertTexts(u, kind, stage, at) {
  const plans = plansFor(u.role);
  const offer = u.role === 'gerant' ? '200 F/mois ou 2000 F/an' : '100 F/mois ou 1000 F/an';
  const date = new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const what = kind === 'trial' ? 'Votre essai gratuit' : `Votre abonnement ${plans[(u.subscription || {}).plan]?.label || ''}`.trim();
  const consequence = u.role === 'gerant' ? 'vous ne recevrez plus de demandes' : 'vous ne pourrez plus envoyer de demandes';
  const days = Math.max(2, Math.ceil((at - Date.now()) / DAY_MS));
  if (stage === 'd5') return `${what} se termine le ${date} (dans ${days} jours). Pour continuer sans interruption, abonnez-vous depuis votre Profil (${offer}). Paiement Wave, activation après vérification.`;
  if (stage === 'd1') return `${what} se termine demain (${date}). Après cette date, ${consequence}. Abonnez-vous dès maintenant depuis votre Profil (${offer}).`;
  return `${what} a expiré : ${consequence}. Réabonnez-vous en 1 minute depuis votre Profil (${offer}) — votre historique et vos contacts sont conservés.`;
}
export function sendWelcome(user) {
  const text = user.role === 'gerant'
    ? `Bienvenue sur Cabine En Ligne, ${user.name} ! 3 gestes essentiels : 1) Vérifiez votre numéro Wave dans Profil (c'est là que les clients paient). 2) Restez « En ligne » pour recevoir des demandes. 3) Sur chaque demande : Accepter ou « Payer d'abord », puis « Argent reçu » quand Wave confirme. Votre essai gratuit dure 30 jours.`
    : `Bienvenue sur Cabine En Ligne, ${user.name} ! Rechargez à distance en 3 gestes : 1) Choisissez un gérant (les « En ligne » répondent vite). 2) Payez le montant + 1 % de frais sur son Wave. 3) Appuyez sur « J'ai payé » : il vous crédite. Votre essai gratuit dure 30 jours.`;
  return createNotification({ userId: user.id, type: 'welcome', text });
}
export function runSubscriptionAlerts(now = Date.now()) {
  let sent = 0;
  for (const u of find('users', () => true)) {
    if (!u.passwordHash) continue;                    // comptes fantômes
    const dl = subscriptionDeadline(u);
    if (!dl) continue;
    const s = { ...(u.subscription || {}) };
    const key = `${dl.kind}:${dl.at}`;                // période courante
    let alerts = s.alerts && s.alerts.key === key ? { ...s.alerts } : { key };
    const left = dl.at - now;
    const stages = [
      ['d5', left <= 5 * DAY_MS && left > 1 * DAY_MS],
      ['d1', left <= 1 * DAY_MS && left > 0],
      ['expired', left <= 0],
    ];
    let changed = false;
    for (const [stage, due] of stages) {
      if (alerts[stage]) continue;
      // Échéance trop ancienne (ex. 1er déploiement) : on marque sans notifier.
      const stale = stage === 'expired' ? left < -2 * DAY_MS : left <= 0;
      if (due && !stale) {
        createNotification({ userId: u.id, type: stage === 'expired' ? 'alert_expired' : 'alert_expiring', text: alertTexts(u, dl.kind, stage, dl.at) });
        alerts[stage] = now; changed = true; sent++;
      } else if (stale) { alerts[stage] = -1; changed = true; }
      // Une étape « due » englobe les précédentes : si on est à J-1, J-5 est réputé passé.
      if (stage === 'd5' && left <= 1 * DAY_MS && !alerts.d5) { alerts.d5 = -1; changed = true; }
    }
    if (changed) update('users', (x) => x.id === u.id, { subscription: { ...s, alerts } });
  }
  return sent;
}
// Purge des notifications : supprime les notifications LUES de plus de 60 jours,
// et garde au plus 200 notifications par compte (les plus anciennes lues partent
// d'abord ; on ne supprime jamais une notification non lue de moins de 60 jours).
export function purgeOldNotifications(now = Date.now()) {
  const LIMIT = 200, MAX_AGE = 60 * DAY_MS;
  const all = find('notifications', () => true);
  const drop = new Set();
  const byUser = new Map();
  for (const n of all) {
    if (n.read && now - n.createdAt > MAX_AGE) { drop.add(n.id); continue; }
    if (!byUser.has(n.userId)) byUser.set(n.userId, []);
    byUser.get(n.userId).push(n);
  }
  for (const list of byUser.values()) {
    if (list.length <= LIMIT) continue;
    const extra = list.length - LIMIT;
    const candidates = list.filter((n) => n.read).sort((a, b) => a.createdAt - b.createdAt).slice(0, extra);
    for (const n of candidates) drop.add(n.id);
  }
  if (drop.size) remove('notifications', (n) => drop.has(n.id));
  return drop.size;
}
// Démarrage du planificateur (appelé une fois par app.js). Toutes les heures.
let alertsTimer = null;
export function startAlertScheduler() {
  if (alertsTimer) return;
  const tick = () => { try { runSubscriptionAlerts(); reconcileExpiredEvents(); purgeOldNotifications(); } catch (e) { console.error('[alerts]', e.message); } };
  setTimeout(tick, 20 * 1000);                        // 20 s après le démarrage
  alertsTimer = setInterval(tick, 60 * 60 * 1000);
  alertsTimer.unref && alertsTimer.unref();
}

// ------------------------------------------------------------------
//  MESSAGES DU PROPRIÉTAIRE (astuces / alertes / infos) — 100 % manuels.
//  Le propriétaire rédige, choisit la cible, confirme. Chaque destinataire
//  reçoit une notification (+ push). L'envoi est journalisé.
// ------------------------------------------------------------------
export const ANNOUNCE_KINDS = { tip: 'Astuce', alert: 'Alerte', info: 'Information' };
export function announcementAudience(audience, userId = '') {
  if (audience === 'user') return find('users', (u) => u.passwordHash && u.id === String(userId || ''));
  return find('users', (u) => u.passwordHash && (audience === 'all' || u.role === audience));
}
// audience 'user' = un seul destinataire (userId obligatoire).
export function sendAnnouncement({ kind = 'tip', audience = 'all', title = '', text = '', userId = '' }) {
  const k = ANNOUNCE_KINDS[kind] ? kind : 'info';
  const aud = ['all', 'client', 'gerant', 'user'].includes(audience) ? audience : 'all';
  if (aud === 'user' && !userId) return { ok: false, error: 'Choisissez un utilisateur.' };
  const t = String(title || '').trim().slice(0, 60);
  const body = String(text || '').trim().slice(0, 400);
  if (body.length < 10) return { ok: false, error: 'Message trop court (10 caractères minimum).' };
  const targets = announcementAudience(aud, userId);
  if (aud === 'user' && targets.length === 0) return { ok: false, error: 'Utilisateur introuvable.' };
  const target = aud === 'user' ? targets[0] : null;
  const full = t ? `${t} — ${body}` : body;
  for (const u of targets) createNotification({ userId: u.id, type: `announce_${k}`, text: full });
  const a = insert('announcements', { kind: k, audience: aud, title: t, text: body, recipients: targets.length, userId: target?.id || '', userName: target?.name || '', userPhone: target?.phone || '', createdAt: Date.now() });
  recordEvent({ type: 'announcement_sent', name: target ? `${ANNOUNCE_KINDS[k]} → ${target.name}` : ANNOUNCE_KINDS[k], phone: target?.phone || '', role: target?.role || aud, recipients: targets.length });
  return { ok: true, announcement: a };
}
export function announcementsForAdmin() {
  return find('announcements', () => true).sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
}

// ------------------------------------------------------------------
//  ENCOURAGER LES BONS COMPORTEMENTS
//  - Notes ⭐ (client → gérant) après « Bien reçu », 1 à 5, une par demande,
//    modifiable pendant 24 h. Moyenne publique à partir de 3 avis.
//  - Badge « Client fiable » (vu par le gérant) : ≥ 5 demandes payées et
//    confirmées, aucun litige ouvert. Jamais affiché au client lui-même ni public.
//  - Stats gérant (Profil) : semaine / mois.
//  - Jalons : 1re, 10e, 50e, 100e, 500e demande servie → un seul message chacun.
// ------------------------------------------------------------------
export const RATING_MIN_REVIEWS = 3;
export function rateDemande({ id, clientId, stars }) {
  const n = Number(stars);
  if (!Number.isInteger(n) || n < 1 || n > 5) throw Object.assign(new Error('Note invalide (1 à 5)'), { status: 400 });
  const d = findOne('demandes', (x) => x.id === id && x.clientId === clientId);
  if (!d) throw Object.assign(new Error('Demande introuvable'), { status: 404 });
  if (d.status !== 'completed' || !d.clientConfirmedAt) throw Object.assign(new Error('Vous pourrez noter après avoir confirmé « Bien reçu »'), { status: 400 });
  if (d.ratedAt && Date.now() - d.ratedAt > DAY_MS) throw Object.assign(new Error('La note ne peut plus être modifiée (24 h dépassées)'), { status: 400 });
  const first = !d.ratedAt;
  update('demandes', (x) => x.id === id, { rating: n, ratedAt: d.ratedAt || Date.now(), ratingUpdatedAt: Date.now() });
  const upd = findOne('demandes', (x) => x.id === id);
  // Le gérant est prévenu seulement des bonnes notes à la 1re note (encouragement) ; pas de notification pour 1–3 (évite les tensions).
  if (first && n >= 4 && upd.gerantUserId) {
    createNotification({ userId: upd.gerantUserId, type: 'rating_received', demandeId: upd.id, text: `${upd.clientName} vous a donné ${n} étoile${n > 1 ? 's' : ''} ⭐ pour ${TYPE_LABEL[upd.type] || upd.type} ${upd.amount} F. Bravo, continuez !` });
  }
  return upd;
}
// Moyenne d'un gérant. Retourne { avg, count } ; avg = null tant que count < RATING_MIN_REVIEWS.
export function gerantRating(gerantUserId) {
  const rated = find('demandes', (d) => d.gerantUserId === gerantUserId && d.rating > 0);
  const count = rated.length;
  if (count < RATING_MIN_REVIEWS) return { avg: null, count };
  const avg = Math.round((rated.reduce((a, d) => a + d.rating, 0) / count) * 10) / 10;
  return { avg, count };
}
// Client fiable : ≥ 5 demandes complètement clôturées (servi + argent reçu + confirmé) et aucun signalement ouvert contre lui.
export function isReliableClient(clientId) {
  const done = find('demandes', (d) => d.clientId === clientId && d.status === 'completed' && d.moneyReceived && d.clientConfirmedAt).length;
  if (done < 5) return false;
  const openAgainst = find('reports', (r) => r.targetId === clientId && r.status === 'open').length;
  const disputes = find('demandes', (d) => d.clientId === clientId && (d.notReceivedAt || d.clientPaidDeclaredCount > 2)).length;
  return openAgainst === 0 && disputes === 0;
}
// Stats d'un gérant pour son Profil.
export function gerantStats(gerantUserId, now = Date.now()) {
  const all = find('demandes', (d) => d.gerantUserId === gerantUserId);
  const period = (since) => {
    const rows = all.filter((d) => d.createdAt >= since);
    const served = rows.filter((d) => d.status === 'completed');
    const received = served.filter((d) => d.moneyReceived);
    const confirmed = served.filter((d) => d.clientConfirmedAt);
    const answered = rows.filter((d) => d.acceptedAt && d.acceptedAt > d.createdAt);
    const avgResp = answered.length ? Math.round(answered.reduce((a, d) => a + (d.acceptedAt - d.createdAt), 0) / answered.length / 1000) : null;
    return {
      requests: rows.length,
      served: served.length,
      amountServed: served.reduce((a, d) => a + (d.amount || 0), 0),
      amountReceived: received.reduce((a, d) => a + (d.amount || 0), 0),
      confirmRate: served.length ? Math.round((confirmed.length / served.length) * 100) : null,
      avgResponseSec: avgResp,
    };
  };
  const totalServed = all.filter((d) => d.status === 'completed').length;
  return { week: period(now - 7 * DAY_MS), month: period(now - 30 * DAY_MS), totalServed, rating: gerantRating(gerantUserId) };
}
const MILESTONES = [1, 10, 50, 100, 500, 1000];
function checkGerantMilestone(gerantUserId) {
  const u = findOne('users', (x) => x.id === gerantUserId);
  if (!u) return;
  const total = find('demandes', (d) => d.gerantUserId === gerantUserId && d.status === 'completed').length;
  const reached = (u.milestones || []);
  const m = MILESTONES.filter((k) => total >= k && !reached.includes(k)).pop();
  if (!m) return;
  // On ne marque que le palier atteint le plus haut (et tous les inférieurs, sans les notifier).
  update('users', (x) => x.id === gerantUserId, { milestones: [...new Set([...reached, ...MILESTONES.filter((k) => k <= m)])] });
  const text = m === 1
    ? `Première demande servie ! 🎉 Bienvenue parmi les gérants actifs de Cabine En Ligne. Astuce : restez « En ligne » pour en recevoir d'autres.`
    : `Bravo ${u.name} : ${m} demandes servies sur Cabine En Ligne ! 🎉 Merci pour votre sérieux, vos clients comptent sur vous.`;
  createNotification({ userId: gerantUserId, type: 'milestone', text });
}
