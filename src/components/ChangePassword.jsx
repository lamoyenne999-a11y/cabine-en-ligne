import React, { useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Card, ListRow, Btn } from './ui';
import { Dialog } from './modals';
import { api } from '../api';

// ============================================================
//  « Changer mon mot de passe » (Profil client et gérant).
//  Ancien mot de passe exigé, nouveau ≥ 4 caractères, confirmation.
// ============================================================
export default function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [nw2, setNw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const reset = () => { setCur(''); setNw(''); setNw2(''); setErr(''); setDone(false); setShow(false); };
  const close = () => { setOpen(false); reset(); };
  const canSend = cur.length > 0 && nw.length >= 4 && nw === nw2 && !busy;
  const hint = nw.length > 0 && nw.length < 4 ? '4 caractères minimum.' : nw2.length > 0 && nw !== nw2 ? 'Les deux mots de passe ne correspondent pas.' : '';

  const submit = async () => {
    setBusy(true); setErr('');
    try { await api.changePassword(cur, nw); setDone(true); }
    catch (e) { setErr(e?.message || 'Changement impossible.'); }
    finally { setBusy(false); }
  };

  const field = (value, onChange, placeholder) => (
    <View style={s.inputRow}>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted2} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} style={s.input} />
    </View>
  );

  return (
    <>
      <Card style={{ marginTop: space.lg }}>
        <ListRow icon="key-outline" label="Changer mon mot de passe" onPress={() => setOpen(true)} />
      </Card>
      <Dialog visible={open} onClose={close}>
        {done ? (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={46} color={colors.success} />
            <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 8 }}>Mot de passe changé</T>
            <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 4 }}>Utilisez-le dès votre prochaine connexion.</T>
            <Btn title="Fermer" size="sm" onPress={close} style={{ marginTop: 14, alignSelf: 'stretch' }} />
          </View>
        ) : (
          <>
            <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Changer mon mot de passe</T>
            {field(cur, setCur, 'Mot de passe actuel')}
            {field(nw, setNw, 'Nouveau mot de passe (4 car. min.)')}
            {field(nw2, setNw2, 'Confirmez le nouveau mot de passe')}
            <Pressable onPress={() => setShow((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }} hitSlop={8}>
              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={16} color={colors.primary} />
              <T size={font.xs} weight="700" color={colors.primary} style={{ marginLeft: 6 }}>{show ? 'Masquer' : 'Afficher'} les mots de passe</T>
            </Pressable>
            {hint ? <T size={font.xs} weight="700" color={colors.warn} style={{ marginTop: 6 }}>{hint}</T> : null}
            {err ? <T size={font.sm} weight="700" color={colors.danger} style={{ marginTop: 8, textAlign: 'center' }}>{err}</T> : null}
            <Btn title="Enregistrer" icon="checkmark" size="sm" disabled={!canSend} loading={busy} onPress={submit} style={{ marginTop: 12 }} />
            <Btn title="Annuler" size="sm" outline onPress={close} style={{ marginTop: 8 }} />
          </>
        )}
      </Dialog>
    </>
  );
}

const s = StyleSheet.create({
  inputRow: { marginTop: 10 },
  input: { borderWidth: 1.4, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 12, fontSize: font.body, color: colors.text, backgroundColor: colors.bg },
});
