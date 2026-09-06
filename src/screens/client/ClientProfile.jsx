import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Card, ListRow, Pill } from '../../components/ui';
import { Page } from '../../components/Shell';
import { WavePaySheet, PLATFORM_WAVE, PLATFORM_NAME, PLATFORM_PAY_LINK } from '../../components/WavePay';
import { useStore } from '../../store';
import { buildShareUrl } from '../../config';
import Help from '../Help';

export default function ClientProfile({ onLogout }) {
  const { state, subscribe } = useStore();
  const u = state.user;
  const sub = state.subscription;
  const [showSub, setShowSub] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  if (showHelp) return <Help onBack={() => setShowHelp(false)} />;
  const shareUrl = u ? buildShareUrl(u.id) : '';

  const copy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    else { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const subStatus = sub?.status || 'trial';
  const subPill = subStatus === 'active' ? { label: 'Abonnement actif', color: colors.success, bg: colors.successBg, icon: 'checkmark-circle' } : subStatus === 'expired' ? { label: 'Expiré — 100 FCFA/mois', color: colors.danger, bg: colors.dangerBg, icon: 'alert-circle' } : { label: `Essai gratuit — ${sub?.daysLeft || 30} j`, color: colors.primary, bg: colors.primarySoft, icon: 'sparkles' };

  return (
    <Page title="Profil">
      <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
        <View style={s.avatar}><Ionicons name="person" size={48} color="#fff" /></View>
        <T size={font.h2} weight="800" color={colors.text} style={{ marginTop: 14 }}>{u?.name || 'Client'}</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 3 }}>Client</T>
        <Pill icon={subPill.icon} color={subPill.color} bg={subPill.bg} style={{ marginTop: 12 }}>{subPill.label}</Pill>
        {subStatus !== 'active' && (
          <Pressable onPress={() => setShowSub(true)} style={s.subBtn}>
            <T size={font.sm} weight="800" color="#fff">S'abonner — 100 FCFA/mois</T>
          </Pressable>
        )}
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <ListRow icon="call-outline" label="Téléphone" value={u?.phone} />
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Mon lien de partage</T>
        <T size={font.xs} weight="600" color={colors.muted} style={{ marginBottom: 10 }}>Partagez-le pour que d'autres vous ajoutent et transactent.</T>
        <View style={s.linkRow}>
          <Text numberOfLines={1} style={s.linkText}>{shareUrl}</Text>
          <Pressable onPress={copy} style={s.copyBtn}><Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" /></Pressable>
        </View>
        {copied && <T size={font.xs} weight="600" color={colors.success} style={{ marginTop: 6 }}>Lien copié !</T>}
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <ListRow icon="help-circle-outline" label="Aide & Support" onPress={() => setShowHelp(true)} />
      </Card>

      <Card onPress={onLogout} style={{ marginTop: space.lg, backgroundColor: colors.danger, alignItems: 'center', paddingVertical: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="log-out-outline" size={22} color="#fff" style={{ marginRight: 8 }} />
          <T size={font.body} weight="800" color="#fff">Déconnexion</T>
        </View>
      </Card>

      <WavePaySheet visible={showSub} onClose={() => setShowSub(false)} onConfirm={() => { subscribe(); setShowSub(false); }} title="Abonnement mensuel" amount={100} merchant={PLATFORM_WAVE} merchantName={PLATFORM_NAME} payLink={PLATFORM_PAY_LINK} subtitle="100 FCFA / mois" />
    </Page>
  );
}

const s = StyleSheet.create({
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  subBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill, marginTop: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: 8 },
  linkText: { flex: 1, fontSize: font.xs, color: colors.primary, marginRight: 8 },
  copyBtn: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
