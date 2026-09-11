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

export default function GerantDemandes() {
  const { state, acceptDemande, declineDemande, completeDemande, subscribe } = useStore();
  const [confirm, setConfirm] = useState(null); // { id, action }
  const [showSub, setShowSub] = useState(false);
  // L'inbox ne montre que les demandes À TRAITER :
  //  - 'pending'   : le client vient d'envoyer, le gérant doit accepter ou refuser.
  //  - 'paid'      : le client a déjà payé (avant acceptation), le gérant doit servir.
  // Les demandes déjà closes (acceptée/refusée/annulée/complétée) vont dans l'Historique.
  const demandes = (state.gerantDemandes || []).filter((d) => d.status === 'pending' || d.status === 'paid');

  const doAction = () => {
    if (!confirm) return;
    if (confirm.action === 'accept') acceptDemande(confirm.id);
    else if (confirm.action === 'decline') declineDemande(confirm.id);
    else if (confirm.action === 'complete') completeDemande(confirm.id);
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
        const isPaid = d.status === 'paid';
        return (
          <Card key={d.id} style={{ marginBottom: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.icon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={d.type === 'internet' ? 'wifi-outline' : d.type === 'minutes' ? 'call-outline' : 'phone-portrait-outline'} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T size={font.h3} weight="800" color={colors.text}>{d.type === 'unites' ? 'Unités' : d.type === 'minutes' ? 'Minutes' : 'Internet'}</T>
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

            {isPending && (
              <View style={s.actions}>
                <Btn title="Refuser" icon="close" outline color={colors.danger} onPress={() => setConfirm({ id: d.id, action: 'decline' })} style={{ flex: 1, marginRight: 6 }} />
                <Btn title="Accepter" icon="checkmark" onPress={() => setConfirm({ id: d.id, action: 'accept' })} style={{ flex: 1 }} />
              </View>
            )}
            {isPaid && (
              <>
                <View style={s.paidBox}>
                  <Ionicons name="water" size={16} color={colors.wave} />
                  <T size={font.sm} weight="700" color={colors.wave} style={{ marginLeft: 8, flex: 1 }}>
                    Le client a déjà payé {d.amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF via Wave.
                  </T>
                </View>
                <View style={s.actions}>
                  <Btn title="Refuser" icon="close-circle" outline color={colors.danger} onPress={() => setConfirm({ id: d.id, action: 'decline' })} style={{ flex: 1 }} />
                </View>
                <View style={s.actions}>
                  <Btn title="Accepter" icon="checkmark" outline onPress={() => setConfirm({ id: d.id, action: 'accept' })} style={{ flex: 1, marginRight: 6 }} />
                  <Btn title="J'ai servi" icon="checkmark-done" onPress={() => setConfirm({ id: d.id, action: 'complete' })} style={{ flex: 1 }} />
                </View>
              </>
            )}
            {d.status === 'accepted' && (
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 12, textAlign: 'center' }}>
                En attente du paiement Wave du client ({d.gerantWave ? 'numéro ' + d.gerantWave : ''}).
              </T>
            )}
            {d.status === 'canceled' && (
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 12, textAlign: 'center' }}>
                Le client a annulé cette demande (non traitée à temps).
              </T>
            )}
          </Card>
        );
      })}

      <Dialog visible={!!confirm}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>
          {confirm?.action === 'accept' ? 'Accepter la demande' : confirm?.action === 'decline' ? 'Refuser la demande' : 'Confirmer le service'}
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
            return 'Vous avez bien servi le client ?';
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
  paidBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E7F0FE', borderRadius: radius.md, padding: 12, marginTop: 12 },
});
