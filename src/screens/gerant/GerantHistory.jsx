import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Card, Pill, Chip } from '../../components/ui';
import { Page } from '../../components/Shell';
import { useStore } from '../../store';

const STATUS = {
  pending: { label: 'En attente', color: colors.warn, bg: colors.warnBg, icon: 'time' },
  accepted: { label: 'Acceptée', color: colors.primary, bg: colors.primarySoft, icon: 'checkmark-circle' },
  declined: { label: 'Refusée', color: colors.danger, bg: colors.dangerBg, icon: 'close-circle' },
  paid: { label: 'Payée', color: '#2E7BF6', bg: '#E7F0FE', icon: 'wallet' },
  completed: { label: 'Complétée', color: colors.success, bg: colors.successBg, icon: 'checkmark-done' },
  canceled: { label: 'Annulée', color: colors.muted, bg: colors.gray, icon: 'close-circle-outline' },
};

const TYPE_ICON = { unites: 'phone-portrait-outline', minutes: 'call-outline', internet: 'wifi-outline', forfait: 'layers-outline' };
const TYPE_LABEL = { unites: 'Unités', minutes: 'Minutes', internet: 'Internet', forfait: 'Forfait' };

function summarize(demandes) {
  const counts = { pending: 0, accepted: 0, declined: 0, paid: 0, completed: 0, canceled: 0 };
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

// Recherche insensible à la casse et aux accents
const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function matches(d, q) {
  if (!q) return true;
  const nq = norm(q);
  const hay = [
    TYPE_LABEL[d.type] || 'Demande',
    STATUS[d.status]?.label || '',
    d.clientName, d.benefName, d.benefPhone,
    when(d.createdAt), money(d.amount), d.id,
  ].map(norm).join(' ');
  return hay.includes(nq);
}

export default function GerantHistory() {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const demandes = state.gerantDemandes || [];
  const sum = summarize(demandes);
  const served = sum.counts.completed;
  const treated = sum.counts.completed + sum.counts.paid + sum.counts.accepted;

  // L'historique est trié par famille (En attente / Traitées / Refusées / Annulées)
  // pour ne jamais mélanger les statuts. La recherche s'applique ensuite.
  const GROUPS = [
    { value: 'all', label: `Toutes (${demandes.length})` },
    { value: 'pending', label: `En attente (${sum.counts.pending})` },
    { value: 'treated', label: `Traitées (${sum.counts.completed + sum.counts.paid + sum.counts.accepted})` },
    { value: 'declined', label: `Refusées (${sum.counts.declined})` },
    { value: 'canceled', label: `Annulées (${sum.counts.canceled})` },
  ];
  const inGroup = (d) => {
    if (group === 'all') return true;
    if (group === 'treated') return ['accepted', 'paid', 'completed'].includes(d.status);
    return d.status === group;
  };
  const filtered = demandes.filter(inGroup);
  const visible = q ? filtered.filter((d) => matches(d, q)) : filtered;

  return (
    <Page title="Historique">
      <Card style={s.sumCard}>
        <View style={s.sumTop}>
          <View>
            <T size={font.xs} weight="700" color={colors.muted}>TOTAL SERVI</T>
            <T size={font.h1} weight="800" color={colors.primary} style={{ marginTop: 4 }}>{money(sum.totalServed)}</T>
          </View>
          <View style={s.sumIcon}><Ionicons name="storefront-outline" size={26} color={colors.primary} /></View>
        </View>
        <View style={s.sumGrid}>
          <Tile icon="checkmark-done" tone="green" value={served} label="Servies" />
          <Tile icon="checkmark-circle" tone="blue" value={treated} label="Traitées" />
          <Tile icon="close-circle" tone="red" value={sum.counts.declined} label="Refusées" />
        </View>
      </Card>

      {/* Filtre par statut (En attente / Traitées / Refusées / Annulées) */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {GROUPS.map((g) => (
          <Chip key={g.value} label={g.label} active={group === g.value} onPress={() => setGroup(g.value)} />
        ))}
      </View>

      {/* Recherche */}
      {demandes.length > 0 && (
        <Card style={s.searchCard}>
          <View style={s.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher (type, statut, nom, téléphone, montant…)"
              placeholderTextColor={colors.muted2}
              style={s.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.muted2} />
              </Pressable>
            ) : null}
          </View>
          {q ? (
            <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 6 }}>
              {visible.length} résultat{visible.length > 1 ? 's' : ''}
            </T>
          ) : null}
        </Card>
      )}

      {demandes.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Ionicons name="receipt-outline" size={40} color={colors.muted2} />
          <T size={font.body} weight="700" color={colors.muted} style={{ marginTop: 10 }}>Aucune demande</T>
          <T size={font.sm} weight="600" color={colors.muted2} style={{ marginTop: 4, textAlign: 'center' }}>
            Les demandes de vos clients apparaîtront ici.
          </T>
        </Card>
      ) : visible.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Ionicons name="search-outline" size={40} color={colors.muted2} />
          <T size={font.body} weight="700" color={colors.muted} style={{ marginTop: 10 }}>Aucun résultat</T>
          <T size={font.sm} weight="600" color={colors.muted2} style={{ marginTop: 4, textAlign: 'center' }}>
            Aucune demande ne correspond à « {q} ».
          </T>
        </Card>
      ) : visible.map((d) => {
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
                  Client : {d.clientName} · pour {d.benefName === d.benefPhone ? d.benefPhone : d.benefName}
                </T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T size={font.body} weight="800" color={colors.text}>{money(d.amount)}</T>
                <Pill icon={st.icon} color={st.color} bg={st.bg} style={{ marginTop: 6 }}>{st.label}</Pill>
              </View>
            </View>
            <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 10, textAlign: 'center' }}>
              {(
                {
                  pending: 'En attente de votre réponse — le client peut encore annuler.',
                  accepted: 'Demande acceptée. Le client paiera via Wave.',
                  paid: `Le client a payé ${money(d.amount)} via Wave — créditez-le.`,
                  completed: `Montant reçu sur votre numéro Wave : ${money(d.amount)}`,
                  declined: 'Vous avez refusé cette demande.',
                  canceled: 'Le client a annulé cette demande.',
                }[d.status] || 'Payé en direct via Wave.'
              )}
            </T>
          </Card>
        );
      })}
    </Page>
  );
}

function Tile({ icon, tone, value, label }) {
  const tones = {
    green: { bg: colors.successBg, color: colors.success },
    orange: { bg: colors.warnBg, color: colors.warn },
    blue: { bg: '#E7F0FE', color: '#2E7BF6' },
    red: { bg: colors.dangerBg, color: colors.danger },
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
  searchCard: { marginBottom: space.sm, paddingVertical: 8, paddingHorizontal: 14 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: font.body, color: colors.text, paddingVertical: 0, outlineStyle: 'none', marginLeft: 8 },
  sumTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sumIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  sumGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
  tile: { flexDirection: 'row', alignItems: 'center' },
  tileIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
