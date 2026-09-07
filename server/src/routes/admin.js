import express from 'express';
import { config } from '../config.js';
import { subscriptionPayments, subscriptionTotals, subscriptionFor, referralSummary, referredUsersCount, referralRateFor } from '../services/flowService.js';
import { find } from '../db.js';

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
  res.json({ payments, totals: subscriptionTotals(), referral: referralSummary() });
});

// Liste des comptes + statut d'abonnement + infos de parrainage.
router.get('/users', requireAdmin, (req, res) => {
  const users = find('users', () => true).map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    referralCode: u.referralCode || '',
    referredBy: u.referredBy || '',
    referredCount: referredUsersCount(u.id),
    rate: referralRateFor(referredUsersCount(u.id)),
    subscription: subscriptionFor(u),
  }));
  res.json({ users });
});

export default router;
