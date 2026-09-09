// ==================================================================
//  Notifications push — version WEB (PWA).
//  Le web ne peut pas recevoir de push « native » via expo-notifications.
//  On affiche un message clair laissant entendre que cette option est
//  réservée à l'application mobile (Expo Go / build EAS).
// ==================================================================

export function pushSupported() {
  return false;
}

export async function enableNotifications() {
  return { ok: false, reason: 'Les notifications push sont réservées à l’application mobile (Expo Go / build EAS).' };
}
