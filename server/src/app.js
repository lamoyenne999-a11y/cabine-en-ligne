import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initDb, dbHealth } from './db.js';
import { wave } from './services/waveService.js';
import { startAlertScheduler } from './services/flowService.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/client.js';
import gerantRoutes from './routes/gerant.js';
import referralRoutes from './routes/referral.js';
import publicRoutes from './routes/public.js';
import webhookRoutes from './routes/webhooks.js';
import adminRoutes from './routes/admin.js';
import { notFound, errorHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// @param {object} opts.staticDir  Dossier du front statique (mode mono-service/deploy).
//                                 S'il est fourni, l'app sert aussi le PWA + fallback SPA.
export async function createApp(opts = {}) {
  await initDb();
  // Alertes d'abonnement (J-5, J-1, expiration) : vérification horaire, idempotente.
  if (process.env.ALERTS_DISABLED !== 'true') startAlertScheduler();

  // Les webhooks Wave restent branchés pour le futur mode live.
  wave.onEvent(async () => {});

  const app = express();
  app.set('trust proxy', 1);           // derrière Render : vraie IP du client (pour le rate limit)
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '50kb' }));
  // En-têtes de sécurité de base (sans dépendance)
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    if (req.secure || req.get('x-forwarded-proto') === 'https') res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  });

  app.get('/health', (req, res) => res.json({ status: 'ok', mode: config.waveMode }));

  // Santé de la BASE de données (séparée de /health pour ne rien changer au
  // healthCheckPath de Render). Réveille les bases en veille (Neon/Supabase)
  // quand UptimeRobot la ping toutes les 5 minutes.
  app.get('/health/db', async (req, res) => {
    const h = await dbHealth();
    res.status(h.ok ? 200 : 503).json(h);
  });

  // Profils publics (liens de partage) — sans authentification
  app.use('/api/public', publicRoutes);

  // Webhooks Wave
  app.use('/api/webhooks', webhookRoutes);

  // API
  app.use('/api/auth', authRoutes);
  app.use('/api/client', clientRoutes);
  app.use('/api/gerant', gerantRoutes);
  app.use('/api/referral', referralRoutes);

  // Vue propriétaire (paiements d'abonnement) — protégée par clé admin
  app.use('/api/admin', adminRoutes);

  // Front statique (PWA) + fallback SPA — même origine que l'API (pas de CORS)
  if (opts.staticDir) {
    const index = path.join(opts.staticDir, 'index.html');
    app.use(express.static(opts.staticDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (fs.existsSync(index)) return res.sendFile(index);
      next();
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
