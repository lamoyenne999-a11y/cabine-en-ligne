import { Router } from 'express';
import { findOne, insert } from '../db.js';
import { signToken, hashPassword, verifyPassword, requireAuth } from '../middleware/auth.js';
import { subscriptionFor, applyReferral, referralInfoFor, recordEvent } from '../services/flowService.js';

const router = Router();

// POST /api/auth/register  (1 mois d'essai gratuit)
router.post('/register', async (req, res, next) => {
  try {
    const { role, name, phone, email, password, referrerCode } = req.body || {};
    if (role !== 'client' && role !== 'gerant') return res.status(400).json({ error: 'Rôle invalide' });
    if (!name?.trim() || !phone?.trim()) return res.status(400).json({ error: 'Nom et numéro requis' });
    if (!password || password.length < 4) return res.status(400).json({ error: 'Mot de passe trop court (min. 4)' });
    if (findOne('users', (u) => u.phone === phone)) return res.status(409).json({ error: 'Ce numéro est déjà utilisé' });

    const user = insert('users', {
      role, name: name.trim(), phone, email: email?.trim() || '',
      passwordHash: await hashPassword(password),
      waveNumber: phone,
      // Pas de code de parrainage attribué automatiquement : l'utilisateur
      // crée librement le sien (s'il le souhaite) depuis son profil.
      referralCode: '',
      subscription: { status: 'trial', trialEndsAt: Date.now() + 30 * 24 * 3600 * 1000, subscribedUntil: 0 },
      createdAt: Date.now(),
    });

    // Parrainage optionnel : code saisi à l'inscription.
    applyReferral(user, referrerCode);

    // Journal : enregistre l'inscription (entrée) pour l'Espace propriétaire.
    recordEvent({ type: 'user_registered', name: user.name, phone: user.phone, role: user.role });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: publicUser(user),
      subscription: subscriptionFor(user),
      referral: referralInfoFor(user),
    });
  } catch (e) { next(e); }
});

// POST /api/auth/login  (identifiant = numéro de téléphone)
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password, role } = req.body || {};
    const user = findOne('users', (u) => u.phone === String(phone || '').trim());
    if (!user) return res.status(401).json({ error: 'Numéro ou mot de passe incorrect' });
    const ok = await verifyPassword(password || '', user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Numéro ou mot de passe incorrect' });

    // Séparation stricte des rôles : un client ne peut pas se connecter en
    // gérant et inversement. On compare le rôle demandé au rôle du compte.
    if (role && user.role !== role) {
      return res.status(403).json({ error: user.role === 'gerant' ? 'Ce compte est un compte GÉRANT. Connectez-vous dans l\'espace Gérant.' : 'Ce compte est un compte CLIENT. Connectez-vous dans l\'espace Client.' });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user), subscription: subscriptionFor(user), referral: referralInfoFor(user) });
  } catch (e) { next(e); }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user), subscription: subscriptionFor(req.user), referral: referralInfoFor(req.user) });
});

function publicUser(u) {
  return { id: u.id, role: u.role, name: u.name, phone: u.phone, email: u.email, waveNumber: u.waveNumber, payLink: u.payLink || '', referralCode: u.referralCode || '' };
}

export default router;
