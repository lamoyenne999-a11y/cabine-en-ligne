// Limiteur de débit minimaliste (en mémoire, sans dépendance).
// Protège les routes sensibles (connexion, inscription, demandes de déblocage)
// contre les essais en rafale : devinette de mot de passe, spam d'inscriptions.
// Connexion : clé = numéro de téléphone uniquement (10 essais / 15 min par compte).
// Inscription / déblocage : clé = IP, avec des plafonds très hauts (300 / 10 min) qui
// n'arrêtent que des robots, jamais un quartier entier derrière la même IP opérateur.
const buckets = new Map();

// perIp=false : la clé ne dépend PAS de l'adresse IP (utile car des milliers d'abonnés
// mobiles partagent la même IP publique : on ne veut jamais les bloquer en bloc).
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 20, keyFn, message, name, perIp = true } = {}) {
  // RATE_LIMIT_DISABLED=true désactive tout ; RATE_LIMIT_SKIP=register,unblock désactive certaines limites (tests).
  const skip = String(process.env.RATE_LIMIT_SKIP || '').split(',').map((x) => x.trim()).filter(Boolean);
  const disabled = process.env.RATE_LIMIT_DISABLED === 'true' || (name && skip.includes(name));
  return (req, res, next) => {
    if (disabled) return next();
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'ip';
    const extra = keyFn ? keyFn(req) : '';
    const key = `${req.baseUrl}${req.path}|${perIp ? ip : ''}|${extra}`;
    let b = buckets.get(key);
    if (!b || now > b.resetAt) { b = { count: 0, resetAt: now + windowMs }; buckets.set(key, b); }
    b.count += 1;
    if (b.count > max) {
      const wait = Math.ceil((b.resetAt - now) / 60000);
      res.set('Retry-After', String(Math.ceil((b.resetAt - now) / 1000)));
      return res.status(429).json({ error: message || `Trop de tentatives. Réessayez dans ${wait} min.` });
    }
    next();
  };
}

// Nettoyage périodique pour ne pas laisser grossir la mémoire.
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k); }, 10 * 60 * 1000).unref();
