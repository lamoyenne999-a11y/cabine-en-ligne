import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Card, Pill, Btn } from '../../components/ui';
import { Page } from '../../components/Shell';
import { WavePaySheet } from '../../components/WavePay';
import { useStore } from '../../store';

const STATUS = {
  pending: { label: 'En attente', color: colors.warn, bg: colors.warnBg, icon: 'time' },
  accepted: { label: 'À payer', color: colors.primary, bg: colors.primarySoft, icon: 'card' },
  declined: { label: 'Refusée', color: colors.danger, bg: colors.dangerBg, icon: 'close-circle' },
  paid: { label: 'Payée', color: '#2E7BF6', bg: '#E7F0FE', icon: 'wallet' },
  completed: { label: 'Complétée', color: colors.success, bg: colors.successBg, icon: 'checkmark-circle' },
};

const TYPE_ICON = { unites: 'phone-portrait-outline', minutes: 'call-outline', internet: 'wifi-outline' };
const TYPE_LABEL = { unites: 'Unités', minutes: 'Minutes', internet: 'Internet' };

function summarize(demandes) {
  const counts = { pending: 0, accepted: 0, declined: 0, paid: 0, completed: 0 };
  let totalSpent = 0, totalServed = 0;
  (demandes || []).forEach((d) => {
    if (counts[d.status] !== undefined) counts[d.status] += 1;
    if (d.status === 'paid' || d.status === 'completed') totalSpent += d.amount || 0;
    if (d.status === 'completed') totalServed += d.amount || 0;
  });
  return { count: (demandes || []).length, counts, totalSpent, totalServed };
}

const money = (n) => `${(n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} F`;
const when = (t) => (t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

export default function ClientHistory() {
  const { state, markPaid } = useStore();
  const [paying, setPaying] = useState(null);
  const demandes = state.demandes || [];
  const sum = summarize(demandes);
  const purchases = sum.counts.paid + sum.counts.completed;
  const inProgress = sum.counts.pending + sum.counts.accepted;

  return (
    <Page title="Historique">
      {/* Synthèse */}
      <Card style={s.sumCard}>
        <View style={s.sumTop}>
          <View>
            <T size={font.xs} weight="700" color={colors.muted}>TOTAL DÉPENSÉ</T>
            <T size={font.h1} weight="800" color={colors.primary} style={{ marginTop: 4 }}>{money(sum.totalSpent)}</T>
          </View>
          <View style={s.sumIcon}><Ionicons name="wallet-outline" size={26} color={colors.primary} /></View>
        </View>
        <View style={s.sumGrid}>
          <Tile icon="checkmark-done" tone="green" value={purchases} label="Achats" />
          <Tile icon="time" tone="orange" value={inProgress} label="En cours" />
          <Tile icon="close-circle" tone="blue" value={sum.counts.declined} label="Refusées" />
        </View>
      </Card>

      {/* Transactions */}
      {demandes.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Ionicons name="receipt-outline" size={40} color={colors.muted2} />
          <T size={font.body} weight="700" color={colors.muted} style={{ marginTop: 10 }}>Aucune transaction</T>
          <T size={font.sm} weight="600" color={colors.muted2} style={{ marginTop: 4, textAlign: 'center' }}>
            Vos achats et demandes apparaîtront ici.
          </T>
        </Card>
      ) : demandes.map((d) => {
        const st = STATUS[d.status] || STATUS.pending;
        return (
          <Card key={d.id} style={{ marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.icon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={TYPE_ICON[d.type] || 'phone-portrait-outline'} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <T size={font.body} weight="800" color={colors.text}>{TYPE_LABEL[d.type] || 'Demande'}</T>
                  <T size={font.xs} weight="600" color={colors.muted2} style={{ marginLeft: 8 }}>{when(d.createdAt)}</T>
                </View>
                <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>
                  {d.gerantName || 'Gérant'} · pour {d.benefName}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T size={font.body} weight="800" color={colors.text}>{money(d.amount)}</T>
                <Pill icon={st.icon} color={st.color} bg={st.bg} style={{ marginTop: 6 }}>{st.label}</Pill>
              </View>
            </View>

            {d.status === 'accepted' && (
              <>
                <View style={s.payBox}>
                  <Ionicons name="water" size={18} color={colors.wave} />
                  <T size={font.sm} weight="700" color={colors.wave} style={{ marginLeft: 8, flex: 1 }}>
                    Payez {money(d.amount)} via Wave au marchand {d.gerantWave}
                  </T>
                </View>
                <Btn title="J'ai payé" icon="checkmark" onPress={() => setPaying(d)} style={{ marginTop: space.md }} />
              </>
            )}
            {d.status === 'declined' && (
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 12, textAlign: 'center' }}>
                Le gérant a refusé. Essayez un autre gérant.
              </T>
            )}
            {d.status === 'paid' && (
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 12, textAlign: 'center' }}>
                {d.gerantName} est en train de vous créditer les {TYPE_LABEL[d.type]?.toLowerCase()}.
              </T>
            )}
          </Card>
        );
      })}

      <WavePaySheet
        visible={!!paying}
        onClose={() => setPaying(null)}
        onConfirm={() => { if (paying) markPaid(paying.id); setPaying(null); }}
        title="Payer via Wave"
        amount={paying?.amount}
        merchant={paying?.gerantWave}
        merchantName={paying?.gerantName}
      />
    </Page>
  );
}

function Tile({ icon, tone, value, label }) {
  const tones = {
    green: { bg: colors.successBg, color: colors.success },
    orange: { bg: colors.warnBg, color: colors.warn },
    blue: { bg: '#E7F0FE', color: '#2E7BF6' },
  };
  const t = tones[tone] || tones.blue;
  return (
    <View style={s.tile}>
      <View style={[s.tileIcon, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={16} color={t.color} />
      </View>
      <View>
        <T size={font.h3} weight="800" color={colors.text}>{value}</T>
        <T size={font.xs} weight="600" color={colors.muted}>{label}</T>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sumCard: { marginBottom: space.lg, padding: space.lg },
  sumTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sumIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sumGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
  tile: { flexDirection: 'row', alignItems: 'center' },
  tileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  payBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E7F0FE', borderRadius: radius.md, padding: 12, marginTop: 12 },
});
