import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Card, ListRow, Pill, Btn } from '../../components/ui';
import { Page } from '../../components/Shell';
import SubscribeSheet from '../../components/Subscribe';
import PushSettings from '../../components/PushSettings';
import ChangePassword from '../../components/ChangePassword';
import GerantStats from '../../components/GerantStats';
import { useStore } from '../../store';
import { buildShareUrl } from '../../config';
import Help from '../Help';
import Referral from '../Referral';

export default function GerantProfile({ onLogout }) {
  const { state, subscribe, setAvailability } = useStore();
  const isAvailable = state.user?.available !== false;
  const u = state.user;
  const sub = state.subscription;
  const [showSub, setShowSub] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [copiedNum, setCopiedNum] = useState(false);

  if (showReferral) return <Referral onBack={() => setShowReferral(false)} />;
  if (showHelp) return <Help onBack={() => setShowHelp(false)} />;
  const shareUrl = u ? buildShareUrl(u.id) : '';

  const copy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    else { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const copyWaveNum = () => {
    const n = u?.waveNumber || u?.phone || '';
    if (n && typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(n).catch(() => {});
    setCopiedNum(true);
    setTimeout(() => setCopiedNum(false), 2000);
  };

  const subStatus = sub?.status || 'trial';
  const subPlanLabel = sub?.periodLabel ? (sub.periodLabel === 'annuel' ? 'annuel' : 'mensuel') : 'mensuel';
  const subPriceLabel = sub?.priceLabel || (sub?.price === 2000 ? '2000 FCFA / an' : '200 FCFA / mois');
  const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
  const subUntilLabel = fmtDate(sub?.subscribedUntil || 0);

  const subLabel = subStatus === 'active'
    ? `Abonnement ${subPlanLabel} payé ✓ — valable jusqu'au ${subUntilLabel || '—'}`
    : subStatus === 'expired'
      ? `Expiré — ${subPriceLabel}`
      : `Essai gratuit — ${sub?.daysLeft || 30} j`;
  const subPill = subStatus === 'active' ? { label: subLabel, color: colors.success, bg: colors.successBg, icon: 'checkmark-circle' } : subStatus === 'expired' ? { label: subLabel, color: colors.danger, bg: colors.dangerBg, icon: 'alert-circle' } : { label: subLabel, color: colors.primary, bg: colors.primarySoft, icon: 'sparkles' };

  return (
    <Page title="Profil">
      <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
        <View style={s.avatar}><Ionicons name="storefront" size={44} color="#fff" /></View>
        <T size={font.h2} weight="800" color={colors.text} style={{ marginTop: 14 }}>{u?.name || 'Gérant'}</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 3 }}>Gérant de cabine</T>
        <Pill icon={subPill.icon} color={subPill.color} bg={subPill.bg} style={{ marginTop: 12 }}>{subPill.label}</Pill>
        {subStatus !== 'active' && (
          <Pressable onPress={() => setShowSub(true)} style={s.subBtn}><T size={font.sm} weight="800" color="#fff">S'abonner — 200 FCFA/mois ou 2000 FCFA/an</T></Pressable>
        )}
      </Card>

      <GerantStats />

      {/* Disponibilité : visible par les clients (En ligne / Hors ligne) */}
      <Card style={{ marginTop: space.lg, backgroundColor: isAvailable ? colors.successBg : colors.warnBg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[s.availDot, { backgroundColor: isAvailable ? colors.success : colors.warn }]} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <T size={font.h3} weight="800" color={colors.text}>{isAvailable ? 'Vous êtes En ligne' : 'Vous êtes Hors ligne'}</T>
            <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>
              {isAvailable
                ? 'Les clients vous voient disponible et peuvent vous envoyer des demandes.'
                : 'Les clients vous voient « Hors ligne ». Remettez-vous en ligne quand vous êtes à la cabine avec votre matériel.'}
            </T>
          </View>
        </View>
        <Btn
          title={isAvailable ? 'Passer Hors ligne' : 'Me remettre En ligne'}
          icon={isAvailable ? 'moon-outline' : 'sunny-outline'}
          color={isAvailable ? colors.warn : colors.success}
          outline={isAvailable}
          onPress={() => setAvailability(!isAvailable)}
          style={{ marginTop: space.md }}
        />
      </Card>

      {/* Confirmation de paiement de l'abonnement + période de validité */}
      {subStatus === 'active' && (
        <Card style={{ marginTop: space.lg, backgroundColor: colors.successBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={s.paidIcon}><Ionicons name="checkmark-done" size={24} color={colors.success} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T size={font.h3} weight="900" color={colors.success}>Abonnement payé ✓</T>
              <T size={font.sm} weight="700" color={colors.text} style={{ marginTop: 6 }}>
                {subPlanLabel === 'annuel' ? 'Abonnement annuel' : 'Abonnement mensuel'} — {sub?.price || 100} FCFA
              </T>
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4 }}>
                Valable jusqu'au <T size={font.sm} weight="800" color={colors.text}>{subUntilLabel || '—'}</T>
              </T>
              <T size={font.xs} weight="600" color={colors.success} style={{ marginTop: 6 }}>
                {sub?.daysLeft ? `${sub.daysLeft} jour${sub.daysLeft > 1 ? 's' : ''} restant${sub.daysLeft > 1 ? 's' : ''} · Paiement reçu ✓` : 'Paiement reçu ✓'}
              </T>
              {sub?.lastPayment?.reference ? (
                <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 4 }}>
                  Réf. {sub.lastPayment.reference}
                </T>
              ) : null}
            </View>
          </View>
        </Card>
      )}

      <Card style={{ marginTop: space.lg }}>
        <ListRow icon="call-outline" label="Téléphone" value={u?.phone} />
        <View style={s.waveBox}>
          <Ionicons name="water" size={18} color={colors.wave} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <T size={font.xs} weight="600" color={colors.muted}>Votre numéro Wave (pour recevoir)</T>
            <T size={font.body} weight="800" color={colors.wave}>{u?.waveNumber || u?.phone}</T>
          </View>
        </View>
      </Card>

      {/* Comment vos clients vous paient — par transfert au numéro Wave (frais côté client) */}
      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 4 }}>Votre numéro Wave</T>
        <T size={font.xs} weight="600" color={colors.muted} style={{ marginBottom: 10 }}>
          C'est le numéro sur lequel vos clients vous transfèrent le montant de leur demande. Cette fois c'est le CLIENT qui paie les frais Wave (1 %) — vous recevez la totalité, vous ne perdez rien.
        </T>
        <View style={s.waveRow}>
          <View style={s.waveIcon}><Ionicons name="water" size={20} color={colors.wave} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <T size={font.h3} weight="900" color={colors.wave}>{u?.waveNumber || u?.phone}</T>
            <T size={font.xs} weight="600" color={colors.muted}>{u?.name || 'Gérant'}</T>
          </View>
          <Pressable onPress={copyWaveNum} style={s.copyBtn}><Ionicons name={copiedNum ? 'checkmark' : 'copy-outline'} size={16} color="#fff" /></Pressable>
        </View>
        {copiedNum && <T size={font.xs} weight="600" color={colors.success} style={{ marginTop: 6, textAlign: 'center' }}>Numéro copié ✓</T>}
        <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 8 }}>
          Le client transfère le montant dû depuis son app Wave ; les frais sont sur son compte. Aucun argent ne passe par l'app.
        </T>
      </Card>
      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Mon lien de partage</T>
        <T size={font.xs} weight="600" color={colors.muted} style={{ marginBottom: 10 }}>Clients qui ouvrent ce lien peuvent vous ajouter et vous envoyer des demandes.</T>
        <View style={s.linkRow}>
          <Text numberOfLines={1} style={s.linkText}>{shareUrl}</Text>
          <Pressable onPress={copy} style={s.copyBtn}><Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" /></Pressable>
        </View>
        {copied && <T size={font.xs} weight="600" color={colors.success} style={{ marginTop: 6 }}>Lien copié !</T>}
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <ListRow
          icon="gift-outline"
          label="Mes parrainages"
          value={state.referral ? `${state.referral.registeredCount || 0} inscrit${(state.referral.registeredCount || 0) > 1 ? 's' : ''}` : ''}
          onPress={() => setShowReferral(true)}
        />
      </Card>

      <PushSettings />

      <ChangePassword />

      <Card style={{ marginTop: space.lg }}>
        <ListRow icon="help-circle-outline" label="Aide & Support" onPress={() => setShowHelp(true)} />
      </Card>

      <Card onPress={onLogout} style={{ marginTop: space.lg, backgroundColor: colors.danger, alignItems: 'center', paddingVertical: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="log-out-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
          <T size={font.body} weight="800" color="#fff">Déconnexion</T>
        </View>
      </Card>

      <SubscribeSheet visible={showSub} onClose={() => setShowSub(false)} onSubscribe={(plan) => subscribe(plan)} subtitle="Paiement direct via Wave. Renouvelable à tout moment." />
    </Page>
  );
}

const s = StyleSheet.create({
  availDot: { width: 14, height: 14, borderRadius: 7 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  subBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill, marginTop: 14 },
  paidIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  waveBox: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  linkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: 8 },
  linkText: { flex: 1, fontSize: font.xs, color: colors.primary, marginRight: 8 },
  copyBtn: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  waveRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: 12 },
  waveIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E7F0FE', alignItems: 'center', justifyContent: 'center' },
});
