import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Card } from './ui';

// ============================================================
//  Bannière d'abonnement (client & gérant).
//  - Affiche le statut (essai / actif / expiré).
//  - Quand actif : montre la date de fin de validité et les
//    jours restants.
//  - Rappel avant expiration (≤5 j) ou expiré : bouton S'abonner.
// ============================================================

const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

export default function SubBanner({ sub, onSubscribe }) {
  const status = sub?.status || 'trial';
  const daysLeft = sub?.daysLeft ?? 30;
  const isExpired = status === 'expired';
  const planLabel = sub?.periodLabel ? (sub.periodLabel === 'annuel' ? 'annuel' : 'mensuel') : 'mensuel';
  const untilLabel = fmtDate(sub?.subscribedUntil || 0);
  const showReminder = isExpired || daysLeft <= 5;
  const isActive = status === 'active';

  const title = isActive
    ? (planLabel === 'annuel' ? 'ABONNEMENT ANNUEL ACTIF' : 'ABONNEMENT MENSUEL ACTIF')
    : isExpired ? 'ABONNEMENT EXPIRÉ' : 'ESSAI GRATUIT';

  const subText = isActive
    ? `Valable jusqu'au ${untilLabel || '—'}`
    : isExpired ? 'Réabonnez-vous pour continuer à effectuer vos transactions.' : `${daysLeft} jour${daysLeft > 1 ? 's' : ''} d'essai restant${daysLeft > 1 ? 's' : ''}`;

  return (
    <Card style={[s.subBanner, isActive && s.subBannerActive]}>
      <View style={[s.subIcon, isActive && s.subIconActive]}>
        <Ionicons name={isActive ? 'checkmark-done' : isExpired ? 'alert-circle' : 'sparkles'} size={22} color={isActive ? colors.success : colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <T size={font.xs} weight="700" color={isActive ? colors.success : isExpired ? colors.danger : colors.primary}>{title}</T>
        <T size={font.body} weight="800" color={colors.text} style={{ marginTop: 1 }}>{subText}</T>
        <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>
          {isActive
            ? `${sub?.price || 100} FCFA${planLabel === 'annuel' ? ' / an' : ' / mois'} · ${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`
            : '100 FCFA / mois ou 1000 FCFA / an'}
        </T>
      </View>
      {showReminder && (
        <Pressable onPress={onSubscribe} style={s.payBtn}>
          <T size={font.xs} weight="800" color="#fff">S'abonner</T>
        </Pressable>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  subBanner: { flexDirection: 'row', alignItems: 'center', marginBottom: space.lg, padding: space.md },
  subBannerActive: { backgroundColor: colors.successBg },
  subIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  subIconActive: { backgroundColor: '#fff' },
  payBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, marginLeft: 8 },
});
