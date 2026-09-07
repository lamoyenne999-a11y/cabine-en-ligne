import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T } from './ui';
import { useStore } from '../store';

// ---------------------------------------------------------------
//  Bannière de connexion / hors-ligne.
//  - "Connexion…"  : le service met un instant à répondre (ex. Render
//    qui "se réveille"). On rassure l'utilisateur au lieu de laisser
//    un écran vide.
//  - Hors ligne     : le service ne répond pas. On prévient clairement
//    et on propose de réessayer. L'app reste utilisable en mode local.
//  - Connecté       : on ne montre rien (pour ne pas encombrer).
// ---------------------------------------------------------------
export default function ConnectionBanner({ style }) {
  const { online, checking, recheck } = useStore();

  // Connecté : pas de bannière.
  if (online) return null;

  if (checking) {
    return (
      <View style={[s.wrap, s.loading, style]}>
        <View style={s.dotLoader} />
        <T size={font.sm} weight="700" color={colors.primary} style={{ flex: 1, marginLeft: 10 }}>
          Connexion au service, un instant…
        </T>
      </View>
    );
  }

  // Hors ligne (le service ne répond pas).
  return (
    <View style={[s.wrap, s.offline, style]}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.danger} style={{ marginRight: 10 }} />
      <T size={font.sm} weight="700" color={colors.danger} style={{ flex: 1 }}>
        Vous êtes hors ligne — vous utilisez les données locales.
      </T>
      <Pressable onPress={recheck} style={({ pressed }) => [s.retry, pressed && { opacity: 0.7 }]}>
        <T size={font.sm} weight="800" color={colors.danger}>Réessayer</T>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginBottom: space.md,
  },
  loading: {
    backgroundColor: colors.primarySoft2,
  },
  offline: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  dotLoader: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: colors.primarySoft2,
    borderTopColor: colors.primary,
  },
  retry: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: '#FBE3E6',
    marginLeft: 8,
  },
});
