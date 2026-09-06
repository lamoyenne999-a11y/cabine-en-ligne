import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Btn } from './ui';
import { BottomSheet, Dialog } from './modals';
import { WavePaySheet } from './WavePay';
import { PLATFORM_WAVE, PLATFORM_NAME, PLATFORM_PAY_LINK } from './WavePay';

// ============================================================
//  Feuille d'abonnement (client & gérant).
//  Deux plans : mensuel 100 FCFA / annuel 1000 FCFA.
//  Le paiement se fait via le lien Wave de la plateforme, puis
//  on affiche une confirmation (« Abonnement mensuel payé —
//  100 FCFA » / « Abonnement annuel payé — 1000 FCFA »).
// ============================================================

const PLANS = [
  { key: 'monthly', label: 'Mensuel', price: 100, priceLabel: '100 FCFA / mois', note: 'Renouvelé chaque mois' },
  { key: 'annual', label: 'Annuel', price: 1000, priceLabel: '1000 FCFA / an', note: 'Économisez 200 FCFA (~2 mois offerts)' },
];

export default function SubscribeSheet({ visible, onClose, onSubscribe, subtitle }) {
  const [plan, setPlan] = useState('monthly');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(null); // { plan, price, label }

  const current = PLANS.find((p) => p.key === plan);

  const confirmPaid = async () => {
    let res = null;
    try { res = await onSubscribe(plan); } catch { /* silencieux */ }
    setPaying(false);
    setPaid({ plan, price: res?.price || current.price, label: res?.periodLabel || (plan === 'annual' ? 'annuel' : 'mensuel') });
  };

  const closeAll = () => {
    setPaid(null);
    onClose();
  };

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose}>
        <View style={s.handle} />
        <T size={font.h3} weight="800" color={colors.text}>Votre abonnement</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4 }}>
          {subtitle || 'Accédez à toutes les fonctionnalités. Paiement direct via Wave.'}
        </T>

        {/* Choix du plan */}
        <View style={{ marginTop: space.lg }}>
          {PLANS.map((p) => {
            const on = plan === p.key;
            return (
              <Pressable key={p.key} onPress={() => setPlan(p.key)} style={[s.plan, on && s.planOn]}>
                <View style={[s.radio, on && s.radioOn]}>
                  {on && <View style={s.radioDot} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <T size={font.body} weight="800" color={on ? colors.primary : colors.text}>{p.label}</T>
                  <T size={font.sm} weight="700" color={on ? colors.primary : colors.muted}>{p.priceLabel}</T>
                  <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 2 }}>{p.note}</T>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Btn title={`Payer ${current.priceLabel}`} icon="water" onPress={() => setPaying(true)} style={{ marginTop: space.lg }} />
        <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 8 }}>
          Aucun argent n'est stocké sur l'app. Le paiement se fait via Wave.
        </T>
      </BottomSheet>

      {/* Paiement via Wave */}
      <WavePaySheet
        visible={paying}
        onClose={() => setPaying(false)}
        onConfirm={confirmPaid}
        title={current.label === 'Annuel' ? 'Abonnement annuel' : 'Abonnement mensuel'}
        amount={current.price}
        merchant={PLATFORM_WAVE}
        merchantName={PLATFORM_NAME}
        payLink={PLATFORM_PAY_LINK}
        subtitle={current.priceLabel}
      />

      {/* Confirmation de paiement */}
      <Dialog visible={!!paid}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <T size={font.h3} weight="900" color={colors.text} style={{ marginTop: 12, textAlign: 'center' }}>
            Abonnement {paid?.label} payé !
          </T>
          <T size={font.body} weight="700" color={colors.primary} style={{ marginTop: 6, textAlign: 'center' }}>
            {paid?.price ? `${paid.price.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA` : ''}
          </T>
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 6, textAlign: 'center' }}>
            Vous avez payé votre abonnement {paid?.label === 'annuel' ? 'annuel' : 'mensuel'} via Wave. Merci !
          </T>
        </View>
        <Btn title="Terminé" onPress={closeAll} style={{ marginTop: 16 }} />
      </Dialog>
    </>
  );
}

const s = StyleSheet.create({
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.muted2, alignSelf: 'center', marginBottom: 16 },
  plan: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1.6, borderColor: colors.border, padding: 14, marginBottom: space.sm },
  planOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.muted2, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
