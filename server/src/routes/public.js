import { Router } from 'express';
import { publicProfile } from '../services/flowService.js';
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

export default router;
