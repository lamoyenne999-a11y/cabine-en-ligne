import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Card, ListRow } from '../../components/ui';
import { Page } from '../../components/Shell';
import { useStore } from '../../store';

export default function GerantProfile({ onLogout, onWithdraw }) {
  const { state } = useStore();
  const u = state.user;

  return (
    <Page title="Profil">
      <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
        <View style={s.avatar}>
          <Ionicons name="person" size={48} color="#fff" />
        </View>
        <T size={font.h2} weight="800" color={colors.text} style={{ marginTop: 14 }}>{u?.name || 'Marie Diallo'}</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 3 }}>Gérant CEL</T>
        <View style={s.balPill}>
          <T size={font.xs} weight="700" color={colors.primary}>Solde disponible</T>
          <T size={font.h3} weight="800" color={colors.primary} style={{ marginTop: 2 }}>
            {state.gerantBalance.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF
          </T>
        </View>
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <ListRow icon="call-outline" label="Téléphone" value={u?.phone || '0202020202'} />
        <ListRow icon="mail-outline" label="Email" value={u?.email || 'marie@example.com'} />
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <ListRow icon="wallet-outline" label="Retirer mes gains" onPress={onWithdraw} />
        <ListRow icon="shield-checkmark-outline" label="Sécurité" onPress={() => {}} />
        <ListRow icon="help-circle-outline" label="Aide & Support" onPress={() => {}} />
      </Card>

      <Card
        onPress={onLogout}
        style={{ marginTop: space.lg, backgroundColor: colors.danger, alignItems: 'center', paddingVertical: 16 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="log-out-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
          <T size={font.body} weight="800" color="#fff">Déconnexion</T>
        </View>
      </Card>
    </Page>
  );
}

const s = StyleSheet.create({
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  balPill: { backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: 22, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
});
