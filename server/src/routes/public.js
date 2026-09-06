import { Router } from 'express';
import { publicProfile } from '../services/flowService.js';

const router = Router();

// GET /api/public/u/:id — profil public accessible sans authentification
// (utilisé par les liens de partage)
router.get('/u/:id', (req, res) => {
  const p = publicProfile(req.params.id);
  if (!p) return res.status(404).json({ error: 'Profil introuvable' });
  res.json({ profile: p });
});

export default router;
