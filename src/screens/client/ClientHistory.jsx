import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Card, StatTile } from '../../components/ui';
import { Page } from '../../components/Shell';
import { useStore } from '../../store';

const iconFor = (type) => ({
  unites: 'phone-portrait-outline', minutes: 'call-outline',
  internet: 'wifi-outline', abonnement: 'sparkles-outline', recharge: 'arrow-up-circle-outline',
  retrait: 'arrow-down-circle-outline',
}[type] || 'swap-horizontal');

const colorFor = (type) => ({
  unites: colors.primary, minutes: '#2E7BF6', internet: colors.warn,
  abonnement: '#7D3CF5', recharge: colors.success, retrait: colors.danger,
}[type] || colors.primary);

function StatusBadge({ status }) {
  if (status === 'reussi') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="checkmark-circle" size={15} color={colors.success} />
        <T size={font.xs} weight="700" color={colors.success} style={{ marginLeft: 5 }}>Réussi</T>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Ionicons name="time" size={15} color={colors.warn} />
      <T size={font.xs} weight="700" color={colors.warn} style={{ marginLeft: 5 }}>En attente</T>
    </View>
  );
}

export default function ClientHistory() {
  const { state } = useStore();
  const txs = state.transactions.filter((t) => t.role === 'client');
  const total = txs.length;
  const ok = txs.filter((t) => t.status === 'reussi').length;
  const wait = total - ok;

  return (
    <Page title="Historique">
      <View style={{ flexDirection: 'row', marginBottom: space.xl }}>
        <StatTile icon="list" value={String(total)} label="Total" />
        <StatTile icon="checkmark-circle" value={String(ok)} label="Réussies" tone="green" style={{ marginHorizontal: space.md }} />
        <StatTile icon="time" value={String(wait)} label="En attente" tone="orange" />
      </View>

      <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.md }}>Transactions récentes</T>

      {txs.map((t) => {
        const c = colorFor(t.type);
        const pos = t.amount >= 0;
        return (
          <Card key={t.id} style={[s.row, { marginBottom: space.sm }]}>
            <View style={[s.icon, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={iconFor(t.type)} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <T size={font.body} weight="800" color={colors.text}>{t.label}</T>
              <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>{t.date}</T>
              {t.pour && <T size={font.xs} weight="600" color={colors.muted}>Pour : {t.pour}</T>}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T size={font.body} weight="800" color={pos ? colors.success : colors.danger}>
                {pos ? '+' : '−'}{Math.abs(t.amount).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF
              </T>
              <View style={{ marginTop: 5 }}>
                <StatusBadge status={t.status} />
              </View>
            </View>
          </Card>
        );
      })}
    </Page>
  );
}

const s = StyleSheet.create({
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
