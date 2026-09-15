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
  demandeExpireMs: Number(process.env.DEMANDE_EXPIRE_MS || 5 * 60 * 1000), // délai de réponse du gérant : 5 min

  // Pays (pour formater les numéros de téléphone en +225, +221, …)
  phonePrefix: process.env.PHONE_PREFIX || '+225',

  // -------- Administration (vue propriétaire des paiements d'abonnement) --------
  // Clé secrète à renseigner dans l'environnement (dashboard Render) pour accéder
  // à GET /api/admin/summary. Si absente, l'admin est désactivé (403).
  adminKey: process.env.ADMIN_KEY || '',

  // -------- Notifications push (Expo) --------
  // PUSH_ENABLED=true active l'envoi de push vers les téléphones (via exp.host).
  // Dans un contexte web/mock cela reste inactif ; sur l'app native (Expo Go /
  // build EAS) les appareils enregistrent leur jeton et reçoivent les alertes.
  pushEnabled: process.env.PUSH_ENABLED === 'true',
  // Jeton d'accès Expo (optionnel, pour un plus gros quota d'envoi).
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || '',
};
