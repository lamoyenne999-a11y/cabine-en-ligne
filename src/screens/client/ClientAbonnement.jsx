import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, Pill } from '../../components/ui';
import { Page } from '../../components/Shell';
import { WaveModal } from '../../components/modals';
import { useStore } from '../../store';

const PLANS = [
  { key: 'unites', name: 'Forfait Unités', price: 5000, desc: 'Unités mobiles pour appels et SMS', icon: 'phone-portrait-outline', tone: 'purple' },
  { key: 'minutes', name: 'Forfait Minutes', price: 3000, desc: 'Minutes d\'appel vers tous les réseaux', icon: 'call-outline', tone: 'blue' },
  { key: 'internet', name: 'Forfait Internet', price: 4500, desc: 'Data 4G/5G pour naviguer librement', icon: 'wifi-outline', tone: 'orange' },
];

const tones = {
  purple: { bg: colors.primarySoft, color: colors.primary },
  blue: { bg: '#E7F0FE', color: '#2E7BF6' },
  orange: { bg: '#FDF0E0', color: colors.warn },
};

export default function ClientAbonnement() {
  const { state, subscribe } = useStore();
  const [paying, setPaying] = useState(null); // the plan being subscribed
  const sub = state.activeSubscription;

  const confirmSub = (plan) => {
    subscribe({ plan: plan.key, name: plan.name, amount: plan.price, renews: '15/10/2026' });
    setPaying(null);
  };

  return (
    <Page title="Abonnements" subtitle="Payez votre forfait via Wave">
      {/* Active plan */}
      <Card style={{ marginBottom: space.xl, alignItems: 'center' }}>
        <Pill icon="sparkles" color={colors.primary} bg={colors.primarySoft} style={{ marginBottom: 12 }}>
          {sub ? 'ABONNEMENT ACTIF' : 'AUCUN ABONNEMENT'}
        </Pill>
        <T size={font.h2} weight="800" color={colors.text}>{sub ? sub.name : 'Votre forfait'}</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4 }}>
          {sub ? `${sub.amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF / mois` : 'Choisissez un forfait ci-dessous'}
        </T>
        {sub ? (
          <T size={font.xs} weight="600" color={colors.success} style={{ marginTop: 8 }}>
            Prochaine échéance : {sub.renews}
          </T>
        ) : null}
      </Card>

      <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: space.md }}>Forfaits disponibles</T>

      {PLANS.map((p) => {
        const t = tones[p.tone];
        const active = sub && sub.plan === p.key;
        return (
          <Card key={p.key} style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center' }}>
            <View style={[s.icon, { backgroundColor: t.bg }]}>
              <Ionicons name={p.icon} size={24} color={t.color} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T size={font.body} weight="800" color={colors.text}>{p.name}</T>
                {active ? (
                  <Pill icon="checkmark" color={colors.success} bg={colors.successBg} style={{ marginLeft: 8 }}>
                    Actif
                  </Pill>
                ) : null}
              </View>
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 3 }}>{p.desc}</T>
              <T size={font.h3} weight="800" color={colors.primary} style={{ marginTop: 6 }}>
                {p.price.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF <T size={font.xs} weight="700" color={colors.muted}>/mois</T>
              </T>
            </View>
          </Card>
        );
      })}

      <Card>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 10 }}>Comment ça marche ?</T>
        {[
          'Choisissez votre forfait d\'abonnement',
          'Confirmez le paiement via votre numéro Wave',
          'Votre abonnement est activé instantanément',
        ].map((txt, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={s.step}>
              <T size={font.sm} weight="800" color="#fff">{i + 1}</T>
            </View>
            <T size={font.sm} weight="600" color={colors.textSoft} style={{ marginLeft: 12, flex: 1 }}>{txt}</T>
          </View>
        ))}
      </Card>

      <WaveModal
        visible={!!paying}
        onClose={() => setPaying(null)}
        onSuccess={() => confirmSub(paying)}
        title="Abonnement"
        amount={paying?.price || 0}
        recipient={paying?.name || ''}
        recipientDetail="Cabine En Ligne"
      />
    </Page>
  );
}

const s = StyleSheet.create({
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  step: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
