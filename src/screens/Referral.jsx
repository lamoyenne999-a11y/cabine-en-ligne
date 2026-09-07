import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Card, Pill, ListRow, Btn } from '../components/ui';
import { Page } from '../components/Shell';
import { useStore } from '../store';
import { buildReferralUrl } from '../config';
import { api } from '../api';

// ============================================================
//  Parrainage — aide mutuelle par paliers (5 / 10 / 20 %).
//  Le parrain est rémunéré selon ses INSCRITS :
//    100 inscrits   -> 5 %  (≈500 F/mois sur un abonnement à 100 F)
//    1000 inscrits  -> 10 % (≈10 000 F/mois)
//    10000 inscrits -> 20 % (≈200 000 F/mois)
//  On n'affiche PAS de « 0 % » : tant qu'on n'a pas atteint 100 inscrits,
//  on montre juste le palier à atteindre.
//  Versement : gains suivis ici, payés manuellement par le propriétaire.
// ============================================================

const PILL = {
  trial: { label: 'Essai', icon: 'sparkles', color: colors.primary, bg: colors.primarySoft },
  active: { label: 'Payé', icon: 'checkmark-circle', color: colors.success, bg: colors.successBg },
  expired: { label: 'Expiré', icon: 'alert-circle', color: colors.danger, bg: colors.dangerBg },
};

// Paliers d'aide mutuelle (affichés, sans « 0 % »).
const TIERS = [
  { need: 100, rate: 5, amount: '500 F', label: '5 %' },
  { need: 1000, rate: 10, amount: '10 000 F', label: '10 %' },
  { need: 10000, rate: 20, amount: '200 000 F', label: '20 %' },
];

function fmtDate(t) {
  return t ? new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
const clean = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

export default function Referral({ onBack }) {
  const { state, online, loadReferral, updateReferralCode } = useStore();
  const [copied, setCopied] = useState(false);
  const [editCode, setEditCode] = useState('');
  const [codeStatus, setCodeStatus] = useState(null); // null | 'ok' | 'taken' | 'len'
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { loadReferral(); }, []); // eslint-disable-line
  const r = state.referral;

  const checkAvailability = async (code) => {
    const c = clean(code);
    if (!c) { setCodeStatus(null); return; }
    if (c === r?.code) { setCodeStatus('ok'); return; }
    if (c.length < 6) { setCodeStatus('len'); return; }
    try { await api.referral.check(c); setCodeStatus('taken'); }
    catch (e) { setCodeStatus(e?.status === 404 ? 'ok' : null); }
  };
  useEffect(() => {
    let t;
    if (editCode) t = setTimeout(() => checkAvailability(editCode), 420);
    else setCodeStatus(null);
    return () => clearTimeout(t);
  }, [editCode]); // eslint-disable-line

  const hasCode = !!r?.code;
  const doCopy = () => {
    const text = r?.code || '';
    if (!text) { setErr('Créez d\'abord votre code de parrainage ci-dessous.'); return; }
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    else { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  const doShare = () => {
    const code = r?.code || '';
    if (!code) { setErr('Créez d\'abord votre code de parrainage ci-dessous.'); return; }
    const url = buildReferralUrl(code);
    if (typeof navigator !== 'undefined' && navigator.share) navigator.share({ title: 'Rejoignez Cabine En Ligne', text: `Inscrivez-vous avec mon code ${code} : ${url}` }).catch(() => {});
    else doCopy();
  };

  const saveCode = async () => {
    const c = clean(editCode);
    if (c === r?.code) { setErr(''); return; }
    if (c.length < 6) { setErr('Votre code doit contenir au moins 6 caractères.'); return; }
    if (codeStatus === 'taken') { setErr('Ce code est déjà utilisé par un autre parrain.'); return; }
    setErr(''); setSaving(true);
    try {
      await updateReferralCode(c);
      setEditCode(''); setCodeStatus(null); setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { setErr(e?.message || 'Impossible d\'enregistrer ce code.'); }
    finally { setSaving(false); }
  };

  const inscrits = r?.registeredCount || 0;
  const payments = r?.payments || 0;
  const rate = r?.rate || 0;
  const nextTier = r?.nextTier || null;
  const total = r?.totalCommission || 0;
  const earnings = r?.earnings || [];
  const referrals = r?.referrals || [];

  // Milestone actuel le plus haut atteint (index).
  const currentTierIndex = TIERS.reduce((acc, t, i) => (inscrits >= t.need ? i : acc), -1);
  const progress = nextTier ? Math.min(1, (inscrits - (currentTierIndex >= 0 ? TIERS[currentTierIndex].need : 0)) / (nextTier.need - (currentTierIndex >= 0 ? TIERS[currentTierIndex].need : 0))) : 1;

  return (
    <Page title="Mes parrainages" subtitle="Aide mutuelle" onBack={onBack}>
      {/* Code de parrainage */}
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Pill icon="gift-outline" color={colors.primary} bg={colors.primarySoft}>Programme de parrainage</Pill>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 14, textAlign: 'center' }}>Partagez votre code</T>
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 4 }}>
          Vos invités le saisissent à l'inscription. Une aide mutuelle : plus vous invitez, plus vous gagnez.
        </T>

        <View style={s.codeBox}>
          <Text style={[s.codeText, !hasCode && { color: colors.muted2, fontSize: 18, letterSpacing: 1 }]}>{hasCode ? r.code : 'Aucun code'}</Text>
          <Pressable onPress={doCopy} style={s.copyBtn}><Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#fff" /></Pressable>
        </View>
        {!hasCode && <T size={font.xs} weight="600" color={colors.primary} style={{ marginTop: 8 }}>Créez votre code ci-dessous pour commencer à gagner.</T>}
        {copied && <T size={font.xs} weight="600" color={colors.success} style={{ marginTop: 6 }}>Code copié !</T>}

        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <Btn title="Copier" icon="copy-outline" onPress={doCopy} size="md" style={{ marginRight: 10 }} />
          <Btn title="Partager" icon="share-social-outline" onPress={doShare} size="md" outline color={colors.primary} />
        </View>
      </Card>

      {/* Personnaliser mon code */}
      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text}>Personnaliser mon code</T>
        <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 3, marginBottom: 10 }}>
          Créez votre propre code (6 à 12 lettres/chiffres). Il est unique : personne d'autre ne peut l'utiliser comme parrain.
        </T>
        <View style={s.editRow}>
          <Ionicons name="create-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} />
          <TextInput
            value={editCode}
            onChangeText={(t) => { setEditCode(clean(t)); setErr(''); }}
            placeholder="Ex : MAKABINE2026"
            placeholderTextColor={colors.muted2}
            autoCapitalize="characters"
            autoCorrect={false}
            style={s.editInput}
          />
          {codeStatus === 'ok' ? <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            : codeStatus === 'taken' ? <Ionicons name="close-circle" size={20} color={colors.danger} />
            : null}
        </View>
        {codeStatus === 'ok' && editCode && <T size={font.xs} weight="600" color={colors.success} style={{ marginTop: 6 }}>Ce code est disponible ✓</T>}
        {codeStatus === 'taken' && <T size={font.xs} weight="600" color={colors.danger} style={{ marginTop: 6 }}>Ce code est déjà pris par un autre parrain.</T>}
        {codeStatus === 'len' && <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 6 }}>Encore {6 - String(editCode).length} caractère(s) minimum.</T>}
        {err ? <T size={font.xs} weight="600" color={colors.danger} style={{ marginTop: 6 }}>{err}</T> : null}
        <Btn
          title={saved ? 'Code enregistré ✓' : 'Enregistrer mon code'}
          icon={saved ? 'checkmark' : 'save-outline'}
          onPress={saveCode}
          loading={saving}
          disabled={!editCode || editCode === r?.code}
          style={{ marginTop: space.md }}
        />
      </Card>

      {/* Stats */}
      <View style={{ flexDirection: 'row', marginTop: space.lg }}>
        <View style={s.stat}><T size={font.h2} weight="800" color={colors.text}>{inscrits}</T><T size={font.xs} weight="600" color={colors.muted}>Inscrits</T></View>
        <View style={s.stat}><T size={font.h2} weight="800" color={colors.primary}>{payments}</T><T size={font.xs} weight="600" color={colors.muted}>Paiements</T></View>
        <View style={s.stat}><T size={font.h2} weight="800" color={colors.success}>{total} F</T><T size={font.xs} weight="600" color={colors.muted}>Gains reçus</T></View>
      </View>

      {/* Paliers d'aide mutuelle */}
      <Card style={{ marginTop: space.lg, backgroundColor: colors.primarySoft }}>
        <T size={font.h3} weight="800" color={colors.text}>Vos paliers</T>
        <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2, marginBottom: 10 }}>
          Plus vous invitez d'utilisateurs, plus votre part augmente. (exemple sur un abonnement à 100 F/mois)
        </T>
        {TIERS.map((t, i) => {
          const reached = inscrits >= t.need;
          const current = i === currentTierIndex;
          return (
            <View key={t.need} style={[s.tierRow, reached && s.tierRowActive, current && s.tierRowCurrent]}>
              <View style={{ flex: 1 }}>
                <T size={font.body} weight={reached ? '800' : '600'} color={reached ? colors.primary : colors.text}>{t.need.toLocaleString('fr-FR')} inscrits</T>
                <T size={font.xs} weight="600" color={colors.muted}>→ {t.label} de chaque abonnement (≈{t.amount}/mois)</T>
              </View>
              {reached ? <Ionicons name="checkmark-circle" size={24} color={colors.success} /> : <Ionicons name="lock-closed-outline" size={18} color={colors.muted2} />}
            </View>
          );
        })}
      </Card>

      {/* Progression vers le palier suivant */}
      {nextTier ? (
        <Card style={{ marginTop: space.lg }}>
          <T size={font.sm} weight="700" color={colors.text}>
            {rate > 0 ? `Votre part actuelle : ${rate} %` : 'Commencez à gagner dès 100 inscrits'}
          </T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 3 }}>
            Encore {nextTier.need - inscrits} inscrit{nextTier.need - inscrits > 1 ? 's' : ''} pour passer à {nextTier.rate} % ({nextTier.need.toLocaleString('fr-FR')} inscrits).
          </T>
          <View style={s.progressTrack}><View style={[s.progressFill, { width: `${progress * 100}%` }]} /></View>
        </Card>
      ) : (
        <Card style={{ marginTop: space.lg, backgroundColor: colors.successBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="trophy" size={22} color={colors.success} style={{ marginRight: 10 }} />
            <T size={font.sm} weight="800" color={colors.success}>Palier maximum atteint : {rate} %</T>
          </View>
        </Card>
      )}

      {/* Mes inscrits */}
      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Utilisateurs inscrits avec mon code ({inscrits})</T>
        {referrals.length === 0 ? (
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4 }}>
            Aucun inscrit pour l'instant. Partagez votre code pour recruter et gagner.
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

      {/* Historique des gains */}
      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Historique des gains</T>
        {earnings.length === 0 ? (
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4 }}>
            Les gains apparaîtront ici dès qu'un de vos inscrits paiera son abonnement.
          </T>
        ) : earnings.map((e) => (
          <View key={e.reference || e.id} style={s.gainRow}>
            <View style={[s.gainIcon, { backgroundColor: e.commission > 0 ? colors.successBg : colors.gray }]}>
              <Ionicons name={e.commission > 0 ? 'cash-outline' : 'refresh-outline'} size={18} color={e.commission > 0 ? colors.success : colors.muted} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <T size={font.sm} weight="700" color={colors.text}>
                {e.referredName} · {e.plan === 'annual' ? 'annuel' : 'mensuel'} ({e.priceLabel})
              </T>
              <T size={font.xs} weight="600" color={colors.muted}>
                {fmtDate(e.paidAt)} · {e.rate} % de {e.amount} F {e.commission > 0 ? `= ${e.commission} F` : ''}
              </T>
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: space.lg, backgroundColor: colors.primarySoft }}>
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center' }}>
          Vos gains sont suivis ici et vous sont versés par le propriétaire (via Wave). Aucun argent n'est stocké ni envoyé automatiquement par l'app. Cette aide mutuelle finance les partenariats et la publicité pour faire connaître l'appli.
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
  editRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 14, height: 52 },
  editInput: { flex: 1, fontSize: font.body, color: colors.text, height: '100%', paddingVertical: 0, outlineStyle: 'none' },
  stat: { flex: 1, alignItems: 'center' },
  tierRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  tierRowActive: { borderTopColor: colors.border },
  tierRowCurrent: { backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: radius.md, paddingHorizontal: 10, marginVertical: 2 },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: colors.gray, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  gainRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  gainIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
