import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font } from '../theme';
import { T } from './ui';

// ============================================================
//  Badges d'une cabine, attribués UNIQUEMENT par le propriétaire :
//   - « Certifié »  : gérant vérifié (identité, numéro Wave, sérieux)   → violet
//   - « Officielle » : cabine physique reconnue / partenaire de l'app → doré
//  Une cabine peut cumuler les deux. Affichés partout où le client choisit
//  un gérant, et sur le profil du gérant lui-même.
// ============================================================
export const OFFICIAL = '#B8860B';
export const OFFICIAL_BG = '#FFF4D6';

export function GerantBadges({ certified, official, size = 12, style }) {
  if (!certified && !official) return null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }, style]}>
      {certified ? (
        <View style={[s.badge, { backgroundColor: colors.primary }]}>
          <Ionicons name="shield-checkmark" size={size} color="#fff" />
          <T size={font.xs} weight="800" color="#fff" style={{ marginLeft: 3 }}>Certifié</T>
        </View>
      ) : null}
      {official ? (
        <View style={[s.badge, { backgroundColor: OFFICIAL }]}>
          <Ionicons name="ribbon" size={size} color="#fff" />
          <T size={font.xs} weight="800" color="#fff" style={{ marginLeft: 3 }}>Officielle</T>
        </View>
      ) : null}
    </View>
  );
}

// Étoiles « Cabine En Ligne » (0-5) attribuées par le propriétaire. Rien si 0.
// Compactes : 5 petites étoiles dorées, sans texte, pour ne pas encombrer.
export const STAR = '#F5A623';
export function OwnerStars({ stars, size = 12, style }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(stars) || 0)));
  if (!n) return null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }, style]} accessibilityLabel={`${n} étoiles Cabine En Ligne`}>
      {[1, 2, 3, 4, 5].map((i) => <Ionicons key={i} name={i <= n ? 'star' : 'star-outline'} size={size} color={STAR} />)}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 6, marginVertical: 1 },
});
