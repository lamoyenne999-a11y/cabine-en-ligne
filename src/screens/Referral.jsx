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
//  Parrainage — commission par palier (0 / 5 / 10 / 20 %).
//  - Mon code de parrainage (CEL…), personnalisable + à partager.
//  - Nombre d'utilisateurs INSCRITS avec mon code (liste),
//    et de PAIEMENTS d'abonnement générés (c'est ce qui détermine le palier).
//  - Versement : les gains sont suivis ici, puis payés manuellement
//    par le propriétaire (Wave). Aucun argent n'est stocké.
//  - Paliers : <100 paiements = 0 % ; >=100 = 5 % ; >=1000 = 10 % ; >=10000 = 20 %.
// ============================================================

const PILL = {
  trial: { label: 'Essai', icon: 'sparkles', color: colors.primary, bg: colors.primarySoft },
  active: { label: 'Payé', icon: 'checkmark-circle', color: colors.success, bg: colors.successBg },
  expired: { label: 'Expiré', icon: 'alert-circle', color: colors.danger, bg: colors.dangerBg },
};

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

  // Vérifie la disponibilité d'un nouveau code (hors connexion : libre).
  const checkAvailability = async (code) => {
    const c = clean(code);
    if (!c) { setCodeStatus(null); return; }
    if (c === r?.code) { setCodeStatus('ok'); return; }
    if (c.length < 6) { setCodeStatus('len'); return; }
    try { await api.referral.check(c); setCodeStatus('taken'); } // existe déjà (par quelqu'un)
    catch (e) { setCodeStatus(e?.status === 404 ? 'ok' : null); }
  };
  useEffect(() => {
    let t;
    if (editCode) t = setTimeout(() => checkAvailability(editCode), 420);
    else setCodeStatus(null);
    return () => clearTimeout(t);
  }, [editCode]); // eslint-disable-line

  const doCopy = () => {
    const text = r?.code || '';
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    else { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  const doShare = () => {
    const url = r?.code ? buildReferralUrl(r.code) : '';
    if (typeof navigator !== 'undefined' && navigator.share) navigator.share({ title: 'Rejoignez Cabine En Ligne', text: `Inscrivez-vous avec mon code ${r?.code || ''} : ${url}` }).catch(() => {});
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

  const count = r?.count || 0;            // paiements d'abonnement générés
  const registeredCount = r?.registeredCount || 0; // inscrits
  const rate = r?.rate || 0;
  const nextTier = r?.nextTier || null;
  const total = r?.totalCommission || 0;
  const earnings = r?.earnings || [];
  const referrals = r?.referrals || [];
  const progress = nextTier ? Math.min(1, count / nextTier.need) : 1;

  return (
    <Page title="Mes parrainages" subtitle="Gagnez une commission" onBack={onBack}>
      {/* Code de parrainage */}
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Pill icon="gift-outline" color={colors.primary} bg={colors.primarySoft}>Programme de parrainage</Pill>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 14, textAlign: 'center' }}>Partagez votre code</T>
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 4 }}>
          Vos invités le saisissent à l'inscription. Vous gagnez {rate} % de chaque abonnement qu'ils paient.
        </T>

        <View style={s.codeBox}>
          <Text style={s.codeText}>{r?.code || '—'}</Text>
          <Pressable onPress={doCopy} style={s.copyBtn}><Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#fff" /></Pressable>
        </View>
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
        <View style={s.stat}><T size={font.h2} weight="800" color={colors.text}>{registeredCount}</T><T size={font.xs} weight="600" color={colors.muted}>Inscrits</T></View>
        <View style={s.stat}><T size={font.h2} weight="800" color={colors.primary}>{count}</T><T size={font.xs} weight="600" color={colors.muted}>Paiements</T></View>
        <View style={s.stat}><T size={font.h2} weight="800" color={colors.primary}>{rate} %</T><T size={font.xs} weight="600" color={colors.muted}>Taux</T></View>
        <View style={s.stat}><T size={font.h2} weight="800" color={colors.success}>{total} F</T><T size={font.xs} weight="600" color={colors.muted}>Gains à</T></View>
      </View>

      {/* Barre de progression du palier */}
      {nextTier ? (
        <Card style={{ marginTop: space.lg }}>
          <T size={font.sm} weight="700" color={colors.text}>Votre taux : {rate} %</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 3 }}>
            {rate === 0
              ? `Encore ${nextTier.need - count} paiement(s) d'abonnement pour atteindre ${nextTier.rate} %.`
              : `${nextTier.need - count} paiement(s) restant(s) avant ${nextTier.rate} %.`}
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

      {/* Mes invités inscrits */}
      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Utilisateurs inscrits avec mon code ({registeredCount})</T>
        {referrals.length === 0 ? (
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4 }}>
            Aucun inscrit pour l'instant. Partagez votre code pour recruter et gagner des commissions.
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
            Les commissions apparaîtront ici dès qu'un de vos invités paiera son abonnement. (Vous passez à 5 % à partir de 100 paiements.)
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
                {fmtDate(e.paidAt)} · {e.rate} % de {e.amount} F {e.commission > 0 ? `= ${e.commission} F` : '(en dessous de 100 paiements)'}
              </T>
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: space.lg, backgroundColor: colors.primarySoft }}>
        <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center' }}>
          Vos gains sont suivis ici. La commission passe à 5 % à 100 paiements, 10 % à 1000 et 20 % à 10 000. Le propriétaire vous les verse manuellement (via Wave). Aucun argent n'est stocké ni envoyé automatiquement.
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
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: colors.gray, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  gainRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  gainIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
