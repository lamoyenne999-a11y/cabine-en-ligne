import { Platform } from 'react-native';

// ============================================================
//  Petit stockage clé/valeur.
//  - Web / PWA : localStorage (durable).
//  - Natif     : repli mémoire (non persistant) — on pourra le
//    remplacer par AsyncStorage / expo-secure-store plus tard.
// ============================================================

function canLocalStorage() {
  try {
    return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
  } catch { return false; }
}

const mem = {};

export const storage = {
  get(key) {
    if (canLocalStorage()) {
      try { return window.localStorage.getItem(key); } catch { /* ignore */ }
    }
    return mem[key] ?? null;
  },
  set(key, value) {
    if (canLocalStorage()) {
      try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
    }
    mem[key] = value;
  },
  remove(key) {
    if (canLocalStorage()) {
      try { window.localStorage.removeItem(key); } catch { /* ignore */ }
    }
    delete mem[key];
  },
};
