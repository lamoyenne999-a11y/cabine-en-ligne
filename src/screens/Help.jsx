import React from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Card, Btn } from '../components/ui';
import { Page } from '../components/Shell';
import { PLATFORM_WAVE, PLATFORM_NAME, PLATFORM_PAY_LINK } from '../components/WavePay';

const STEPS = [
  { icon: 'create-outline', title: '1. Faites une demande', text: "Choisissez Unités, Minutes ou Internet, le montant et le gérant de votre choix." },
  { icon: 'water-outline', title: '2. Payez le gérant en direct', text: 'Le gérant accepte votre demande. Vous payez directement via votre app Wave (son numéro marchand). Aucun argent ne passe par l\'app.' },
  { icon: 'checkmark-done-outline', title: '3. Le gérant vous sert', text: 'Une fois payé, le gérant crédite le numéro indiqué. Vous suivez tout dans votre Historique.' },
];

export default function Help({ onBack }) {
  const openPay = () => { if (PLATFORM_PAY_LINK) Linking.openURL(PLATFORM_PAY_LINK).catch(() => {}); };
  const call = () => { if (PLATFORM_WAVE) Linking.openURL(`tel:${PLATFORM_WAVE}`).catch(() => {}); };

  return (
    <Page title="Aide & Support" onBack={onBack}>
      <Card>
        <View style={s.heroIcon}><Ionicons name="help-circle" size={30} color={colors.primary} /></View>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 10, textAlign: 'center' }}>Comment ça marche ?</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4, textAlign: 'center' }}>Simplifié, sécurisé, zéro argent stocké.</T>
        {STEPS.map((s) => (
          <View key={s.title} style={s.step}>
            <View style={s.stepIcon}><Ionicons name={s.icon} size={20} color={colors.primary} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T size={font.body} weight="800" color={colors.text}>{s.title}</T>
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>{s.text}</T>
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 4 }}>Abonnement</T>
        <T size={font.sm} weight="600" color={colors.muted}>
          100 FCFA / mois après 1 mois d'essai gratuit. Payez via votre app Wave au numéro ci-dessous, ou en ligne via le lien du compte marchand.
        </T>
        <View style={s.payRow}>
          <View style={s.payIcon}><Ionicons name="water" size={20} color={colors.wave} /></View>
          <View style={{ flex: 1 }}>
            <T size={font.xs} weight="600" color={colors.muted}>Wave marchand {PLATFORM_NAME}</T>
            <T size={font.h3} weight="800" color={colors.wave}>{PLATFORM_WAVE}</T>
          </View>
          <Pressable onPress={openPay} style={s.openBtn}>
            <T size={font.xs} weight="800" color="#fff">Payer</T>
          </Pressable>
        </View>
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.md }}>Support</T>
        <View style={s.contactRow}>
          <Ionicons name="call-outline" size={18} color={colors.primary} />
          <View style={{ marginLeft: 12 }}>
            <T size={font.xs} weight="600" color={colors.muted}>Assistance (appel / WhatsApp)</T>
            <T size={font.body} weight="800" color={colors.text}>{PLATFORM_WAVE}</T>
          </View>
        </View>
        <Btn title="Appeler le support" icon="call" onPress={call} style={{ marginTop: space.md }} />
      </Card>

      <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: space.lg, marginBottom: 20 }}>
        Cabine En Ligne ne stocke jamais votre argent : les paiements se font en direct via Wave.
      </T>
    </Page>
  );
}

const s = StyleSheet.create({
  heroIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space.lg },
  stepIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  payRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.md, backgroundColor: '#E7F0FE', borderRadius: radius.md, padding: 12 },
  payIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  openBtn: { backgroundColor: colors.waveAccent, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, marginLeft: 8 },
  contactRow: { flexDirection: 'row', alignItems: 'center' },
});
