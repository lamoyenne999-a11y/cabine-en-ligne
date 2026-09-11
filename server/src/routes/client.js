import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { gerantsFor, addGerant, removeGerant, createDemande, demandesForClient, clientHistory, demandeSummary, subscriptionFor, paySubscription, publicProfile, markPaid, cancelDemande, notificationsFor, unreadCount, markNotificationRead, markAllNotificationsRead, availableGerants } from '../services/flowService.js';

const router = Router();
router.use(requireAuth, requireRole('client'));

// ---- Mes gérants ----
router.get('/gerants', (req, res) => res.json({ gerants: gerantsFor(req.user.id) }));

// Gérants déjà inscrits, proposés au client
router.get('/gerants/available', (req, res) => res.json({ gerants: availableGerants(req.user.id) }));

router.post('/gerants', (req, res) => {
  try {
    const { phone, name } = req.body || {};
    const { gerant } = addGerant({ clientId: req.user.id, phone, name });
    res.status(201).json({ gerant });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

router.delete('/gerants/:id', (req, res) => {
  removeGerant({ clientId: req.user.id, gerantId: req.params.id });
  res.json({ ok: true });
});

// ---- Demandes (services) ----
router.post('/demandes', (req, res) => {
  try {
    const { gerantId, gerantUserId, type, amount, benefName, benefPhone } = req.body || {};
    const d = createDemande({ client: req.user, gerantId, gerantUserId, type, amount, benefName, benefPhone });
    res.status(201).json({ demande: d });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

router.get('/demandes', (req, res) => {
  const demandes = demandesForClient(req.user.id);
  res.json({ demandes, summary: demandeSummary(demandes) });
});

// Historique + synthèse (total dépensé, stats par statut)
router.get('/history', (req, res) => res.json(clientHistory(req.user.id)));

// Après paiement direct Wave -> le client confirme avoir payé le gérant
router.post('/demandes/:id/paid', (req, res) => {
  try {
    res.json({ demande: markPaid({ id: req.params.id, clientId: req.user.id }) });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

// Annule une demande non traitée à temps
router.post('/demandes/:id/cancel', (req, res) => {
  try {
    res.json({ demande: cancelDemande({ id: req.params.id, clientId: req.user.id }) });
  } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});

// ---- Abonnement (mensuel 100 FCFA / annuel 1000 FCFA) ----
router.get('/subscription', (req, res) => res.json({ subscription: subscriptionFor(req.user) }));
// Enregistre le paiement d'abonnement déclaré + active l'abonnement (durée).
router.post('/subscribe', (req, res) => {
  const out = paySubscription(req.user, req.body?.plan);
  res.json(out); // { subscription, payment }
});

// ---- Notifications reçues par le client ----
router.get('/notifications', (req, res) => {
  const notifications = notificationsFor(req.user.id);
  res.json({ notifications, unread: unreadCount(req.user.id) });
});
router.post('/notifications/:id/read', (req, res) => {
  try { res.json({ notification: markNotificationRead({ id: req.params.id, userId: req.user.id }) }); }
  catch (e) { res.status(e.status || 400).json({ error: e.message }); }
});
router.post('/notifications/read-all', (req, res) => res.json(markAllNotificationsRead(req.user.id)));

// ---- Profil public (lien de partage) ----
router.get('/public/:id', (req, res) => {
  const p = publicProfile(req.params.id);
  if (!p) return res.status(404).json({ error: 'Profil introuvable' });
  res.json({ profile: p });
});

export default router;
