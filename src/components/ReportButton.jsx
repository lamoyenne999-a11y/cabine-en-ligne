import React, { useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, font } from '../theme';
import { T, Btn } from './ui';
import { Dialog, DialogButtons } from './modals';
import { api } from '../api';

// ============================================================
//  Bouton « Signaler » (client → gérant, gérant → client).
//  Le motif est déterminé par l'état de la demande : on ne propose le
//  signalement QUE dans les cas prévus par les règles :
//    client : payé (réception confirmée) mais pas servi ; ou payé puis refusé/indispo sans remboursement
//    gérant : client servi mais pas payé
//  Le signalement est envoyé au propriétaire ; la personne signalée est prévenue
//  et a une chance de régulariser avant toute suspension.
// ============================================================

const LABELS = {
  paid_not_served: 'J\'ai payé, le gérant ne m\'a pas servi (ni remboursé)',
  paid_declined_no_refund: 'J\'ai payé, le gérant a refusé / était indisponible mais ne m\'a pas remboursé',
  served_not_paid: 'J\'ai servi le client, il n\'a pas payé',
};

// Retourne le motif applicable, ou null si aucun signalement n'est possible.
export function reportReasonFor(role, d) {
  if (!d || d.reportedAt) return null;
  if (role === 'client') {
    if (d.moneyReceived && d.status !== 'completed') return 'paid_not_served';
    if (d.paidAt && ['declined', 'unavailable'].includes(d.status)) return 'paid_declined_no_refund';
    return null;
  }
  if (role === 'gerant') {
    if (d.status === 'completed' && !d.moneyReceived) return 'served_not_paid';
  }
  return null;
}

export default function ReportButton({ role, demande, otherName, onDone, style }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const reason = reportReasonFor(role, demande);
  if (!reason && !done) return null;

  const send = async () => {
    setBusy(true); setErr('');
    try {
      await (role === 'client' ? api.client.report : api.gerant.report)(demande.id, reason, msg);
      setDone(true); setOpen(false);
      onDone && onDone();
    } catch (e) { setErr(e?.message || 'Envoi impossible. Réessayez.'); }
    finally { setBusy(false); }
  };

  if (done || demande.reportedAt) {
    return (
      <View style={[s.doneBox, style]}>
        <Ionicons name="flag" size={14} color={colors.muted} />
        <T size={font.xs} weight="700" color={colors.muted} style={{ marginLeft: 6, flex: 1 }}>
          Signalement envoyé à Cabine En Ligne. {otherName} a été prévenu(e).
        </T>
      </View>
    );
  }

  return (
    <>
      <Btn title={`Signaler ${otherName}`} icon="flag-outline" outline color={colors.danger} size="sm" onPress={() => setOpen(true)} style={style} />
      <Dialog visible={open}>
        <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Signaler {otherName} ?</T>
        <View style={s.reasonBox}>
          <Ionicons name="flag" size={16} color={colors.danger} />
          <T size={font.sm} weight="700" color={colors.danger} style={{ marginLeft: 8, flex: 1 }}>{LABELS[reason]}</T>
        </View>
        <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 8 }}>
          Le signalement est transmis à Cabine En Ligne, qui pourra suspendre le compte de {otherName} s'il ne régularise pas. {otherName} sera prévenu(e) et pourra encore régulariser. Les signalements abusifs peuvent aussi entraîner une suspension.
        </T>
        <TextInput
          value={msg} onChangeText={setMsg} placeholder="Précision (facultatif) : date, montant, ce qui s'est passé…"
          placeholderTextColor={colors.muted2} multiline style={s.input} maxLength={300}
        />
        {err ? <T size={font.xs} weight="700" color={colors.danger} style={{ textAlign: 'center', marginTop: 6 }}>{err}</T> : null}
        <DialogButtons cancel="Annuler" confirm={busy ? 'Envoi…' : 'Envoyer le signalement'} onCancel={() => setOpen(false)} onConfirm={busy ? () => {} : send} />
      </Dialog>
    </>
  );
}

const s = StyleSheet.create({
  reasonBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 10, marginTop: 10 },
  input: { marginTop: 10, minHeight: 70, borderWidth: 1.4, borderColor: colors.border, borderRadius: radius.md, padding: 10, fontSize: font.sm, color: colors.text, textAlignVertical: 'top', backgroundColor: colors.bg },
  doneBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 7 },
});
