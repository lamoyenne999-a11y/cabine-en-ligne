import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ============================================================
//  Configuration front-end
// ============================================================

// Mode : "auto" -> essaie l'API, retombe sur la démo locale si injoignable.
//        "api"  -> exige l'API.        "mock" -> démo locale, sans réseau.
export const DATA_MODE = 'auto';

const BACKEND_PORT = 4000;

// En production hébergée : on peut fournir l'URL du backend via une
// variable d'environnement injectée au build (expo start --web / EAS).
// Expo expose les variables EXPO_PUBLIC_* dans le bundle.
const ENV_API_URL =
  (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) || '';

// En dev natif, Expo expose l'URL du dev serveur (hostUri) -> on en déduit l'IP.
function devHost() {
  try {
    const hostUri =
      Constants.expoConfig?.hostUri ||
      Constants.expoGoConfig?.debuggerHost ||
      Constants.manifest2?.extra?.expoClient?.hostUri ||
      '';
    if (hostUri) {
      const host = String(hostUri).split(':')[0];
      if (host && host !== 'localhost' && host !== '127.0.0.1') return host;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function detectBaseUrl() {
  // 1) URL explicite fournie par le build (hébergement) -> on l'utilise.
  if (ENV_API_URL) return ENV_API_URL.replace(/\/$/, '');

  // 2) Web : même origine (le serveur de preview proxifie /api). En hébergement
  //    statique, fournir EXPO_PUBLIC_API_URL. Sinon repli sur la démo locale.
  if (Platform.OS === 'web' || typeof window !== 'undefined') return '';

  // 3) Natif : IP de la machine de dev.
  const host = devHost() || 'localhost';
  return `http://${host}:${BACKEND_PORT}`;
}

export const API_URL = detectBaseUrl();
