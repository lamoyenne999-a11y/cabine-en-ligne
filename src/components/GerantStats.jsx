import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Card } from './ui';
import { RatingBadge } from './Rating';
import { api } from '../api';

// ============================================================
//  « Mon activité » (Profil gérant) : semaine / mois.
// ============================================================
const fmt = (n) => (n || 0).toLocaleString('fr-FR');
const dur = (sec) => (sec == null ? '—' : sec < 60 ? `${sec} s` : sec < 3600 ? `${Math.round(sec / 60)} min` : `${Math.round(sec / 3600)} h`);

export default function GerantStats() {
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('week');
  useEffect(() => { let on = true; api.gerant.stats().then((r) => on && setStats(r.stats)).catch(() => {}); return () => { on = false; }; }, []);
  if (!stats) return null;
  const p = stats[period] || {};
  const Tile = ({ icon, label, value, color = colors.primary }) => (
    <View style={s.tile}>
      <Ionicons name={icon} size={16} color={color} />
      <T size={font.h3} weight="900" color={colors.text} style={{ marginTop: 4 }}>{value}</T>
      <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center' }}>{label}</T>
    </View>
  );
  return (
    <Card style={{ marginTop: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ flex: 1 }}>Mon activité</T>
        {stats.rating?.avg != null ? <RatingBadge rating={stats.rating} size="md" /> : null}
      </View>
      {stats.rating?.avg == null ? (
        <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 2 }}>
          {stats.rating?.count ? `${stats.rating.count} avis reçu${stats.rating.count > 1 ? 's' : ''} — votre note s'affichera à partir de 3 avis.` : 'Vos clients peuvent vous noter après chaque demande confirmée.'}
        </T>
      ) : <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 2 }}>Note moyenne donnée par vos clients ({stats.rating.count} avis).</T>}
      <View style={s.seg}>
        {[['week', '7 derniers jours'], ['month', '30 derniers jours']].map(([k, l]) => (
          <Pressable key={k} onPress={() => setPeriod(k)} style={[s.segBtn, period === k && s.segOn]}>
            <T size={font.xs} weight="800" color={period === k ? '#fff' : colors.muted}>{l}</T>
          </Pressable>
        ))}
      </View>
      <View style={s.grid}>
        <Tile icon="checkmark-done-outline" label="demandes servies" value={fmt(p.served)} color={colors.success} />
        <Tile icon="cash-outline" label="F crédités" value={fmt(p.amountServed)} />
        <Tile icon="timer-outline" label="temps de réponse" value={dur(p.avgResponseSec)} color={colors.warn} />
        <Tile icon="happy-outline" label="clients « Bien reçu »" value={p.confirmRate == null ? '—' : `${p.confirmRate} %`} color={colors.success} />
      </View>
      <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 8 }}>Depuis le début : {fmt(stats.totalServed)} demande{stats.totalServed > 1 ? 's' : ''} servie{stats.totalServed > 1 ? 's' : ''}.</T>
    </Card>
  );
}

const s = StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.pill, padding: 3, marginTop: 10 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.pill },
  segOn: { backgroundColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, marginHorizontal: -4 },
  tile: { width: '50%', paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center' },
});
