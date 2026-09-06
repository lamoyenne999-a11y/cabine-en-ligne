import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ============================================================
//  Configuration front-end
// ============================================================

export const DATA_MODE = 'auto';
const BACKEND_PORT = 4000;

const ENV_API_URL =
  (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_URL) || '';

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
  } catch { /* ignore */ }
  return null;
}

function detectBaseUrl() {
  if (ENV_API_URL) return ENV_API_URL.replace(/\/$/, '');
  if (Platform.OS === 'web' || typeof window !== 'undefined') return '';
  const host = devHost() || 'localhost';
  return `http://${host}:${BACKEND_PORT}`;
}

export const API_URL = detectBaseUrl();

// Génère le lien de partage du profil d'un utilisateur.
// En web : même origine (/ ?u=ID). En natif : URL de la machine.
export function buildShareUrl(userId) {
  let base = '';
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    base = window.location.origin;
  } else if (Platform.OS === 'web') {
    base = '';
  } else {
    base = `http://${devHost() || 'localhost'}:${BACKEND_PORT}`;
  }
  return `${base}/?u=${userId}`;
}
