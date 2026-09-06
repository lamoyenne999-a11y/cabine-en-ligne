import { Router } from 'express';
import { findOne, find, insert, remove, getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createDemande, subscribe } from '../services/flowService.js';

const router = Router();
router.use(requireAuth, requireRole('client'));

// ----- Gérants connus du client -----
router.get('/gerants', (req, res) => {
  res.json({ gerants: find('gerants', (g) => g.ownerId === req.user.id || true) });
});

router.post('/gerants', (req, res) => {
  const { name, phone } = req.body || {};
  if (!name?.trim() || !phone?.trim()) return res.status(400).json({ error: 'Champs requis' });
  const g = insert('gerants', { ownerId: req.user.id, name: name.trim(), phone: phone.trim(), rating: 3.5, tx: 0, online: true });
  res.status(201).json({ gerant: g });
});

router.delete('/gerants/:id', (req, res) => {
  remove('gerants', (g) => g.id === req.params.id);
  res.json({ ok: true });
});

// ----- Nouvelle demande (paiement direct au gérant via Wave) -----
router.post('/demandes', async (req, res, next) => {
  try {
    const { type, amount, beneficiary, gerantId } = req.body || {};
    const n = parseInt(amount, 10) || 0;
    if (!['unites', 'minutes', 'internet'].includes(type)) {
      return res.status(400).json({ error: 'Type invalide' });
    }
    if (n <= 0) return res.status(400).json({ error: 'Montant invalide' });

    const { demande, checkout } = await createDemande({
      client: req.user, type, amount: n, beneficiary, gerantId,
    });
    res.status(201).json({ demande, checkout });
  } catch (e) { next(e); }
});

// ----- Abonnement (via Wave) -----
router.post('/subscribe', async (req, res, next) => {
  try {
    const { plan, name, amount, renews } = req.body || {};
    const n = parseInt(amount, 10) || 0;
    if (n <= 0) return res.status(400).json({ error: 'Montant invalide' });
    const { checkout, ref } = await subscribe({ client: req.user, plan, name, amount: n, renews });
    res.status(201).json({ checkout, ref });
  } catch (e) { next(e); }
});

router.get('/subscription', (req, res) => {
  const db = getDb();
  res.json({ subscription: db.subscriptions[req.user.id] || null });
});

// ----- Historique / solde -----
router.get('/history', (req, res) => {
  res.json({ transactions: find('transactions', (t) => t.role === 'client' && t.userId === req.user.id) });
});

router.get('/balance', (req, res) => {
  const db = getDb();
  res.json({ balance: db.balances[req.user.id] || 0 });
});

export default router;
