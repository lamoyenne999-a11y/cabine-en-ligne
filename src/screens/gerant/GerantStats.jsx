import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Card, StatTile } from '../../components/ui';
import { Page } from '../../components/Shell';

const WEEK = [
  { day: 'Lun', v: 12000 },
  { day: 'Mar', v: 18000 },
  { day: 'Mer', v: 15000 },
  { day: 'Jeu', v: 22000 },
  { day: 'Ven', v: 28000 },
  { day: 'Sam', v: 35000 },
  { day: 'Dim', v: 20000 },
];
const MAX = Math.max(...WEEK.map((w) => w.v));
const BAR_H = 120;

export default function GerantStats() {
  return (
    <Page title="Statistiques">
      <T size={font.h2} weight="800" color={colors.text} style={{ marginBottom: space.lg }}>Statistiques détaillées</T>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md }}>
        <StatTile icon="pulse-outline" value="95%" label="Taux de réussite" tone="green" style={{ width: '48%' }} />
        <StatTile icon="people-outline" value="127" label="Clients servis" tone="blue" style={{ width: '48%' }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.xl }}>
        <StatTile icon="logo-usd" value="2 500 000 XOF" label="Revenu total" tone="orange" style={{ width: '48%' }} />
        <StatTile icon="trending-up" value="+23%" label="Croissance" tone="purple" style={{ width: '48%' }} />
      </View>

      <Card>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.lg }}>Revenus de la semaine</T>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: BAR_H + 34 }}>
          {WEEK.map((w) => {
            const h = (w.v / MAX) * BAR_H;
            return (
              <View key={w.day} style={{ alignItems: 'center', flex: 1 }}>
                <T size={font.xs} weight="700" color={colors.muted2} style={{ marginBottom: 4 }}>{w.v / 1000}k</T>
                <View style={{ height: h, width: 18, borderRadius: 6, backgroundColor: colors.primary }} />
                <T size={font.xs} weight="700" color={colors.muted} style={{ marginTop: 6 }}>{w.day}</T>
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={{ marginTop: space.md, backgroundColor: colors.successBg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="bar-chart-outline" size={20} color={colors.success} />
          <T size={font.body} weight="800" color={colors.success} style={{ marginLeft: 10 }}>Insights</T>
        </View>
        <T size={font.sm} weight="600" color={colors.textSoft} style={{ marginTop: 6 }}>
          Vos revenus ont augmenté de 23% ce mois-ci. Continuez à confirmer vos demandes rapidement !
        </T>
      </Card>
    </Page>
  );
}
