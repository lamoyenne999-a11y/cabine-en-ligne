import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, Pill } from '../../components/ui';
import { Page } from '../../components/Shell';
import { Dialog, DialogButtons } from '../../components/modals';
import { useStore } from '../../store';

const STATUS = {
  pending: { label: 'En attente', color: colors.warn, bg: colors.warnBg, icon: 'time' },
  accepted: { label: 'Acceptée', color: colors.primary, bg: colors.primarySoft, icon: 'checkmark-circle' },
  declined: { label: 'Refusée', color: colors.danger, bg: colors.dangerBg, icon: 'close-circle' },
  paid: { label: 'Payée', color: '#2E7BF6', bg: '#E7F0FE', icon: 'wallet' },
  completed: { label: 'Complétée', color: colors.success, bg: colors.successBg, icon: 'checkmark-done' },
};

export default function GerantDemandes() {
  const { state, acceptDemande, declineDemande, completeDemande } = useStore();
  const [confirm, setConfirm] = useState(null); // { id, action }
  const demandes = state.gerantDemandes || [];

  const doAction = () => {
    if (!confirm) return;
    if (confirm.action === 'accept') acceptDemande(confirm.id);
    else if (confirm.action === 'decline') declineDemande(confirm.id);
    else if (confirm.action === 'complete') completeDemande(confirm.id);
    setConfirm(null);
  };

  return (
    <Page title="Demandes reçues">
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
                <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>Client : {d.clientName} · pour {d.benefName}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T size={font.h3} weight="800" color={colors.primary}>{d.amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF</T>
                <Pill icon={st.icon} color={st.color} bg={st.bg} style={{ marginTop: 6 }}>{st.label}</Pill>
              </View>
            </View>

            <View style={s.infoRow}>
              <T size={font.sm} weight="600" color={colors.muted}>Bénéficiaire :</T>
              <T size={font.sm} weight="700" color={colors.text}>{d.benefName} ({d.benefPhone})</T>
            </View>

            {isPending && (
              <View style={s.actions}>
                <Btn title="Refuser" icon="close" outline color={colors.danger} onPress={() => setConfirm({ id: d.id, action: 'decline' })} style={{ flex: 1, marginRight: 6 }} />
                <Btn title="Accepter" icon="checkmark" onPress={() => setConfirm({ id: d.id, action: 'accept' })} style={{ flex: 1 }} />
              </View>
            )}
            {isPaid && (
              <Btn title="J'ai servi le client" icon="checkmark-done" onPress={() => setConfirm({ id: d.id, action: 'complete' })} style={{ marginTop: space.md }} />
            )}
            {d.status === 'accepted' && (
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 12, textAlign: 'center' }}>
                En attente du paiement Wave du client ({d.gerantWave ? 'marchand ' + d.gerantWave : ''}).
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
          {confirm?.action === 'accept' ? 'Le client vous enverra le paiement via votre Wave marchand.' : confirm?.action === 'decline' ? 'La demande sera signalée comme refusée.' : 'Vous avez bien crédité le bénéficiaire ?'}
        </T>
        <DialogButtons cancel="Annuler" confirm="Confirmer" onCancel={() => setConfirm(null)} onConfirm={doAction} />
      </Dialog>
    </Page>
  );
}

const s = StyleSheet.create({
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border },
  actions: { flexDirection: 'row', marginTop: space.md },
});
