import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initDb } from './db.js';
import { wave } from './services/waveService.js';
import { onWaveEvent } from './services/flowService.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/client.js';
import gerantRoutes from './routes/gerant.js';
import webhookRoutes from './routes/webhooks.js';
import { notFound, errorHandler } from './middleware/error.js';

export async function createApp() {
  await initDb();

  // Branche les événements Wave (webhooks) sur la logique métier
  wave.onEvent(onWaveEvent);

  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health
  app.get('/health', (req, res) => res.json({ status: 'ok', mode: config.waveMode }));

  // Webhooks Wave
  app.use('/api/webhooks', webhookRoutes);

  // API
  app.use('/api/auth', authRoutes);
  app.use('/api/client', clientRoutes);
  app.use('/api/gerant', gerantRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
