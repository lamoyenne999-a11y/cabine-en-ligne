import { Router } from 'express';
import { rateLimit } from '../middleware/rateLimit.js';
import { publicProfile, createUnblockRequest } from '../services/flowService.js';
import { getVapidPublicKey } from '../services/pushService.js';

const router = Router();

// GET /api/public/u/:id — profil public accessible sans authentification
// (utilisé par les liens de partage)
router.get('/u/:id', (req, res) => {
  const p = publicProfile(req.params.id);
  if (!p) return res.status(404).json({ error: 'Profil introuvable' });
  res.json({ profile: p });
});

// GET /api/public/push-key — clé publique VAPID pour l'abonnement Web Push
// du navigateur (une PWA qui s'abonne a besoin de cette clé).
router.get('/push-key', (req, res) => {
  try {
    res.json({ publicKey: getVapidPublicKey() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/public/unblock-request — un utilisateur BLOQUÉ (non connecté)
// dépose une demande de déblocage. Le propriétaire la reçoit dans l'Espace
// propriétaire et décide : débloquer ou supprimer définitivement.
router.post('/unblock-request', rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }), (req, res) => {
  try {
    const { phone, message } = req.body || {};
    const out = createUnblockRequest({ phone, message });
    if (!out.ok) return res.status(out.error === 'Ce numéro n\'est pas bloqué.' ? 400 : 400).json({ error: out.error });
    res.status(out.duplicate ? 200 : 201).json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
