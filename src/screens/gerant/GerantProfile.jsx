import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Card, ListRow, Pill, Btn } from '../../components/ui';
import { Page } from '../../components/Shell';
import SubscribeSheet from '../../components/Subscribe';
import PushSettings from '../../components/PushSettings';
import AccountSettings from '../../components/AccountSettings';
import { GerantBadges, OwnerStars } from '../../components/Badges';
import GerantStats from '../../components/GerantStats';
import { useStore } from '../../store';
import QrToggle from '../../components/QrToggle';
import { buildShareUrl } from '../../config';
import Help from '../Help';
import Referral from '../Referral';

export default function GerantProfile({ onLogout }) {
  const { state, subscribe, setAvailability, updateGerantProfile } = useStore();
  const [editLink, setEditLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const saveLink = async (value) => {
    const v = String(value || '').trim();
    if (v && !/^https:\/\/pay\.wave\.com\/m\//i.test(v)) { setLinkErr('Le lien doit commencer par https://pay.wave.com/m/ (copiez-le depuis votre app Wave Business).'); return; }
    setLinkBusy(true); setLinkErr('');
    try { await updateGerantProfile({ payLink: v }); setEditLink(false); }
    catch (e) { setLinkErr(e?.message || 'Enregistrement impossible.'); }
    finally { setLinkBusy(false); }
  };
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
        <T size={font.h2} weight="800" color={colors.text} style={{ marginTop: 14 }}>{u?.name || 'Gérant(e)'}</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 3 }}>Gérant(e) de cabine</T>
        {/* Badges attribués par Cabine En Ligne (visibles aussi par les clients) */}
        {(u?.certified || u?.official) ? (
          <GerantBadges certified={u?.certified} official={u?.official} size={13} style={{ marginTop: 8, justifyContent: 'center' }} />
        ) : (
          <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 6, textAlign: 'center' }}>Badges « Certifié » et « Officielle » : attribués par Cabine En Ligne.</T>
        )}
        {u?.stars ? <OwnerStars stars={u.stars} size={16} style={{ marginTop: 6, marginLeft: 0 }} /> : null}
        <Pill icon={subPill.icon} color={subPill.color} bg={subPill.bg} style={{ marginTop: 12 }}>{subPill.label}</Pill>
        {subStatus !== 'active' && (
          <Pressable onPress={() => setShowSub(true)} style={s.subBtn}><T size={font.sm} weight="800" color="#fff">S'abonner — 200 FCFA/mois ou 2000 FCFA/an</T></Pressable>
        )}
      </Card>

      <GerantStats />

      {/* Disponibilité : visible par les clients (En ligne / Hors ligne) — une seule ligne. */}
      <Card style={{ marginTop: space.lg, paddingVertical: 12, backgroundColor: isAvailable ? colors.successBg : colors.warnBg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[s.availDot, { backgroundColor: isAvailable ? colors.success : colors.warn }]} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <T size={font.body} weight="800" color={colors.text}>{isAvailable ? 'En ligne' : 'Hors ligne'}</T>
            <T size={font.xs} weight="600" color={colors.muted}>{isAvailable ? 'Vous recevez les demandes.' : 'Les clients vous voient « Hors ligne ».'}</T>
          </View>
          <Btn
            title={isAvailable ? 'Passer Hors ligne' : 'Me remettre En ligne'}
            icon={isAvailable ? 'moon-outline' : 'sunny-outline'}
            color={isAvailable ? colors.warn : colors.success}
            outline={isAvailable}
            size="sm"
            onPress={() => setAvailability(!isAvailable)}
          />
        </View>
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
        {/* Un seul numéro : téléphone = Wave (sauf numéro Wave distinct), avec copie. */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={s.waveIcon}><Ionicons name="water" size={20} color={colors.wave} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <T size={font.h3} weight="900" color={colors.text}>{u?.phone}</T>
            <T size={font.xs} weight="600" color={colors.muted}>Téléphone · Wave — vos clients vous paient ici, frais Wave à leur charge.</T>
          </View>
          <Pressable onPress={copyWaveNum} style={s.copyBtn}><Ionicons name={copiedNum ? 'checkmark' : 'copy-outline'} size={16} color="#fff" /></Pressable>
        </View>
        {u?.waveNumber && u.waveNumber !== u.phone ? (
          <T size={font.sm} weight="700" color={colors.wave} style={{ marginTop: 8 }}>Numéro Wave : {u.waveNumber}</T>
        ) : null}

        {/* Lien Wave Business (facultatif) : paiement en 1 clic pour le client. */}
        <View style={s.payLinkBox}>
          {editLink ? (
            <>
              <T size={font.xs} weight="800" color={colors.text}>Lien Wave Business</T>
              <TextInput
                value={linkDraft}
                onChangeText={(t) => { setLinkDraft(t); setLinkErr(''); }}
                placeholder="https://pay.wave.com/m/M_…"
                placeholderTextColor={colors.muted2}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={s.linkInput}
              />
              {linkErr ? <T size={font.xs} weight="700" color={colors.danger} style={{ marginTop: 4 }}>{linkErr}</T> : null}
              <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 6 }}>
                Dans votre app Wave Business : « Recevoir un paiement » → « Partager mon lien ». Vos clients paieront en un clic, sans frais pour eux ; Wave prélève environ 1 % sur vous.
              </T>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Btn title="Annuler" outline size="sm" onPress={() => { setEditLink(false); setLinkErr(''); }} style={{ flex: 1, marginRight: 6 }} />
                <Btn title="Enregistrer" icon="checkmark" size="sm" loading={linkBusy} onPress={() => saveLink(linkDraft)} style={{ flex: 1 }} />
              </View>
            </>
          ) : u?.payLink ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="flash" size={16} color={colors.wave} />
              <View style={{ flex: 1, marginLeft: 8, minWidth: 0 }}>
                <T size={font.xs} weight="800" color={colors.text}>Wave Business activé — paiement en 1 clic</T>
                <T size={font.xs} weight="600" color={colors.muted} numberOfLines={1}>{u.payLink}</T>
              </View>
              <Pressable onPress={() => { setLinkDraft(u.payLink || ''); setEditLink(true); }} hitSlop={8} style={s.linkIconBtn}><Ionicons name="create-outline" size={18} color={colors.primary} /></Pressable>
              <Pressable onPress={() => saveLink('')} hitSlop={8} style={[s.linkIconBtn, { marginLeft: 6 }]}><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
            </View>
          ) : (
            <Pressable onPress={() => { setLinkDraft(''); setEditLink(true); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="flash-outline" size={16} color={colors.wave} />
              <T size={font.xs} weight="800" color={colors.wave} style={{ marginLeft: 8, flex: 1 }}>Ajouter mon lien Wave Business (paiement en 1 clic, facultatif)</T>
              <Ionicons name="chevron-forward" size={16} color={colors.muted2} />
            </Pressable>
          )}
        </View>
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Mon lien de partage</T>
        <T size={font.xs} weight="600" color={colors.muted} style={{ marginBottom: 10 }}>Vos clients l'ouvrent pour vous ajouter.</T>
        <View style={s.linkRow}>
          <Text numberOfLines={1} style={s.linkText}>{shareUrl}</Text>
          <Pressable onPress={copy} style={s.copyBtn}><Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" /></Pressable>
        </View>
        {copied && <T size={font.xs} weight="600" color={colors.success} style={{ marginTop: 6 }}>Lien copié !</T>}
        <QrToggle value={shareUrl} title={u?.name} role="Gérant(e) de cabine" phone={u?.phone} hint="Affichez-le à votre cabine : le client le scanne avec son appareil photo, vous êtes ajouté à ses gérants et il peut vous envoyer des demandes." />
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

      <AccountSettings />

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
  payLinkBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  linkIconBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  linkInput: { marginTop: 6, backgroundColor: colors.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
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
