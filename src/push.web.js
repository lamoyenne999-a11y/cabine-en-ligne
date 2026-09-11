// ==================================================================
//  Notifications push — version WEB (PWA installée).
//  Utilise l'API Web Push : le navigateur s'abonne avec la clé VAPID
//  du serveur et enregistre l'abonnement. Les notifications arrivent
//  même si l'app est fermée (surtout sur Android Chrome ; sur iPhone
//  iOS 16.4+ pour une PWA installée sur l'écran d'accueil).
// ==================================================================

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.PushManager !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.serviceWorker &&
    window.isSecureContext
  );
}

// Convertit la clé VAPID (base64url) en Uint8Array pour PushManager.subscribe.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function enableNotifications() {
  try {
    if (!pushSupported()) {
      return { ok: false, reason: 'Ce navigateur ne prend pas en charge les notifications. Essayez Chrome/Edge, ou installez l’app sur l’écran d’accueil.' };
    }
    if (!('Notification' in window)) {
      return { ok: false, reason: 'Les notifications ne sont pas disponibles sur ce navigateur.' };
    }
    const perm = await window.Notification.requestPermission();
    if (perm !== 'granted') {
      return { ok: false, reason: 'Autorisation refusée. Activez les notifications pour ce site dans les réglages.' };
    }

    // Enregistre le service worker (déjà déployé sur /sw.js) et attend qu'il soit actif.
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Récupère la clé publique VAPID du serveur.
    const res = await fetch('/api/public/push-key');
    const { publicKey } = await res.json();
    if (!publicKey) return { ok: false, reason: 'Le serveur push n’est pas configuré.' };

    const existing = await reg.pushManager.getSubscription();
    const subscription = existing || (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

    return { ok: true, subscription: subscription.toJSON() };
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : 'Impossible d’activer les notifications.' };
  }
}

// ==================================================================
//  ÉTAT RÉEL des notifications sur ce navigateur : la permission a-t-elle
//  été accordée ET un abonnement push est-il actif ? C'est la source de
//  vérité du commutateur (il ne doit PAS repasser sur « off » tout seul
//  après un rechargement).
// ==================================================================
export async function getPushState() {
  try {
    if (!pushSupported() || !('Notification' in window)) {
      return { supported: false, granted: false, subscribed: false, subscription: null };
    }
    const granted = window.Notification.permission === 'granted';
    if (!granted) {
      return { supported: true, granted: false, subscribed: false, subscription: null };
    }
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    return {
      supported: true,
      granted: true,
      subscribed: !!subscription,
      subscription: subscription ? subscription.toJSON() : null,
    };
  } catch (e) {
    return { supported: false, granted: false, subscribed: false, subscription: null };
  }
}

// ==================================================================
//  Désactivation VOLONTAIRE : désabonne le navigateur pour que l'utilisateur
//  ne reçoive plus aucune notification push. Renvoie l'endpoint retiré afin
//  que le serveur supprime aussi l'abonnement en base.
// ==================================================================
export async function disableNotifications() {
  try {
    if (!pushSupported()) return { ok: true, endpoint: null };
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      return { ok: true, endpoint };
    }
    return { ok: true, endpoint: null };
  } catch (e) {
    return { ok: false, endpoint: null, reason: e && e.message ? e.message : 'Impossible de désactiver les notifications.' };
  }
}
