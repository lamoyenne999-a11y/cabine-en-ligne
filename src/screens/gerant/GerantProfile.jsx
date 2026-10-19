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
import { Dialog, DialogButtons } from '../../components/modals';
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
  const [confirmDelLink, setConfirmDelLink] = useState(false);
  // saveLink(valeur) enregistre/retire le lien ; saveLink(undefined, off) l'active/désactive.
  const saveLink = async (value, off) => {
    const patch = {};
    if (value !== undefined) {
      const v = String(value || '').trim();
      if (v && !/^https:\/\/pay\.wave\.com\/m\//i.test(v)) { setLinkErr('Le lien doit commencer par https://pay.wave.com/m/ (copiez-le depuis votre app Wave Business).'); return; }
      patch.payLink = v;
    }
    if (off !== undefined) patch.payLinkOff = !!off;
    setLinkBusy(true); setLinkErr('');
    try { await updateGerantProfile(patch); setEditLink(false); }
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
          <Pressable onPress={() => setAvailability(!isAvailable)} style={[s.availBtn, isAvailable ? s.availBtnOff : s.availBtnOn]} hitSlop={6}>
            <Ionicons name={isAvailable ? 'moon-outline' : 'sunny-outline'} size={14} color={isAvailable ? colors.warn : '#fff'} />
            <T size={font.xs} weight="800" color={isAvailable ? colors.warn : '#fff'} style={{ marginLeft: 5 }}>{isAvailable ? 'Passer Hors ligne' : 'Me remettre En ligne'}</T>
          </Pressable>
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
              <T size={font.xs} weight="800" color={colors.text}>Lien de paiement Wave Business (pas votre lien Cabine En Ligne)</T>
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
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="flash" size={16} color={u.payLinkOff ? colors.muted2 : colors.wave} />
                <View style={{ flex: 1, marginLeft: 8, minWidth: 0 }}>
                  <T size={font.xs} weight="800" color={colors.text}>Paiement Wave Business {u.payLinkOff ? '— désactivé' : '— activé'}</T>
                  <T size={font.xs} weight="600" color={colors.muted} numberOfLines={1}>{u.payLink}</T>
                </View>
                <Pressable onPress={() => saveLink(undefined, !u.payLinkOff)} hitSlop={8} style={[s.switch, !u.payLinkOff && s.switchOn]}>
                  <View style={[s.knob, !u.payLinkOff && s.knobOn]} />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                <T size={font.xs} weight="600" color={colors.muted2} style={{ flex: 1 }}>
                  {u.payLinkOff
                    ? 'Vos clients paient par transfert au numéro (frais Wave à leur charge). Réactivez quand votre quota Wave Business est à nouveau disponible.'
                    : 'Vos clients paient en 1 clic, sans frais pour eux (Wave prélève ~1 % sur vous). Quota atteint ? Désactivez : ils paieront par transfert.'}
                </T>
              </View>
              {/* Actions bien séparées : Modifier (large, à gauche) / Supprimer (à droite, avec confirmation). */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Pressable onPress={() => { setLinkDraft(u.payLink || ''); setEditLink(true); }} style={s.linkEditBtn}>
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                  <T size={font.sm} weight="800" color={colors.primary} style={{ marginLeft: 6 }}>Modifier le lien</T>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => setConfirmDelLink(true)} hitSlop={6} style={s.linkDelBtn}>
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <T size={font.xs} weight="800" color={colors.danger} style={{ marginLeft: 4 }}>Supprimer</T>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable onPress={() => { setLinkDraft(''); setEditLink(true); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="flash-outline" size={16} color={colors.wave} />
              <T size={font.xs} weight="800" color={colors.wave} style={{ marginLeft: 8, flex: 1 }}>Paiement Wave Business : ajouter mon lien de paiement (facultatif)</T>
              <Ionicons name="chevron-forward" size={16} color={colors.muted2} />
            </Pressable>
          )}
        </View>
      </Card>

      <Card style={{ marginTop: space.lg }}>
        <T size={font.h3} weight="800" color={colors.text} style={{ marginBottom: 6 }}>Mon lien Cabine En Ligne</T>
        <T size={font.xs} weight="600" color={colors.muted} style={{ marginBottom: 10 }}>Pour être ajouté par vos clients (ce n'est pas un lien de paiement).</T>
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

      <Dialog visible={confirmDelLink}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Supprimer votre lien Wave Business ?</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 8 }}>
          Vos clients ne pourront plus payer en 1 clic : ils paieront par transfert au numéro (frais Wave à leur charge). Vous pourrez ajouter un lien à nouveau plus tard.
        </T>
        <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 8 }}>
          Astuce : pour une pause (quota atteint), utilisez plutôt l'interrupteur — votre lien est conservé.
        </T>
        <DialogButtons cancel="Garder" confirm="Supprimer" onCancel={() => setConfirmDelLink(false)} onConfirm={() => { setConfirmDelLink(false); saveLink(''); }} />
      </Dialog>

      <SubscribeSheet visible={showSub} onClose={() => setShowSub(false)} onSubscribe={(plan) => subscribe(plan)} subtitle="Paiement direct via Wave. Renouvelable à tout moment." />
    </Page>
  );
}

const s = StyleSheet.create({
  availBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  availBtnOn: { backgroundColor: colors.success },
  availBtnOff: { borderWidth: 1.5, borderColor: colors.warn, backgroundColor: '#fff' },
  switch: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#D9D4E3', padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: colors.success },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
  payLinkBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  linkEditBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  linkDelBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6 },
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
