import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../../theme';
import { T, Btn, Card, Pill } from '../../components/ui';
import { Page } from '../../components/Shell';
import { Dialog, DialogButtons } from '../../components/modals';
import { useStore } from '../../store';

const iconFor = (type) => ({
  unites: 'phone-portrait-outline', minutes: 'call-outline', internet: 'wifi-outline',
}[type] || 'phone-portrait-outline');

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function GerantDemandes() {
  const { state, confirmDemande } = useStore();
  const now = useNow();
  const mount = useRef(Date.now());
  const [confirmId, setConfirmId] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const pending = state.demandes.filter((d) => d.status === 'en_attente');

  const remaining = (d) => Math.max(0, d.expiresIn - Math.floor((now - mount.current) / 1000));
  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const doConfirm = () => {
    confirmDemande(confirmId);
    setConfirmId(null);
    setShowSuccess(true);
  };

  return (
    <Page title="Demandes">
      <View style={s.banner}>
        <Ionicons name="notifications" size={20} color={colors.success} />
        <T size={font.body} weight="800" color={colors.success} style={{ marginLeft: 10 }}>
          {pending.length} demande{pending.length !== 1 ? 's' : ''} en attente
        </T>
      </View>

      {pending.map((d) => {
        const left = remaining(d);
        const expired = left <= 0;
        return (
          <Card key={d.id} style={{ marginBottom: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[s.icon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={iconFor(d.type)} size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T size={font.h3} weight="800" color={colors.text}>{d.type === 'unites' ? 'Unités' : d.type === 'minutes' ? 'Minutes' : 'Internet'}</T>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                  <Ionicons name="time-outline" size={13} color={colors.muted} />
                  <T size={font.xs} weight="600" color={colors.muted} style={{ marginLeft: 4 }}>Il y a 2 minutes</T>
                </View>
              </View>
              <T size={font.h3} weight="800" color={colors.primary}>
                {d.amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} XOF
              </T>
            </View>

            <View style={s.infoRow}>
              <T size={font.sm} weight="600" color={colors.textSoft}>Client :</T>
              <T size={font.body} weight="700" color={colors.text}>{d.client}</T>
            </View>
            <View style={[s.infoRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <T size={font.sm} weight="600" color={colors.textSoft}>Bénéficiaire :</T>
              <T size={font.body} weight="700" color={colors.text}>{d.benef || d.client}</T>
            </View>

            <View style={s.timer}>
              <Ionicons name="alarm-outline" size={15} color={expired ? colors.danger : colors.warn} />
              <T size={font.sm} weight="700" color={expired ? colors.danger : colors.warn} style={{ marginLeft: 6 }}>
                {expired ? 'Demande expirée' : `Expire dans ${fmt(left)}`}
              </T>
            </View>

            <Btn
              title="Confirmer la demande"
              icon="checkmark-circle-outline"
              onPress={() => setConfirmId(d.id)}
              disabled={expired}
              style={{ marginTop: space.md }}
            />
          </Card>
        );
      })}

      {/* Confirm dialog */}
      <Dialog visible={!!confirmId}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Confirmer la demande</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          Avez-vous traité cette demande avec succès ?
        </T>
        <DialogButtons cancel="Annuler" confirm="Confirmer" onCancel={() => setConfirmId(null)} onConfirm={doConfirm} />
      </Dialog>

      {/* Success dialog */}
      <Dialog visible={showSuccess}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Succès</T>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6, marginBottom: 6 }}>
          La demande a été confirmée et créditée à votre compte.
        </T>
        <DialogButtons confirm="OK" onConfirm={() => setShowSuccess(false)} />
      </Dialog>
    </Page>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.successBg,
    borderRadius: radius.md, padding: 14, marginBottom: space.lg,
  },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginTop: 4 },
  timer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.warnBg, borderRadius: radius.md, paddingVertical: 10, marginTop: 4,
  },
});
