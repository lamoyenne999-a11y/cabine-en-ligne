import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initDb } from './db.js';
import { wave } from './services/waveService.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/client.js';
import gerantRoutes from './routes/gerant.js';
import publicRoutes from './routes/public.js';
import webhookRoutes from './routes/webhooks.js';
import { notFound, errorHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// @param {object} opts.staticDir  Dossier du front statique (mode mono-service/deploy).
//                                 S'il est fourni, l'app sert aussi le PWA + fallback SPA.
export async function createApp(opts = {}) {
  await initDb();

  // Les webhooks Wave restent branchés pour le futur mode live.
  wave.onEvent(async () => {});

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok', mode: config.waveMode }));

  // Profils publics (liens de partage) — sans authentification
  app.use('/api/public', publicRoutes);

  // Webhooks Wave
  app.use('/api/webhooks', webhookRoutes);

  // API
  app.use('/api/auth', authRoutes);
  app.use('/api/client', clientRoutes);
  app.use('/api/gerant', gerantRoutes);

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
