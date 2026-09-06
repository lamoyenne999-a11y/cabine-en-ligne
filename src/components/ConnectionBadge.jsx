import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, font, radius } from '../theme';
import { T } from './ui';
import { useStore } from '../store';

// Petite pastille indiquant le mode de données (API réelle vs démo locale)
export default function ConnectionBadge({ style }) {
  const { online, checking } = useStore();
  const color = online ? colors.success : colors.muted;
  const bg = online ? colors.successBg : colors.gray;
  const label = checking ? 'Connexion…' : (online ? 'Connecté à l\'API' : 'Mode démo');

  return (
    <View style={[s.wrap, { backgroundColor: bg }, style]}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <T size={11} weight="700" color={color}>{label}</T>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
});
