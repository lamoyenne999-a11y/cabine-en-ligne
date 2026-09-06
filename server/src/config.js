import 'dotenv/config';

export const config = {
  port: process.env.PORT || 4000,
  env: process.env.NODE_ENV || 'development',

  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // -------- Wave (mode réel vs mock) --------
  // "mock"  : simule Checkout / Payout / webhooks sans réseau. Parfait pour la démo.
  // "live"  : appelle api.wave.com (nécessite les clés ci-dessous).
  waveMode: process.env.WAVE_MODE || 'mock',
  waveBaseUrl: process.env.WAVE_BASE_URL || 'https://api.wave.com/v1',
  waveApiKey: process.env.WAVE_API_KEY || '',
  waveWebhookSecret: process.env.WAVE_WEBHOOK_SECRET || 'wave-secret-mock',

  // Délai de simulation d'un paiement (ms) avant déclenchement du webhook
  waveMockDelayMs: Number(process.env.WAVE_MOCK_DELAY_MS || 1800),

  // Délai de traitement d'une demande avant que le client puisse l'annuler (ms)
  demandeExpireMs: Number(process.env.DEMANDE_EXPIRE_MS || 30 * 60 * 1000),

  // Pays (pour formater les numéros de téléphone en +225, +221, …)
  phonePrefix: process.env.PHONE_PREFIX || '+225',
};
