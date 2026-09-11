// ==================================================================
//  Notifications push — fallback générique.
//  La version web (push.web.js) et la version native (push.native.js)
//  sont résolues automatiquement selon la plateforme par Metro/expo.
//  Ce fichier sert de repli si aucune variante n'est trouvée.
// ==================================================================

export function pushSupported() {
  return false;
}

export async function enableNotifications() {
  return { ok: false, reason: 'Les notifications push nécessitent l’application mobile.' };
}

export async function getPushState() {
  return { supported: false, granted: false, subscribed: false, subscription: null };
}

export async function disableNotifications() {
  return { ok: true, endpoint: null, token: null };
}
