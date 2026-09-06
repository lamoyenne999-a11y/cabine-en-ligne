import { Router } from 'express';
import express from 'express';
import { wave } from '../services/waveService.js';

const router = Router();

// POST /api/webhooks/wave
// Reçoit les événements Wave réels. La signature HMAC est vérifiée.
router.post('/wave', express.raw({ type: '*/*' }), async (req, res) => {
  const signature = req.headers['x-wave-signature'] || req.headers['x-signature'] || '';
  try {
    const event = await wave.handleWebhook(req.body.toString('utf8'), signature);
    res.json({ ok: true, event: event?.type || 'received' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
