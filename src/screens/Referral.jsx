import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Card, Pill, ListRow, Btn } from '../components/ui';
import { Page } from '../components/Shell';
import { useStore } from '../store';
import { buildReferralUrl } from '../config';

// ============================================================
//  Parrainage — gain de commission (5 / 10 / 20 %).
//  - Mon code de parrainage (CEL…), à partager.
//  - Mes invités, mon taux actuel, mes gains à recevoir.
//  - Versement : les gains sont suivis ici, puis payés manuellement
//    par le propriétaire (Wave). Aucun argent n'est stocké.
// ============================================================

const PILL = {
  trial: { label: 'Essai', icon: 'sparkles', color: colors.primary, bg: colors.primarySoft },
  active: { label: 'Payé', icon: 'checkmark-circle', color: colors.success, bg: colors.successBg },
  expired: { label: 'Expiré', icon: 'alert-circle', color: colors.danger, bg: colors.dangerBg },
};

function fmtDate(t) {
  return t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export default function Referral({ onBack }) {
  const { state, online, loadReferral } = useStore();
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadReferral(); }, []); // eslint-disable-line
  const r = state.referral;

  const copy = () => {
    const text = r?.code || '';
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    else { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  const share = () => {
    const url = r?.code ? buildReferralUrl(r.code) : '';
    if (typeof navigator !== 'undefined' && navigator.share) navigator.share({ title: 'Rejoignez Cabine En Ligne', text: `Inscrivez-vous avec mon code ${r?.code || ''} : ${url}` }).catch(() => {});
    else copy();
  };

  const count = r?.count || 0;
  const rate = r?.rate || 5;
  const nextTier = r?.nextTier || null;
  const total = r?.totalCommission || 0;
  const earnings = r?.earnings || [];
  const referrals = r?.referrals || [];

  // Progression vers le palier suivant (0 → need).
  const progress = nextTier ? Math.min(1, count / nextTier.need) : 1;

  return (
    <Page title="Mes parrainages" subtitle="Gagnez une commission" onBack={onBack}>
      {/* Code de parrainage */}
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Pill icon="gift-outline" color={colors.primary} bg={colors.primarySoft}>Programme de parrainage</Pill>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 14, textAlign: 'center' }}>
          Partagez votre code
        </T>
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 4 }}>
          Vos invités le saisissent à l'inscription. Chaque fois qu'ils paient leur abonnement, vous touchez {rate} %.
        </T>

        <View style={s.codeBox}>
          <Text style={s.codeText}>{r?.code || '—'}</Text>
          <Pressable onPress={copy} style={s.copyBtn}><Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#fff" /></Pressable>
        </View>
        {copied && <T size={font.xs} weight="600" color={colors.success} style={{ marginTop: 6 }}>Code copié !</T>}

        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <Btn title="Copier" icon="copy-outline" onPress={copy} size="md" style={{ marginRight: 10 }} />
          <Btn title="Partager" icon="share-social-outline" onPress={share} size="md" outline color={colors.primary} />
        </View>
      </Card>

      {/* Stats */}
      <View style={{ flexDirection: 'row', marginTop: space.lg }}>
        <View style={s.stat}>
          <T size={font.h2} weight="800" color={colors.text}>{count}</T>
          <T size={font.xs} weight="600" color={colors.muted}>Invités</T>
        </View>
        <View style={s.stat}>
          <T size={font.h2} weight="800" color={colors.primary}>{rate} %</T>
          <T size={font.xs} weight="600" color={colors.muted}>Taux actuel</T>
        </View>
        <View style={s.stat}>
          <T size={font.h2} weight="800" color={colors.success}>{total} F</T>
          <T size={font.xs} weight="600" color={colors.muted}>Gains à recevoir</T>
        </View>
      </View>

      {/* Barre de progression du palier */}
      {nextTier ? (
        <Card style={{ marginTop: space.lg }}>
          <T size={font.sm} weight="700" color={colors.text}>Votre taux : {rate} %</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 3 }}>
            Invitez encore {nextTier.need - count} parrainé{nextTier.need - count > 1 ? 's' : ''} pour passer à {nextTier.rate} %.
          </T>
          <View style={s.progressTrack}><View style={[s.progressFill, { width: `${progress * 100}%` }]} /></View>
        </Card>
      ) : (
        <Card style={{ marginTop: space.lg, backgroundColor: colors.successBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="trophy" size={22} color={colors.success} style={{ marginRight: 10 }} />
            <T size={font.sm} weight="800" color={colors.success}>Taux maximum atteint : {rate} %</T>
          </View>
        </Card>
      )}

      {/* Mes invités */}
      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Mes invités ({count})</T>
        {referrals.length === 0 ? (
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4 }}>
            Aucun invité pour l'instant. Partagez votre code pour gagner des commissions.
          </T>
        ) : referrals.map((u) => {
          const p = PILL[u.subscription] || PILL.trial;
          return (
            <ListRow
              key={u.id}
              icon={u.role === 'gerant' ? 'storefront-outline' : 'person-outline'}
              label={`${u.name} (${u.role === 'gerant' ? 'Gérant' : 'Client'})`}
              value={p.label}
              iconColor={u.role === 'gerant' ? colors.wave : colors.primary}
              iconBg={p.bg}
            />
          );
        })}
      </Card>

      {/* Historique des commissions */}
      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Historique des gains</T>
        {earnings.length === 0 ? (
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4 }}>
            Les commissions apparaîtront ici dès qu'un de vos invités paiera son abonnement.
          </T>
        ) : earnings.map((e) => (
          <View key={e.reference || e.id} style={s.gainRow}>
            <View style={s.gainIcon}><Ionicons name="cash-outline" size={18} color={colors.success} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T size={font.sm} weight="700" color={colors.text}>
                {e.referredName} · {e.plan === 'annual' ? 'annuel' : 'mensuel'} ({e.priceLabel})
              </T>
              <T size={font.xs} weight="600" color={colors.muted}>
                {fmtDate(e.paidAt)} · {e.commission} F à {e.rate} % de {e.amount} F
              </T>
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: space.lg, backgroundColor: colors.primarySoft }}>
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center' }}>
          Vos gains sont suivis ici. Le propriétaire vous les verse manuellement (via Wave) selon le relevé des abonnements. Aucun argent n'est stocké ni envoyé automatiquement par l'app.
        </T>
      </Card>
    </Page>
  );
}

const s = StyleSheet.create({
  codeBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.bg, borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 14,
    marginTop: 16, width: '100%', maxWidth: 300,
  },
  codeText: { fontSize: 26, fontWeight: '900', color: colors.primary, letterSpacing: 2 },
  copyBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: colors.gray, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  gainRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  gainIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.successBg, alignItems: 'center', justifyContent: 'center' },
});
