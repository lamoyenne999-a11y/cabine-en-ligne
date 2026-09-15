import express from 'express';
import { config } from '../config.js';
import { setUserCertified, grantFreeTime, giftsForAdmin, subscriptionPayments, subscriptionTotals, subscriptionFor, referralSummary, referredUsersCount, referralPaymentCount, referralRateFor, deleteAccountAll, setUserFrozen, eventsForAdmin, eventsCounters, referralCodeStats, expiredUsers, reconcileExpiredEvents, isPhoneBlocked, blockUser, unblockUser, blockedList, unblockRequestsPending, resolveUnblockRequest } from '../services/flowService.js';
import { find, findOne, update, dbStats } from '../db.js';

const router = express.Router();

// ---------------------------------------------------------------
//  Vue propriétaire (réservé) : qui a payé l'abonnement, combien,
//  quand, valable jusqu'à quelle date, + total reçu déclaré.
//  Le propriétaire utilise ceci pour vérifier que les montants ont
//  bien été reçus sur son compte Wave (payout / relevé).
//  Accès : header `x-admin-key: <ADMIN_KEY>`.
// ---------------------------------------------------------------
function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key') || req.query.key || '';
  if (!config.adminKey || key !== config.adminKey) {
    return res.status(403).json({ error: 'Accès administrateur refusé' });
  }
  next();
}

router.get('/summary', requireAdmin, (req, res) => {
  const payments = subscriptionPayments().map((p) => ({
    reference: p.reference,
    name: p.name,
    phone: p.phone,
    role: p.role,
    plan: p.plan,
    amount: p.amount,
    priceLabel: p.priceLabel,
    paidAt: p.paidAt,
    validUntil: p.validUntil,
  }));
  // Détecte les expirations (sorties) avant de renvoyer la vue.
  reconcileExpiredEvents();
  res.json({
    payments,
    totals: subscriptionTotals(),
    referral: referralSummary(),
    referralCodes: referralCodeStats(),
    events: eventsForAdmin(120),
    eventCounters: eventsCounters(),
    expired: expiredUsers(),
    dbStats: dbStats(),
    unblockRequests: unblockRequestsPending(),
    blocked: blockedList(),
  });
});

// Liste des comptes + statut d'abonnement + infos de parrainage.
// Triée par date d'inscription (les plus récents d'abord) pour suivre
// les entrées d'utilisateurs dans l'Espace propriétaire.
router.get('/users', requireAdmin, (req, res) => {
  const users = find('users', () => true)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      createdAt: u.createdAt || 0,
      referralCode: u.referralCode || '',
      referredBy: u.referredBy || '',
      referredCount: referredUsersCount(u.id),
      paymentsGenerated: referralPaymentCount(u.id),
      rate: referralRateFor(referredUsersCount(u.id)),
      subscription: subscriptionFor(u),
      frozen: !!u.frozen,
      certified: !!u.certified,
      lastGift: u.lastGift || null,
      blocked: isPhoneBlocked(u.phone),
    }));
  res.json({ users });
});

// Supprime un compte + toutes ses données (abonnements, commissions, etc.).
// Réservé au propriétaire pour retirer un compte. Body : { phone }.
router.post('/delete-account', requireAdmin, (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'Téléphone requis' });
  try {
    const out = deleteAccountAll(phone);
    if (!out.removed) return res.status(404).json(out);
    res.json(out);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Certifie / décertifie un gérant. Body : { phone, certified }.
router.post('/set-certified', requireAdmin, (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'Téléphone requis' });
  try {
    const out = setUserCertified(phone, !!req.body?.certified);
    if (!out.ok) return res.status(400).json(out);
    res.json(out);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// Offre du temps gratuit à un utilisateur. Body : { phone, days, note }.
router.post('/grant-free-time', requireAdmin, (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'Téléphone requis' });
  try {
    const out = grantFreeTime(phone, req.body?.days, String(req.body?.note || '').slice(0, 120));
    if (!out.ok) return res.status(404).json(out);
    res.json(out);
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
router.get('/gifts', requireAdmin, (req, res) => res.json({ gifts: giftsForAdmin(200) }));

// Suspend / réactive un compte (bloque les activités sans supprimer les données).
// Réservé au propriétaire. Body : { phone, frozen }.
router.post('/set-frozen', requireAdmin, (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'Téléphone requis' });
  try {
    const out = setUserFrozen(phone, !!req.body?.frozen);
    if (!out.ok) return res.status(404).json(out);
    res.json(out);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Bloque un numéro (liste noire) : il ne peut plus se connecter ni se réinscrire.
// Body : { phone, reason }.
router.post('/block-account', requireAdmin, (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'Téléphone requis' });
  try {
    const out = blockUser({ phone, reason: req.body?.reason });
    if (!out.ok) return res.status(400).json(out);
    res.json(out);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Débloque un numéro (le retire de la liste noire et réactive le compte).
// Body : { phone }.
router.post('/unblock-account', requireAdmin, (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'Téléphone requis' });
  try {
    const out = unblockUser({ phone });
    if (!out.ok) return res.status(400).json(out);
    res.json(out);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Liste des numéros bloqués.
router.get('/blocked', requireAdmin, (req, res) => {
  res.json({ blocked: blockedList() });
});

// Demandes de déblocage en attente (envoyées par les utilisateurs bloqués).
router.get('/unblock-requests', requireAdmin, (req, res) => {
  res.json({ requests: unblockRequestsPending() });
});

// Décision du propriétaire : débloquer ou supprimer définitivement.
// Body : { id, decision: 'unblock' | 'delete' }.
router.post('/resolve-unblock-request', requireAdmin, (req, res) => {
  const id = String(req.body?.id || '');
  const decision = String(req.body?.decision || '');
  if (!id) return res.status(400).json({ error: 'Identifiant de demande requis' });
  try {
    const out = resolveUnblockRequest(id, decision);
    if (!out.ok) return res.status(400).json(out);
    res.json(out);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// Efface le code de parrainage d'un compte (il repart sans code ; l'utilisateur
// pourra créer le sien). Body : { phone }.
router.post('/clear-referral-code', requireAdmin, (req, res) => {
  const phone = String(req.body?.phone || '').trim();
  if (!phone) return res.status(400).json({ error: 'Téléphone requis' });
  const u = findOne('users', (x) => x.phone === phone);
  if (!u) return res.status(404).json({ error: 'Compte introuvable' });
  update('users', (x) => x.id === u.id, { referralCode: '' });
  res.json({ ok: true, phone, referralCode: '' });
});

export default router;
