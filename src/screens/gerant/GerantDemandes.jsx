import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, Pill } from '../../components/ui';
import { Page } from '../../components/Shell';
import { Dialog, DialogButtons, BottomSheet } from '../../components/modals';
import SubBanner from '../../components/SubBanner';
import SubscribeSheet from '../../components/Subscribe';
import { useStore } from '../../store';

// ============================================================
//  Demandes reçues (gérant) — version COMPACTE.
//  Chaque carte montre : l'essentiel + UNE ligne d'état + au plus
//  2 boutons principaux (petits) + un bouton « ⋯ » qui ouvre les
//  actions secondaires dans un panneau. Les autres demandes restent
//  visibles sans scroller.
// ============================================================

const STATUS = {
  pending: { label: 'En attente', color: colors.warn, bg: colors.warnBg, icon: 'time' },
  accepted: { label: 'Acceptée', color: colors.primary, bg: colors.primarySoft, icon: 'checkmark-circle' },
  declined: { label: 'Refusée', color: colors.danger, bg: colors.dangerBg, icon: 'close-circle' },
  unavailable: { label: 'Indisponible', color: colors.warn, bg: colors.warnBg, icon: 'moon' },
  paid: { label: 'Payée', color: '#2E7BF6', bg: '#E7F0FE', icon: 'wallet' },
  completed: { label: 'Complétée', color: colors.success, bg: colors.successBg, icon: 'checkmark-done' },
  canceled: { label: 'Annulée', color: colors.muted, bg: colors.gray, icon: 'close-circle-outline' },
};
const TYPE_ICON = { unites: 'phone-portrait-outline', minutes: 'call-outline', internet: 'wifi-outline', forfait: 'layers-outline' };
const TYPE_LABEL = { unites: 'Unités', minutes: 'Minutes', internet: 'Internet', forfait: 'Appel + Internet' };
const fmt = (n) => (n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');

// Ligne d'état (1 phrase) : dit au gérant où en est la demande.
function stateLine(d) {
  const amt = `${fmt(d.amount)} XOF`;
  if (d.notServedAt && d.status !== 'completed') return { tone: 'danger', icon: 'alert-circle', text: `Client dit NE PAS avoir reçu sa recharge (${d.benefPhone}). Servez-le puis « J'ai servi ».` };
  if (d.moneyReceived && d.status === 'completed' && d.clientConfirmedAt) return { tone: 'success', icon: 'checkmark-done-circle', text: 'Terminée — le client a confirmé la réception.' };
  if (d.moneyReceived) return { tone: 'success', icon: 'checkmark-circle', text: `Argent reçu (${amt}). Reste à servir le client.` };
  if (d.clientDisputedAt) return { tone: 'warn', icon: 'help-circle', text: `Le client affirme avoir payé la totalité (${amt}). Revérifiez votre Wave.` };
  if (d.partialAt && d.partialCompletedAt > d.partialAt) return { tone: 'info', icon: 'add-circle', text: `Le client dit avoir complété ${fmt(d.partialMissing)} XOF. Vérifiez votre Wave.` };
  if (d.partialAt) return { tone: 'warn', icon: 'remove-circle', text: `Incomplet : ${fmt(d.partialReceived)} reçus / ${amt}. Client invité à compléter ${fmt(d.partialMissing)} XOF.` };
  if (d.status === 'paid') return { tone: 'info', icon: 'water', text: `Le client déclare avoir payé ${amt}. Vérifiez votre Wave.` };
  if (d.status === 'completed') return { tone: 'warn', icon: 'time', text: `Client servi — paiement de ${amt} pas encore reçu.` };
  if (d.status === 'accepted' && d.notReceivedAt) return { tone: 'danger', icon: 'warning', text: 'Vous avez signalé « non reçu ». Le client vérifie son transfert.' };
  if (d.status === 'accepted' && d.paymentRequestedAt) return { tone: 'info', icon: 'card', text: 'Paiement demandé au client. En attente de son transfert Wave.' };
  if (d.status === 'accepted') return { tone: 'muted', icon: 'time-outline', text: `En attente du paiement Wave du client${d.gerantWave ? ' (' + d.gerantWave + ')' : ''}.` };
  return { tone: 'muted', icon: 'mail-unread-outline', text: 'Nouvelle demande — répondez au client.' };
}
const TONES = {
  success: { bg: colors.successBg, color: colors.success },
  info: { bg: '#E7F0FE', color: '#2E7BF6' },
  warn: { bg: colors.warnBg, color: colors.warn },
  danger: { bg: colors.dangerBg, color: colors.danger },
  muted: { bg: colors.bg, color: colors.muted },
};

export default function GerantDemandes() {
  const {
    state, acceptDemande, declineDemande, unavailableDemande, requestPaymentDemande,
    completeDemande, receiveDemande, notReceiveDemande, partialDemande, subscribe,
  } = useStore();
  const [confirm, setConfirm] = useState(null); // { id, action }
  const [more, setMore] = useState(null);       // demande ouverte dans le panneau « ⋯ »
  const [unavailReason, setUnavailReason] = useState('away');
  const [showSub, setShowSub] = useState(false);
  const [profile, setProfile] = useState(null);    // demande dont on affiche le profil du client
  const [copiedId, setCopiedId] = useState(null);
  const copyPhone = (id, phone) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(phone).catch(() => {});
    setCopiedId(id); setTimeout(() => setCopiedId(null), 1800);
  };

  // L'inbox ne montre que les demandes qui ATTENDENT UNE ACTION du gérant.
  const demandes = (state.gerantDemandes || []).filter((d) =>
    d.status === 'pending' || d.status === 'accepted' || d.status === 'paid' ||
    (d.status === 'completed' && (!d.moneyReceived || !d.clientConfirmedAt)));

  const ask = (id, action) => { setMore(null); setConfirm({ id, action }); };
  const doAction = () => {
    if (!confirm) return;
    const { id, action } = confirm;
    if (action === 'accept') acceptDemande(id);
    else if (action === 'decline') declineDemande(id);
    else if (action === 'unavailable') unavailableDemande(id, unavailReason);
    else if (action === 'requestpay') requestPaymentDemande(id);
    else if (action === 'received') receiveDemande(id);
    else if (action === 'notreceived') notReceiveDemande(id);
    else if (action === 'partial') partialDemande(id);
    else if (action === 'complete') completeDemande(id);
    setConfirm(null);
  };

  // Boutons PRINCIPAUX (max 2) selon l'étape ; le reste passe dans « ⋯ ».
  const primaryActions = (d) => {
    if (d.status === 'pending') return [
      { key: 'accept', title: 'Accepter', icon: 'checkmark', color: colors.primary },
      { key: 'requestpay', title: 'Payer d\'abord', icon: 'card-outline', color: '#2E7BF6', outline: true },
    ];
    if (d.status === 'accepted') return [
      d.paymentRequestedAt
        ? { key: 'requestpay', title: 'Relancer paiement', icon: 'card-outline', color: '#2E7BF6', outline: true }
        : { key: 'requestpay', title: 'Demander paiement', icon: 'card-outline', color: '#2E7BF6', outline: true },
      { key: 'received', title: 'Argent reçu ✓', icon: 'cash-outline', color: colors.success },
    ];
    if (d.status === 'paid') return [
      { key: 'received', title: 'Argent reçu ✓', icon: 'cash-outline', color: colors.success },
      { key: 'notreceived', title: 'Pas reçu ✗', icon: 'close-circle-outline', color: colors.danger, outline: true },
    ];
    // completed (non réglée ou non confirmée)
    if (!d.moneyReceived) return [
      { key: 'received', title: 'Argent reçu ✓', icon: 'cash-outline', color: colors.success },
      { key: 'notreceived', title: 'Pas reçu ✗', icon: 'close-circle-outline', color: colors.danger, outline: true },
    ];
    return [];
  };
  // Actions affichées SOUS les 2 boutons principaux (petites, directes).
  const secondaryActions = (d) => {
    const a = [];
    if ((d.status === 'paid' || d.status === 'completed') && !d.moneyReceived) {
      a.push({ key: 'partial', title: d.partialAt ? 'Toujours incomplet — relancer' : 'Reçu, mais incomplet (frais Wave)', icon: 'remove-circle-outline', color: colors.warn });
    }
    if (d.status === 'pending' || d.status === 'paid') {
      a.push({ key: 'unavailable', title: 'Pas disponible', icon: 'moon-outline', color: colors.warn });
    }
    return a;
  };
  // Actions SECONDAIRES (panneau « ⋯ »).
  const moreActions = (d) => {
    const a = [];
    const canServe = d.status !== 'completed' && d.status !== 'pending';
    if (d.moneyReceived && d.status !== 'completed') a.unshift({ key: 'complete', title: 'J\'ai servi le client', icon: 'checkmark-done', color: colors.primary });
    else if (canServe) a.push({ key: 'complete', title: 'J\'ai servi (sans attendre le paiement)', icon: 'checkmark-done-outline', color: colors.primary });
    if (d.status === 'pending' || d.status === 'accepted') a.push({ key: 'received', title: 'Argent déjà reçu ✓', icon: 'cash-outline', color: colors.success });
    if (d.status === 'pending' || d.status === 'paid') a.push({ key: 'decline', title: 'Refuser la demande', icon: 'close-circle', color: colors.danger });
    return a;
  };

  const cur = demandes.find((d) => d.id === confirm?.id) || {};
  const TITLES = {
    accept: 'Accepter la demande', decline: 'Refuser la demande', unavailable: 'Je ne suis pas disponible',
    requestpay: 'Demander le paiement', received: "Confirmer l'argent reçu", notreceived: 'Argent non reçu',
    partial: 'Montant incomplet', complete: 'Confirmer le service',
  };
  const message = () => {
    switch (confirm?.action) {
      case 'accept': return 'Le client sera informé que vous avez bien reçu sa demande et que vous vous en occupez.';
      case 'requestpay': return `Le client sera informé que vous avez bien reçu sa demande et qu'il doit payer ${fmt(cur.amount)} XOF (+ frais Wave) avant que vous ne le serviez.`;
      case 'decline': return cur.status === 'paid'
        ? 'Le client a déjà payé. Si vous refusez, le montant doit lui être remboursé (par Wave).'
        : 'La demande sera signalée comme refusée.';
      case 'unavailable': return cur.status === 'paid'
        ? "Le client a déjà payé : il sera informé que vous n'êtes pas disponible et que le montant doit lui être remboursé (par Wave). Vous passerez « Hors ligne »."
        : "Le client sera informé que vous n'êtes pas disponible (ce n'est pas un refus) et invité à choisir un autre gérant. Vous passerez « Hors ligne » ; remettez-vous en ligne depuis votre Profil.";
      case 'received': return `Vous confirmez avoir reçu ${fmt(cur.amount)} XOF de ${cur.clientName || 'ce client'} sur votre Wave ? Le client sera notifié.`;
      case 'notreceived': return `Vous n'avez PAS reçu ${fmt(cur.amount)} XOF de ${cur.clientName || 'ce client'} ? Il sera notifié et invité à vérifier son transfert Wave.`;
      case 'partial': return `Vous avez reçu moins que ${fmt(cur.amount)} XOF (souvent ${fmt(Math.round((cur.amount || 0) * 0.99))} XOF : frais Wave déduits). Le client sera invité à compléter ${fmt(Math.ceil((cur.amount || 0) * 0.01))} XOF.`;
      case 'complete': return cur.moneyReceived
        ? 'Vous avez bien crédité le client ? Il sera notifié et pourra confirmer la réception.'
        : "Vous avez crédité le client sans avoir encore reçu l'argent ? Il sera notifié qu'il doit encore régler.";
      default: return '';
    }
  };

  return (
    <Page title="Demandes reçues">
      <SubBanner sub={state.subscription} onSubscribe={() => setShowSub(true)} />
      {demandes.length === 0 ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Ionicons name="notifications-off-outline" size={40} color={colors.muted2} />
          <T size={font.body} weight="700" color={colors.muted} style={{ marginTop: 10 }}>Aucune demande</T>
          <T size={font.sm} weight="600" color={colors.muted2} style={{ marginTop: 4, textAlign: 'center' }}>
            Les demandes de vos clients apparaîtront ici.
          </T>
        </Card>
      ) : demandes.map((d) => {
        const st = STATUS[d.status] || STATUS.pending;
        const line = stateLine(d);
        const tone = TONES[line.tone] || TONES.muted;
        const third = !!d.benefPhone && !!d.clientPhone && d.benefPhone !== d.clientPhone;
        const prim = primaryActions(d);
        const sec = secondaryActions(d);
        const extra = moreActions(d);
        return (
          <Card key={d.id} style={s.card}>
            {/* En-tête compact : type + client · montant + statut */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={s.icon}><Ionicons name={TYPE_ICON[d.type] || 'phone-portrait-outline'} size={20} color={colors.primary} /></View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <T size={font.body} weight="800" color={colors.text}>{TYPE_LABEL[d.type] || 'Demande'}</T>
                  <T size={font.body} weight="800" color={colors.primary} style={{ marginLeft: 8 }}>{fmt(d.amount)} XOF</T>
                </View>
              </View>
              <Pill icon={st.icon} color={st.color} bg={st.bg}>{st.label}</Pill>
            </View>

            {/* QUI demande, POUR QUI : le numéro à créditer est en grand */}
            <View style={s.whoRow}>
              <View style={{ flex: 1 }}>
                <T size={font.xs} weight="700" color={colors.muted}>
                  <T size={font.xs} weight="800" color={colors.text}>{d.clientName}</T>{third ? ' demande pour' : ' demande pour lui-même'}
                </T>
                <T size={font.h3} weight="900" color={colors.text} style={{ marginTop: 1 }} numberOfLines={1}>{d.benefPhone || d.benefName}</T>
              </View>
              <Pressable onPress={() => setProfile(d)} hitSlop={6} style={s.profileBtn}>
                <Ionicons name="person-outline" size={14} color={colors.primary} />
                <T size={font.xs} weight="800" color={colors.primary} style={{ marginLeft: 4 }}>Profil client</T>
              </Pressable>
            </View>

            {/* Ligne d'état (1 phrase) */}
            <View style={[s.stateLine, { backgroundColor: tone.bg }]}>
              <Ionicons name={line.icon} size={14} color={tone.color} />
              <T size={font.xs} weight="700" color={tone.color} style={{ marginLeft: 6, flex: 1 }} numberOfLines={2}>{line.text}</T>
            </View>

            {/* Actions : ≤ 2 boutons petits + « ⋯ » */}
            {(prim.length > 0 || extra.length > 0) && (
              <View style={s.actions}>
                {prim.map((a, i) => (
                  <Btn key={a.key} title={a.title} icon={a.icon} size="sm" color={a.color} outline={!!a.outline}
                    onPress={() => ask(d.id, a.key)} style={[{ flex: 1 }, i < prim.length - 1 && { marginRight: 6 }]} />
                ))}
                {extra.length > 0 && (
                  <Pressable onPress={() => setMore(d)} style={s.moreBtn} hitSlop={6}>
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.primary} />
                  </Pressable>
                )}
              </View>
            )}
            {sec.length > 0 && (
              <View style={{ flexDirection: 'row', marginTop: 6 }}>
                {sec.map((a, i) => (
                  <Btn key={a.key} title={a.title} icon={a.icon} size="sm" color={a.color} outline
                    onPress={() => ask(d.id, a.key)} style={[{ flex: 1 }, i < sec.length - 1 && { marginRight: 6 }]} />
                ))}
              </View>
            )}
          </Card>
        );
      })}

      {/* Fiche « Profil client » : qui demande, qui paie, qui est crédité */}
      <BottomSheet visible={!!profile} onClose={() => setProfile(null)}>
        {profile && (() => {
          const third = !!profile.benefPhone && !!profile.clientPhone && profile.benefPhone !== profile.clientPhone;
          const rows = [
            { icon: 'person-circle-outline', label: 'Client (qui demande et paie)', value: profile.clientName, sub: profile.clientPhone, copy: profile.clientPhone, key: 'c' },
            { icon: 'phone-portrait-outline', label: third ? 'Numéro à créditer (autre personne)' : 'Numéro à créditer (lui-même)', value: profile.benefPhone || profile.benefName, copy: profile.benefPhone, key: 'b' },
            { icon: 'water-outline', label: 'Paiement Wave attendu de', value: profile.clientName + (profile.clientPhone ? ' · ' + profile.clientPhone : ''), key: 'w' },
          ];
          return (
            <>
              <T size={font.h3} weight="800" color={colors.text}>Profil client</T>
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginBottom: 6 }}>
                {profile.clientName} demande {TYPE_LABEL[profile.type] || ''} {fmt(profile.amount)} XOF pour {third ? profile.benefPhone : 'lui-même'}.
              </T>
              {rows.map((r) => (
                <View key={r.key} style={s.infoRow}>
                  <View style={[s.moreIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name={r.icon} size={18} color={colors.primary} /></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <T size={font.xs} weight="700" color={colors.muted}>{r.label}</T>
                    <T size={font.body} weight="800" color={colors.text}>{r.value}</T>
                    {r.sub ? <T size={font.sm} weight="700" color={colors.text}>{r.sub}</T> : null}
                  </View>
                  {r.copy ? (
                    <Pressable onPress={() => copyPhone(r.key, r.copy)} hitSlop={6} style={s.byBtn}>
                      <Ionicons name={copiedId === r.key ? 'checkmark' : 'copy-outline'} size={14} color={colors.primary} />
                      <T size={font.xs} weight="800" color={colors.primary} style={{ marginLeft: 3 }}>{copiedId === r.key ? 'Copié' : 'Copier'}</T>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              <Btn title="Fermer" outline onPress={() => setProfile(null)} style={{ marginTop: space.md }} />
            </>
          );
        })()}
      </BottomSheet>

      {/* Panneau « ⋯ » : actions secondaires */}
      <BottomSheet visible={!!more} onClose={() => setMore(null)}>
        {more && (
          <>
            <T size={font.h3} weight="800" color={colors.text}>{TYPE_LABEL[more.type] || 'Demande'} · {fmt(more.amount)} XOF</T>
            <T size={font.sm} weight="600" color={colors.muted} style={{ marginBottom: 10 }}>Demandé par {more.clientName}{more.clientPhone ? ' (' + more.clientPhone + ')' : ''} · créditer {more.benefPhone || more.benefName}</T>
            {moreActions(more).map((a) => (
              <Pressable key={a.key} onPress={() => ask(more.id, a.key)} style={s.moreRow}>
                <View style={[s.moreIcon, { backgroundColor: a.color + '18' }]}><Ionicons name={a.icon} size={18} color={a.color} /></View>
                <T size={font.body} weight="700" color={colors.text} style={{ marginLeft: 12, flex: 1 }}>{a.title}</T>
                <Ionicons name="chevron-forward" size={16} color={colors.muted2} />
              </Pressable>
            ))}
            <Btn title="Fermer" outline onPress={() => setMore(null)} style={{ marginTop: space.md }} />
          </>
        )}
      </BottomSheet>

      {/* Confirmation */}
      <Dialog visible={!!confirm}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>{TITLES[confirm?.action] || 'Confirmer'}</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>{message()}</T>
        {confirm?.action === 'unavailable' && (
          <View style={{ marginTop: 6, marginBottom: 4 }}>
            {[{ v: 'away', l: 'Je ne suis pas à la cabine' }, { v: 'nomaterial', l: "Je n'ai pas mon matériel" }, { v: 'later', l: 'Indisponible pour le moment' }].map((r) => {
              const on = unavailReason === r.v;
              return (
                <Pressable key={r.v} onPress={() => setUnavailReason(r.v)} style={[s.reasonRow, on && s.reasonRowOn]}>
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={18} color={on ? colors.primary : colors.muted2} />
                  <T size={font.sm} weight={on ? '800' : '600'} color={on ? colors.primary : colors.text} style={{ marginLeft: 8 }}>{r.l}</T>
                </Pressable>
              );
            })}
          </View>
        )}
        <DialogButtons
          cancel="Annuler"
          confirm={confirm?.action === 'unavailable' || confirm?.action === 'requestpay' ? 'Prévenir le client' : 'Confirmer'}
          onCancel={() => setConfirm(null)}
          onConfirm={doAction}
        />
      </Dialog>

      <SubscribeSheet visible={showSub} onClose={() => setShowSub(false)} onSubscribe={(plan) => subscribe(plan)} subtitle="Paiement direct via Wave. Renouvelable à tout moment." />
    </Page>
  );
}

const s = StyleSheet.create({
  card: { marginBottom: space.sm, paddingVertical: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stateLine: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 7, marginTop: 10 },
  whoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  profileBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.primarySoft, marginLeft: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  byRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  byBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.primarySoft, marginLeft: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  moreBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  moreRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  moreIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, borderRadius: radius.md },
  reasonRowOn: { backgroundColor: colors.primarySoft },
});
