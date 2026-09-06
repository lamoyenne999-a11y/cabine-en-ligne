import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { demandesForGerant, gerantHistory, demandeSummary, decideDemande, markCompleted, subscriptionFor, activateSubscription, publicProfile } from '../services/flowService.js';

const router = Router();
router.use(requireAuth, requireRole('gerant'));

// ---- Demandes reçues ----
router.get('/demandes', (req, res) => {
  const demandes = demandesForGerant(req.user.id);
  res.json({ demandes, summary: demandeSummary(demandes) });
});

// Historique + synthèse (total servi, demandes traitées)
router.get('/history', (req, res) => res.json(gerantHistory(req.user.id)));

router.post('/demandes/:id/accept', (req, res) => {
  res.json({ demande: decideDemande({ id: req.params.id, gerantUserId: req.user.id, decision: 'accept' }) });
});

router.post('/demandes/:id/decline', (req, res) => {
  res.json({ demande: decideDemande({ id: req.params.id, gerantUserId: req.user.id, decision: 'decline' }) });
});

// Quand le gérant a servi le client (crédité les unités/minutes/internet)
router.post('/demandes/:id/complete', (req, res) => {
  res.json({ demande: markCompleted({ id: req.params.id, gerantUserId: req.user.id }) });
});

// ---- Profil / Wave marchand ----
router.get('/profile', (req, res) => res.json({ user: { name: req.user.name, phone: req.user.phone, waveNumber: req.user.waveNumber } }));

// ---- Abonnement ----
router.get('/subscription', (req, res) => res.json({ subscription: subscriptionFor(req.user) }));
router.post('/subscribe', (req, res) => res.json({ subscription: activateSubscription(req.user) }));

// ---- Profil public ----
router.get('/public/:id', (req, res) => {
  const p = publicProfile(req.params.id);
  if (!p) return res.status(404).json({ error: 'Profil introuvable' });
  res.json({ profile: p });
});

export default router;
