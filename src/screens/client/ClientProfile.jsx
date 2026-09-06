import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Card, ListRow } from '../../components/ui';
import { Page } from '../../components/Shell';
import { useStore } from '../../store';

export default function ClientProfile({ onLogout }) {
  const { state, dispatch } = useStore();
  const u = state.user;

  return (
    <Page title="Profil">
      {/* Identity */}
      <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
        <View style={s.avatar}>
          <Ionicons name="person" size={48} color="#fff" />
        </View>
        <T size={font.h2} weight="800" color={colors.text} style={{ marginTop: 14 }}>{u?.name || 'Jean Dupont'}</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 3 }}>Client CEL</T>
      </Card>

      {/* Contact */}
      <Card style={{ marginTop: space.lg }}>
        <ListRow icon="call-outline" label="Téléphone" value={u?.phone || '0101010101'} />
        <ListRow icon="mail-outline" label="Email" value={u?.email || 'jean@example.com'} />
      </Card>

      {/* Preferences */}
      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Préférences</T>
        <View style={s.prefRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="eye-outline" size={20} color={colors.primary} style={{ marginRight: 12 }} />
            <T size={font.body} weight="600" color={colors.text}>Masquer le solde</T>
          </View>
          <Switch
            value={state.hideBalance}
            onValueChange={() => dispatch({ type: 'TOGGLE_HIDE_BALANCE' })}
            trackColor={{ true: colors.primary, false: colors.gray }}
            thumbColor="#fff"
          />
        </View>
        <View style={s.prefRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Ionicons name="settings-outline" size={20} color={colors.primary} style={{ marginRight: 12 }} />
            <T size={font.body} weight="600" color={colors.text}>Notifications</T>
          </View>
          <Switch
            value={state.notifications}
            onValueChange={() => dispatch({ type: 'TOGGLE_NOTIFICATIONS' })}
            trackColor={{ true: colors.primary, false: colors.gray }}
            thumbColor="#fff"
          />
        </View>
      </Card>

      {/* Autres */}
      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Autres</T>
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
  prefRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
});
