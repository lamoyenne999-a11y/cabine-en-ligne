import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Card, Chip } from '../../components/ui';
import { Page } from '../../components/Shell';
import { useStore } from '../../store';

export default function GerantHistory() {
  const { state } = useStore();
  const [cat, setCat] = useState('tout'); // tout | demandes | retraits
  const [status, setStatus] = useState('tous'); // tous | reussi | en_attente

  const txs = state.transactions.filter((t) => t.role === 'gerant' && t.id !== 'gtx_test');
  const gains = txs.filter((t) => t.amount > 0 && t.status === 'reussi').reduce((a, b) => a + b.amount, 0);
  const retraits = txs.filter((t) => t.type === 'retrait' && t.status === 'reussi').reduce((a, b) => a + Math.abs(b.amount), 0);

  const filtered = txs.filter((t) => {
    if (cat === 'demandes' && t.type === 'retrait') return false;
    if (cat === 'retraits' && t.type !== 'retrait') return false;
    if (status === 'reussi' && t.status !== 'reussi') return false;
    if (status === 'en_attente' && t.status !== 'en_attente') return false;
    return true;
  });

  return (
    <Page title="Historique">
      <View style={{ flexDirection: 'row', marginBottom: space.lg }}>
        <Card style={{ flex: 1, paddingVertical: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="trending-up" size={16} color={colors.success} />
            <T size={font.xs} weight="600" color={colors.muted} style={{ marginLeft: 6 }}>Gains totaux</T>
          </View>
          <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 6 }}>
            {gains.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF
          </T>
        </Card>
        <Card style={{ flex: 1, paddingVertical: 18, marginLeft: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="trending-down" size={16} color={colors.danger} />
            <T size={font.xs} weight="600" color={colors.muted} style={{ marginLeft: 6 }}>Retraits totaux</T>
          </View>
          <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 6 }}>
            {retraits.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF
          </T>
        </Card>
      </View>

      {/* Category filters */}
      <View style={{ flexDirection: 'row', marginBottom: space.sm, flexWrap: 'wrap' }}>
        {[['tout', 'Tout'], ['demandes', 'Demandes'], ['retraits', 'Retraits']].map(([k, l]) => (
          <Chip key={k} label={l} active={cat === k} onPress={() => setCat(k)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginBottom: space.lg, flexWrap: 'wrap' }}>
        <Chip label="Tous les statuts" active={status === 'tous'} onPress={() => setStatus('tous')} selectedColor={colors.primary} />
        <Chip label="Complété" active={status === 'reussi'} onPress={() => setStatus('reussi')} />
        <Chip label="En attente" active={status === 'en_attente'} onPress={() => setStatus('en_attente')} />
      </View>

      {filtered.map((t) => {
        const pos = t.amount > 0;
        return (
          <Card key={t.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
            <View style={[s.icon, { backgroundColor: pos ? colors.successBg : colors.dangerBg }]}>
              <Ionicons name={pos ? 'trending-up' : 'trending-down'} size={20} color={pos ? colors.success : colors.danger} />
            </View>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <T size={font.body} weight="800" color={colors.text}>{t.label}</T>
              <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>
                {t.type === 'retrait' ? 'Vers votre compte Wave' : `Client: ${t.pour || 'Client'}`}
              </T>
              <T size={font.xs} weight="600" color={colors.muted}>{t.date}</T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T size={font.body} weight="800" color={pos ? colors.success : colors.danger}>
                {pos ? '+' : '−'}{Math.abs(t.amount).toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF
              </T>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                <Ionicons
                  name={t.status === 'reussi' ? 'checkmark-circle' : 'time'}
                  size={14}
                  color={t.status === 'reussi' ? colors.success : colors.warn}
                />
                <T size={font.xs} weight="700" color={t.status === 'reussi' ? colors.success : colors.warn} style={{ marginLeft: 4 }}>
                  {t.status === 'reussi' ? 'Complété' : 'En attente'}
                </T>
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
});
