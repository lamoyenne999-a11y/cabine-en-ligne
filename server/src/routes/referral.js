import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { referralInfoFor, setReferralCode } from '../services/flowService.js';
import { findOne } from '../db.js';

const router = Router();

// Vue « mon parrainage » : mon code, mes invités, mon taux, mes gains,
// l'historique des commissions + la liste des invités (connecté requis).
router.get('/my', requireAuth, (req, res) => {
  res.json({ referral: referralInfoFor(req.user) });
});

// Crée / modifie mon code de parrainage personnalisé (unique, libre).
router.post('/code', requireAuth, (req, res, next) => {
  try {
    const code = setReferralCode(req.user, req.body?.code);
    const fresh = findOne('users', (u) => u.id === req.user.id); // recharge après MAJ
    res.json({ referral: referralInfoFor(fresh || req.user), code });
  } catch (e) { next(e); }
});

// Vérifie un code de parrainage (utile à l'inscription, sans être connecté).
router.get('/check/:code', (req, res) => {
  const c = String(req.params.code || '').trim().toUpperCase();
  const referrer = findOne('users', (u) => u.referralCode === c);
  if (!referrer) return res.status(404).json({ error: 'Code de parrainage invalide' });
  res.json({ valid: true, name: referrer.name, code: referrer.referralCode });
});

export default router;
