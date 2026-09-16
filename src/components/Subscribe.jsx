import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Btn } from './ui';
import { BottomSheet, Dialog } from './modals';
import { WavePaySheet } from './WavePay';
import { PLATFORM_WAVE, PLATFORM_NAME, PLATFORM_PAY_LINK } from './WavePay';
import { useStore } from '../store';

// ============================================================
//  Feuille d'abonnement (client & gérant).
//  Les prix dépendent du rôle : Client 100/1000 FCFA,
//  Gérant 200/2000 FCFA (ce sont eux qui bénéficient le plus).
// ============================================================

function plansForRole(role) {
  if (role === 'gerant') {
    return [
      { key: 'monthly', label: 'Mensuel', price: 200, priceLabel: '200 FCFA / mois', note: 'Renouvelé chaque mois' },
      { key: 'annual', label: 'Annuel', price: 2000, priceLabel: '2000 FCFA / an', note: 'Économisez 400 FCFA (~2 mois offerts)' },
    ];
  }
  return [
    { key: 'monthly', label: 'Mensuel', price: 100, priceLabel: '100 FCFA / mois', note: 'Renouvelé chaque mois' },
    { key: 'annual', label: 'Annuel', price: 1000, priceLabel: '1000 FCFA / an', note: 'Économisez 200 FCFA (~2 mois offerts)' },
  ];
}

export default function SubscribeSheet({ visible, onClose, onSubscribe, subtitle }) {
  const { state } = useStore();
  const PLANS = plansForRole(state.role);
  const [plan, setPlan] = useState('monthly');
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(null); // { plan, price, label, validUntil, reference }
  const [payError, setPayError] = useState('');

  const current = PLANS.find((p) => p.key === plan);
  const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

  const confirmPaid = async () => {
    setPayError('');
    try {
      // On ne considère l'abonnement comme payé QUE si le backend a confirmé
      // (retourne subscription.subscribedUntil + payment.reference).
      const res = await onSubscribe(plan) || {};
      const sub = res.payment ? res : res.subscription || res;
      setPaying(false);
      setPaid({
        plan, duplicate: !!res?.duplicate,
        price: res?.price || res?.payment?.amount || current.price,
        label: res?.periodLabel || (plan === 'annual' ? 'annuel' : 'mensuel'),
        validUntil: res?.subscribedUntil || res?.payment?.validUntil || null,
        reference: res?.payment?.reference || null,
      });
    } catch (e) {
      setPaying(false);
      setPayError(e && e.message ? e.message : 'Le paiement n\'a pas pu être validé. Réessayez.');
    }
  };

  const closeAll = () => {
    setPaid(null);
    onClose();
  };
  const pendingPay = state.subscription?.pendingPayment || null;

  return (
    <>
      <BottomSheet visible={visible} onClose={onClose}>
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

        {payError ? (
          <View style={s.errBox}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <T size={font.sm} weight="700" color={colors.danger} style={{ marginLeft: 8, flex: 1 }}>{payError}</T>
          </View>
        ) : null}

        {pendingPay ? (
          <View style={s.pendingBox}>
            <Ionicons name="hourglass-outline" size={18} color={colors.warn} />
            <T size={font.sm} weight="700" color={colors.warn} style={{ marginLeft: 8, flex: 1 }}>
              Paiement de {pendingPay.amount} F déclaré (réf. {pendingPay.reference}) — en cours de vérification. Votre abonnement sera activé dès confirmation.
            </T>
          </View>
        ) : null}
        <Btn title={pendingPay ? 'Déclarer un autre paiement' : `Payer ${current.priceLabel}`} icon="water" outline={!!pendingPay} onPress={() => setPaying(true)} style={{ marginTop: space.lg }} />
        <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 8 }}>
          Paiement via Wave, puis vérification par Cabine En Ligne avant activation. Aucun argent n'est stocké sur l'app.
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
        mode="link"
        subtitle={current.priceLabel}
      />

      {/* Déclaration envoyée : en attente de vérification par le propriétaire */}
      <Dialog visible={!!paid}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Ionicons name="hourglass" size={64} color={colors.warn} />
          <T size={font.h3} weight="900" color={colors.text} style={{ marginTop: 12, textAlign: 'center' }}>
            Paiement déclaré — en vérification
          </T>
          <T size={font.body} weight="800" color={colors.primary} style={{ marginTop: 6, textAlign: 'center' }}>
            {paid?.price ? `${paid.price.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA` : ''}
          </T>
          <View style={s.receipt}>
            <View style={s.receiptRow}><T size={font.sm} weight="600" color={colors.muted}>Abonnement</T><T size={font.sm} weight="800" color={colors.text}>{paid?.label}</T></View>
            {paid?.reference ? (
              <View style={s.receiptRow}><T size={font.sm} weight="600" color={colors.muted}>Référence</T><T size={font.sm} weight="800" color={colors.text}>{paid.reference}</T></View>
            ) : null}
          </View>
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 10, textAlign: 'center' }}>
            {paid?.duplicate
              ? 'Votre déclaration précédente est toujours en cours de vérification. Inutile de payer une seconde fois.'
              : "Nous vérifions la réception de votre paiement Wave. Votre abonnement sera activé dès confirmation (généralement dans l'heure) et vous recevrez une notification. Vous pouvez continuer à utiliser l'app en attendant."}
          </T>
        </View>
        <Btn title="Compris" onPress={closeAll} style={{ marginTop: 16 }} />
      </Dialog>
    </>
  );
}

const s = StyleSheet.create({
  plan: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1.6, borderColor: colors.border, padding: 14, marginBottom: space.sm },
  planOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.muted2, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  pendingBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warnBg, borderRadius: radius.sm, padding: 10, marginTop: space.md },
  errBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 10, marginTop: space.md },
  receipt: { alignSelf: 'stretch', backgroundColor: colors.successBg, borderRadius: radius.md, padding: 12, marginTop: space.md },
  receiptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5 },
});
