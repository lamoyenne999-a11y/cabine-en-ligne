import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, StatTile } from '../../components/ui';
import { Header } from '../../components/Shell';
import { BottomSheet, WaveModal, Dialog, DialogButtons } from '../../components/modals';
import { useStore } from '../../store';

export default function GerantDashboard() {
  const { state, withdraw } = useStore();
  const [sheet, setSheet] = useState(false);
  const [amount, setAmount] = useState('');
  const [waveOpen, setWaveOpen] = useState(false);
  const [done, setDone] = useState(false);
  const u = state.user;
  const bal = state.gerantBalance;
  const amountNum = parseInt(amount, 10) || 0;

  const confirmAmount = () => {
    if (amountNum <= 0) return;
    setSheet(false);
    setWaveOpen(true);
  };

  const doWithdraw = () => {
    withdraw(amountNum);
    setAmount('');
    setDone(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Tableau de bord" noPad />
      <Card style={[s.balCard, { marginTop: -6 }]}>
        <T size={font.sm} weight="600" color={colors.muted}>Solde CEL</T>
        <T size={34} weight="900" color={colors.primary} style={{ marginTop: 4 }}>
          {bal.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF
        </T>
        <Btn title="Retirer via Wave" icon="wallet-outline" onPress={() => setSheet(true)} style={{ marginTop: 16 }} />
      </Card>

      <View style={s.content}>
        <T size={font.h2} weight="800" color={colors.text} style={{ marginBottom: space.lg }}>
          Bonjour, {u?.name || 'Marie Diallo'} 👋
        </T>

        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.md }}>Statistiques</T>
        <View style={{ flexDirection: 'row' }}>
          <StatTile icon="time-outline" value="12" label="Aujourd'hui" tone="green" />
          <StatTile icon="trending-up" value="67" label="Cette semaine" tone="blue" style={{ marginHorizontal: space.md }} />
          <StatTile icon="checkmark-done-outline" value="245" label="Ce mois" tone="orange" />
        </View>

        <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: space.xl, marginBottom: space.md }}>Revenus</T>
        <Card>
          {[['Aujourd\'hui', '35 000', colors.primary], ['Cette semaine', '185 000', colors.primary], ['Ce mois', '750 000', colors.primary]].map(([l, v, c], i) => (
            <View key={i} style={[s.revRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <T size={font.body} weight="600" color={colors.textSoft}>{l}</T>
              <T size={font.body} weight="800" color={c}>{v} XOF</T>
            </View>
          ))}
        </Card>

        <Card style={{ marginTop: space.lg, backgroundColor: colors.warnBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="bulb-outline" size={20} color={colors.warn} />
            <T size={font.body} weight="800" color={colors.text} style={{ marginLeft: 10 }}>Conseil du jour</T>
          </View>
          <T size={font.sm} weight="600" color={colors.textSoft} style={{ marginTop: 6 }}>
            Traitez les demandes rapidement pour garder vos clients fidèles et booster votre note.
          </T>
        </Card>
      </View>

      {/* Amount input sheet */}
      <BottomSheet visible={sheet} onClose={() => setSheet(false)}>
        <View style={s.handle} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
          <T size={font.h3} weight="800" color={colors.text}>Retirer via Wave</T>
          <Pressable onPress={() => setSheet(false)}><Ionicons name="close" size={24} color={colors.muted} /></Pressable>
        </View>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginBottom: space.md }}>
          Solde disponible : {bal.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF
        </T>
        <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginBottom: 7 }}>Montant à retirer (XOF)</T>
        <View style={s.input}>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            placeholder="Ex: 10000"
            placeholderTextColor={colors.muted2}
            keyboardType="number-pad"
            style={s.inputText}
          />
        </View>
        <Btn title="Confirmer le retrait" icon="wallet-outline" onPress={confirmAmount} style={{ marginTop: space.lg }} />
      </BottomSheet>

      {/* Wave withdrawal */}
      <WaveModal
        visible={waveOpen}
        onClose={() => setWaveOpen(false)}
        onSuccess={doWithdraw}
        title="Retrait"
        amount={amountNum}
        recipient={u?.name || 'Marie Diallo'}
        recipientDetail={u?.phone}
        kind="retrait"
      />

      <Dialog visible={done}>
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 14 }}>Retrait réussit</T>
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 6, textAlign: 'center' }}>
            Votre solde a été transféré vers votre compte Wave.
          </T>
        </View>
        <DialogButtons confirm="OK" onConfirm={() => setDone(false)} />
      </Dialog>
    </View>
  );
}

const s = StyleSheet.create({
  balCard: { marginHorizontal: space.lg, paddingVertical: 22, alignItems: 'center' },
  content: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: 120 },
  revRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.muted2, alignSelf: 'center', marginBottom: 16 },
  input: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg,
    borderRadius: radius.md, paddingHorizontal: 14, height: 52,
  },
  inputText: { flex: 1, fontSize: font.body, color: colors.text, paddingVertical: 0, outlineStyle: 'none' },
});
