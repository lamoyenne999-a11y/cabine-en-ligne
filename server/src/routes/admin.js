import express from 'express';
import { config } from '../config.js';
import { subscriptionPayments, subscriptionTotals, subscriptionFor, referralSummary, referredUsersCount, referralPaymentCount, referralRateFor, deleteAccountAll, eventsForAdmin, eventsCounters, referralCodeStats, expiredUsers, reconcileExpiredEvents } from '../services/flowService.js';
import { find, findOne, update } from '../db.js';

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
