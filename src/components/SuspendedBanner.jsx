import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font } from '../theme';
import { T, Card } from './ui';
import { useStore } from '../store';

// Bannière « COMPTE SUSPENDU » : affichée en haut des écrans principaux quand
// le compte est suspendu par le propriétaire. Explique le motif et comment
// obtenir la réactivation. Ne s'affiche pas sinon.
export default function SuspendedBanner({ style }) {
  const { state } = useStore();
  if (!state.user?.frozen) return null;
  return (
    <Card style={[{ flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.danger, marginBottom: 12 }, style]}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="ban" size={22} color={colors.danger} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <T size={font.xs} weight="700" color={colors.danger}>COMPTE SUSPENDU</T>
        <T size={font.sm} weight="700" color={colors.text} style={{ marginTop: 2 }}>{state.user.frozenText || 'Votre compte a été suspendu par Cabine En Ligne.'}</T>
      </View>
    </Card>
  );
}
