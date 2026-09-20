import webpush from 'web-push';
import { getMeta, setMeta, find, findOne, insert, remove } from '../db.js';
import { config } from '../config.js';

// ==================================================================
//  NOTIFICATIONS WEB PUSH — pour la PWA (navigateur) installée.
//  Contrairement au push natif (Expo/APNs/FCM), ici on utilise l'API
//  Web Push : le navigateur s'abonne (clé VAPID) et le serveur envoie
//  via le service de push du navigateur. Fonctionne même app fermée
//  (surtout sur Android Chrome, et sur iPhone avec iOS 16.4+).
//  Les clés VAPID sont générées UNE fois puis persistées en base.
// ==================================================================

const VAPID_KEY = 'pushVapid';
const VAPID_SUBJECT = 'mailto:admin@cabineenligne.com';

function ensureVapid() {
  let keys = getMeta(VAPID_KEY);
  if (!keys || !keys.publicKey || !keys.privateKey) {
    keys = webpush.generateVAPIDKeys();
    setMeta(VAPID_KEY, keys);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  return keys;
}

// Clé publique servant à l'abonnement du navigateur (sans authentification).
export function getVapidPublicKey() {
  return ensureVapid().publicKey;
}

// Enregistre l'abonnement Web Push d'un utilisateur (endpoint + clés).
export function registerWebPushSubscription(userId, subscription) {
  const sub = subscription || {};
  if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    throw Object.assign(new Error('Abonnement push invalide'), { status: 400 });
  }
  const existing = findOne('push_subscriptions', (s) => s.userId === userId && s.endpoint === sub.endpoint);
  if (existing) return existing;
  return insert('push_subscriptions', {
    userId,
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    createdAt: Date.now(),
  });
}

// Supprime l'abonnement Web Push d'un utilisateur (désactivation volontaire).
export function removeWebPushSubscription(userId, endpoint) {
  if (!endpoint) return { removed: 0 };
  const matched = find('push_subscriptions', (s) => s.userId === userId && s.endpoint === endpoint);
  if (matched.length) remove('push_subscriptions', (s) => s.userId === userId && s.endpoint === endpoint);
  return { removed: matched.length };
}

// Envoie une notification à tous les abonnements web d'un utilisateur.
// Fire-and-forget (jamais bloquant) ; supprime les abonnements expirés.
export async function sendWebPushToUser(userId, { title = 'Cabine En Ligne', body = '' }) {
  if (!config.pushEnabled) return { skipped: 'disabled' };
  const subs = find('push_subscriptions', (s) => s.userId === userId);
  if (!subs.length) return { skipped: 'no_subs' };
  try { ensureVapid(); } catch (e) { return { error: e.message }; }
  const results = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify({ title, body }),
      );
      results.push({ endpoint: s.endpoint, ok: true });
    } catch (e) {
      // 404/410 = abonnement expiré/retiré -> on le supprime.
      if (e.statusCode === 404 || e.statusCode === 410) {
        remove('push_subscriptions', (x) => x.id === s.id);
      } else {
        results.push({ endpoint: s.endpoint, ok: false, error: e.message });
      }
    }
  }
  return { sent: results.filter((r) => r.ok).length, results };
}

// ==================================================================
//  NOTIFICATIONS DU PROPRIÉTAIRE (Espace propriétaire)
//  L'Espace propriétaire n'est pas un compte : ses abonnements Web Push
//  sont rattachés à l'identifiant réservé OWNER_ID. Le propriétaire active
//  les notifications depuis l'onglet Système, sur chaque téléphone voulu.
// ==================================================================
export const OWNER_ID = '__owner__';

export function ownerPushCount() {
  return find('push_subscriptions', (s) => s.userId === OWNER_ID).length;
}

// Envoi au propriétaire — jamais bloquant, jamais d'exception.
export function notifyOwner(title, body) {
  return sendWebPushToUser(OWNER_ID, { title: `Propriétaire · ${title}`, body }).catch(() => ({ error: 'push_failed' }));
}
