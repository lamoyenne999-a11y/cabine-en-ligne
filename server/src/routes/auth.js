import { Router } from 'express';
import { findOne, insert, update } from '../db.js';
import { signToken, hashPassword, verifyPassword, requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { role, name, phone, email, password } = req.body || {};
    if (role !== 'client' && role !== 'gerant') {
      return res.status(400).json({ error: 'Rôle invalide' });
    }
    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({ error: 'Nom et numéro requis' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Mot de passe trop court (min. 4)' });
    }
    if (findOne('users', (u) => u.phone === phone)) {
      return res.status(409).json({ error: 'Ce numéro est déjà utilisé' });
    }

    const user = insert('users', {
      role, name: name.trim(), phone, email: email?.trim() || '',
      passwordHash: await hashPassword(password), createdAt: Date.now(),
    });
    // Solde initial
    const db = (await import('../db.js')).getDb();
    db.balances[user.id] = role === 'gerant' ? 0 : 0;
    (await import('../db.js')).save();

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (e) { next(e); }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body || {};
    const user = findOne('users', (u) => u.phone === String(phone || '').trim());
    if (!user) return res.status(401).json({ error: 'Numéro ou mot de passe incorrect' });

    const ok = await verifyPassword(password || '', user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Numéro ou mot de passe incorrect' });

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (e) { next(e); }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

function publicUser(u) {
  return { id: u.id, role: u.role, name: u.name, phone: u.phone, email: u.email };
}

export default router;
