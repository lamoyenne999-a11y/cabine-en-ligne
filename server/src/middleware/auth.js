import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { findOne } from '../db.js';
import { isPhoneBlocked } from '../services/flowService.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

export function hashPassword(pwd) {
  // bcryptjs via import dynamique (module ESM)
  return import('bcryptjs').then((bcrypt) => bcrypt.hashSync(pwd, 10));
}

export function verifyPassword(pwd, hash) {
  return import('bcryptjs').then((bcrypt) =>
    hash ? bcrypt.compareSync(pwd, hash) : pwd.length === 0 && hash === '',
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = findOne('users', (u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
    // Compte bloqué par le propriétaire pendant la session : accès coupé tout de suite.
    if (isPhoneBlocked(user.phone)) return res.status(403).json({ error: 'Votre compte a été bloqué par le propriétaire. Vous pouvez faire une demande de déblocage.', code: 'BLOCKED' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Jeton invalide ou expiré' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    next();
  };
}
