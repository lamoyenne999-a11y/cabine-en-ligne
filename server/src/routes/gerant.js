import { Router } from 'express';
import { find, findOne, insert, remove, getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { confirmDemande, withdraw } from '../services/flowService.js';

const router = Router();
router.use(requireAuth, requireRole('gerant'));

// ----- Tableau de bord -----
router.get('/dashboard', (req, res) => {
  const db = getDb();
  res.json({
    balance: db.balances[req.user.id] || 0,
    stats: { today: 12, week: 67, month: 245 },
    revenue: { today: 35000, week: 185000, month: 750000 },
  });
});

// ----- Demandes (à traiter) -----
router.get('/demandes', (req, res) => {
  res.json({ demandes: find('demandes', (d) => d.status !== 'complete') });
});

router.post('/demandes/:id/confirm', (req, res) => {
  const { demande, already } = confirmDemande({ demandeId: req.params.id, gerant: req.user });
  res.json({ demande, already });
});

// ----- Clients du gérant -----
router.get('/clients', (req, res) => {
  res.json({ clients: find('clients', (c) => c.ownerId === req.user.id || true) });
});

router.post('/clients', (req, res) => {
  const { name, phone } = req.body || {};
  if (!name?.trim() || !phone?.trim()) return res.status(400).json({ error: 'Champs requis' });
  const c = insert('clients', { ownerId: req.user.id, name: name.trim(), phone: phone.trim(), tx: 0, online: true, added: new Date().toLocaleDateString('fr-FR') });
  res.status(201).json({ client: c });
});

router.delete('/clients/:id', (req, res) => {
  remove('clients', (c) => c.id === req.params.id);
  res.json({ ok: true });
});

// ----- Historique / solde / retrait -----
router.get('/history', (req, res) => {
  res.json({ transactions: find('transactions', (t) => t.role === 'gerant' && t.userId === req.user.id) });
});

router.get('/balance', (req, res) => {
  const db = getDb();
  res.json({ balance: db.balances[req.user.id] || 0 });
});

router.post('/withdraw', async (req, res, next) => {
  try {
    const amount = parseInt(req.body?.amount, 10) || 0;
    const { tx, payout } = await withdraw({ gerant: req.user, amount });
    res.status(201).json({ tx, payout });
  } catch (e) { next(e); }
});

export default router;
