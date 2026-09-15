import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { demandesForGerant, gerantHistory, demandeSummary, decideDemande, markCompleted, markReceived, markNotReceived, subscriptionFor, paySubscription, publicProfile, gerantProfile, updateGerantProfile, notificationsFor, unreadCount, markNotificationRead, markAllNotificationsRead } from '../services/flowService.js';

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

// Le gérant confirme avoir reçu l'argent du client (sur son Wave)
router.post('/demandes/:id/received', (req, res) => {
  res.json({ demande: markReceived({ id: req.params.id, gerantUserId: req.user.id }) });
});

// Le gérant signale qu'il n'a PAS reçu l'argent (le client sera notifié)
router.post('/demandes/:id/not-received', (req, res) => {
  res.json({ demande: markNotReceived({ id: req.params.id, gerantUserId: req.user.id }) });
});

// Quand le gérant a servi le client (crédité les unités/minutes/internet)
router.post('/demandes/:id/complete', (req, res) => {
  res.json({ demande: markCompleted({ id: req.params.id, gerantUserId: req.user.id }) });
});

// ---- Profil / Wave marchand ----
router.get('/profile', (req, res) => res.json({ user: gerantProfile(req.user) }));

// Mise à jour du numéro + lien Wave marchand (les clients pourront cliquer pour payer)
router.post('/profile', (req, res) => {
  try {
    const { waveNumber, payLink } = req.body || {};
    const user = updateGerantProfile({ userId: req.user.id, waveNumber, payLink });
    res.json({ user });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---- Notifications reçues ----
router.get('/notifications', (req, res) => res.json({ notifications: notificationsFor(req.user.id), unread: unreadCount(req.user.id) }));
router.post('/notifications/:id/read', (req, res) => {
  try { res.json({ notification: markNotificationRead({ id: req.params.id, userId: req.user.id }) }); }
  catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});
router.post('/notifications/read-all', (req, res) => res.json(markAllNotificationsRead(req.user.id)));

// ---- Abonnement ----
router.get('/subscription', (req, res) => res.json({ subscription: subscriptionFor(req.user) }));
// Enregistre le paiement d'abonnement déclaré + active l'abonnement (durée).
router.post('/subscribe', (req, res) => {
  const out = paySubscription(req.user, req.body?.plan);
  res.json(out); // { subscription, payment }
});

// ---- Profil public ----
router.get('/public/:id', (req, res) => {
  const p = publicProfile(req.params.id);
  if (!p) return res.status(404).json({ error: 'Profil introuvable' });
  res.json({ profile: p });
});

export default router;
