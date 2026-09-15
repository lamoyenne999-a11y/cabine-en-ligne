import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, Pill } from '../../components/ui';
import { Page } from '../../components/Shell';
import { Dialog, DialogButtons } from '../../components/modals';
import SubBanner from '../../components/SubBanner';
import SubscribeSheet from '../../components/Subscribe';
import { useStore } from '../../store';

const STATUS = {
  pending: { label: 'En attente', color: colors.warn, bg: colors.warnBg, icon: 'time' },
  accepted: { label: 'Acceptée', color: colors.primary, bg: colors.primarySoft, icon: 'checkmark-circle' },
  declined: { label: 'Refusée', color: colors.danger, bg: colors.dangerBg, icon: 'close-circle' },
  paid: { label: 'Payée', color: '#2E7BF6', bg: '#E7F0FE', icon: 'wallet' },
  completed: { label: 'Complétée', color: colors.success, bg: colors.successBg, icon: 'checkmark-done' },
  canceled: { label: 'Annulée', color: colors.muted, bg: colors.gray, icon: 'close-circle-outline' },
};

const TYPE_ICON = { unites: 'phone-portrait-outline', minutes: 'call-outline', internet: 'wifi-outline', forfait: 'layers-outline' };
const TYPE_LABEL = { unites: 'Unités', minutes: 'Minutes', internet: 'Internet', forfait: 'Appel + Internet' };

export default function GerantDemandes() {
  const { state, acceptDemande, declineDemande, completeDemande, receiveDemande, subscribe } = useStore();
  const [confirm, setConfirm] = useState(null); // { id, action }
  const [showSub, setShowSub] = useState(false);
  // L'inbox ne montre que les demandes qui ATTENDENT UNE ACTION du gérant :
  //  - 'pending'   : le client vient d'envoyer → accepter ou refuser.
  //  - 'accepted'  : acceptée, on attend le paiement → « Argent reçu » dès qu'il arrive.
  //  - 'paid'      : le client dit avoir payé → confirmer la réception, puis servir.
  //  - 'completed' NON réglée : le client a été servi mais l'argent n'est pas confirmé.
  // Les demandes closes (réglées / refusées / annulées) vont dans l'Historique.
  const demandes = (state.gerantDemandes || []).filter((d) =>
    d.status === 'pending' || d.status === 'accepted' || d.status === 'paid' || (d.status === 'completed' && !d.moneyReceived));
  const fmt = (n) => (n || 0).toLocaleString('fr-FR').replace(/\u202f/g, ' ');

  const doAction = () => {
    if (!confirm) return;
    if (confirm.action === 'accept') acceptDemande(confirm.id);
    else if (confirm.action === 'decline') declineDemande(confirm.id);
    else if (confirm.action === 'complete') completeDemande(confirm.id);
    else if (confirm.action === 'received') receiveDemande(confirm.id);
    setConfirm(null);
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
        const isPending = d.status === 'pending';
        const isAccepted = d.status === 'accepted';
        const isPaid = d.status === 'paid';
        const isCompleted = d.status === 'completed';
        return (
          <Card key={d.id} style={{ marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.icon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={TYPE_ICON[d.type] || 'phone-portrait-outline'} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T size={font.h3} weight="800" color={colors.text}>{TYPE_LABEL[d.type] || 'Demande'}</T>
                <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>Client : {d.clientName} · pour {d.benefName === d.benefPhone ? d.benefPhone : d.benefName}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T size={font.h3} weight="800" color={colors.primary}>{d.amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF</T>
                <Pill icon={st.icon} color={st.color} bg={st.bg} style={{ marginTop: 6 }}>{st.label}</Pill>
              </View>
            </View>

            <View style={s.infoRow}>
              <T size={font.sm} weight="600" color={colors.muted}>Bénéficiaire :</T>
              <T size={font.sm} weight="700" color={colors.text}>{d.benefName === d.benefPhone ? d.benefPhone : `${d.benefName} (${d.benefPhone})`}</T>
            </View>

            {/* Étiquette paiement : reçu / déclaré par le client / en attente */}
            <View style={[s.payState, { backgroundColor: d.moneyReceived ? colors.successBg : isPaid ? '#E7F0FE' : colors.warnBg }]}>
              <Ionicons name={d.moneyReceived ? 'checkmark-circle' : isPaid ? 'water' : 'time-outline'} size={16} color={d.moneyReceived ? colors.success : isPaid ? colors.wave : colors.warn} />
              <T size={font.sm} weight="700" color={d.moneyReceived ? colors.success : isPaid ? colors.wave : colors.warn} style={{ marginLeft: 8, flex: 1 }}>
                {d.moneyReceived
                  ? `Argent reçu : ${fmt(d.amount)} XOF confirmés sur votre Wave.`
                  : isPaid
                    ? `Le client déclare avoir payé ${fmt(d.amount)} XOF via Wave. Vérifiez votre Wave, puis confirmez.`
                    : isCompleted
                      ? `Client servi, mais paiement de ${fmt(d.amount)} XOF pas encore reçu. Le client a été relancé.`
                      : isAccepted
                        ? `En attente du paiement Wave du client${d.gerantWave ? ' (numéro ' + d.gerantWave + ')' : ''}.`
                        : `Paiement non reçu pour l'instant.`}
              </T>
            </View>

            {/* Étape 1 : accepter / refuser */}
            {isPending && (
              <View style={s.actions}>
                <Btn title="Refuser" icon="close" outline color={colors.danger} onPress={() => setConfirm({ id: d.id, action: 'decline' })} style={{ flex: 1, marginRight: 6 }} />
                <Btn title="Accepter" icon="checkmark" onPress={() => setConfirm({ id: d.id, action: 'accept' })} style={{ flex: 1 }} />
              </View>
            )}
            {/* Étape 2 : confirmer l'argent reçu (dès qu'il arrive sur le Wave) */}
            {!d.moneyReceived && (isAccepted || isPaid || isCompleted) && (
              <View style={s.actions}>
                {isPaid && <Btn title="Refuser" icon="close-circle" outline color={colors.danger} onPress={() => setConfirm({ id: d.id, action: 'decline' })} style={{ flex: 1, marginRight: 6 }} />}
                <Btn title="Argent reçu ✓" icon="cash-outline" color={colors.success} onPress={() => setConfirm({ id: d.id, action: 'received' })} style={{ flex: 1 }} />
              </View>
            )}
            {/* Étape 3 : servir le client */}
            {!isCompleted && !isPending && (
              <View style={s.actions}>
                <Btn title="J'ai servi le client" icon="checkmark-done" outline={!d.moneyReceived} onPress={() => setConfirm({ id: d.id, action: 'complete' })} style={{ flex: 1 }} />
              </View>
            )}
            {!isCompleted && !isPending && !d.moneyReceived && (
              <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: 8, textAlign: 'center' }}>
                Vous pouvez servir avant d'avoir reçu l'argent : le client sera prévenu qu'il doit encore payer.
              </T>
            )}
          </Card>
        );
      })}

      <Dialog visible={!!confirm}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>
          {confirm?.action === 'accept' ? 'Accepter la demande' : confirm?.action === 'decline' ? 'Refuser la demande' : confirm?.action === 'received' ? "Confirmer l'argent reçu" : 'Confirmer le service'}
        </T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          {(() => {
            if (confirm?.action === 'accept') return 'Le client vous enverra le paiement via votre Wave.';
            if (confirm?.action === 'decline') {
              const wasPaid = (demandes.find((d) => d.id === confirm?.id) || {}).status === 'paid';
              return wasPaid
                ? 'Le client a déjà payé. Si vous refusez, le montant doit lui être remboursé (par Wave).'
                : 'La demande sera signalée comme refusée.';
            }
            const cur = demandes.find((d) => d.id === confirm?.id) || {};
            if (confirm?.action === 'received') return `Vous confirmez avoir reçu ${fmt(cur.amount)} XOF de ${cur.clientName || 'ce client'} sur votre Wave ? Le client sera notifié.`;
            return cur.moneyReceived
              ? 'Vous avez bien crédité le client ? La demande sera marquée complétée et le client notifié.'
              : "Vous avez crédité le client sans avoir encore reçu l'argent ? Il sera notifié qu'il doit encore régler. Vous pourrez confirmer la réception plus tard.";
          })()}
        </T>
        <DialogButtons cancel="Annuler" confirm="Confirmer" onCancel={() => setConfirm(null)} onConfirm={doAction} />
      </Dialog>

      <SubscribeSheet visible={showSub} onClose={() => setShowSub(false)} onSubscribe={(plan) => subscribe(plan)} subtitle="Paiement direct via Wave. Renouvelable à tout moment." />
    </Page>
  );
}

const s = StyleSheet.create({
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border },
  actions: { flexDirection: 'row', marginTop: space.md },
  payState: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: 10, marginTop: 12 },
  paidBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E7F0FE', borderRadius: radius.md, padding: 12, marginTop: 12 },
});
