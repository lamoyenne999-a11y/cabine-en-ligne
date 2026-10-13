import React, { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Card, ListRow, Btn } from './ui';
import { Dialog } from './modals';
import { api, setToken } from '../api';
import { useStore } from '../store';
import ChangePassword from './ChangePassword';

// ============================================================
//  « Mon compte » (Profil client et gérant) :
//   - Modifier mon nom        (1 fois par 30 jours)
//   - Changer mon numéro      (1 fois par 30 jours, mot de passe exigé)
//   - Changer mon mot de passe
//   - Supprimer mon compte    (à tout moment, mot de passe exigé, définitif)
//  Chaque action est journalisée dans l'Espace propriétaire (onglet Actions).
// ============================================================
const fmtDay = (t) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

export default function AccountSettings() {
  const { state, dispatch, logout } = useStore();
  const u = state.user;
  const [info, setInfo] = useState(null); // { canChangeName, nameNextAt, canChangePhone, phoneNextAt }
  const [open, setOpen] = useState(null); // 'name' | 'phone' | 'delete'
  const [val, setVal] = useState('');
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const loadInfo = async () => { try { setInfo(await api.account()); } catch { /* hors ligne : on laisse le serveur trancher */ } };
  useEffect(() => { loadInfo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (k) => { setOpen(k); setVal(k === 'name' ? (u?.name || '') : ''); setPwd(''); setErr(''); setDone(''); };
  const close = () => { setOpen(null); setBusy(false); };

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      if (open === 'name') {
        const r = await api.changeName(val);
        if (r?.token) setToken(r.token);
        dispatch({ type: 'SET_USER_PATCH', payload: { name: r.user.name } });
        setInfo(r); setDone(`Votre nom est maintenant « ${r.user.name} ».`);
      } else if (open === 'phone') {
        const r = await api.changePhone(val, pwd);
        dispatch({ type: 'SET_USER_PATCH', payload: { phone: r.user.phone, waveNumber: r.user.waveNumber } });
        setInfo(r); setDone(`Votre numéro est maintenant ${r.user.phone}. Connectez-vous désormais avec ce numéro.`);
      } else if (open === 'delete') {
        await api.deleteAccount(pwd);
        close(); logout(); return;
      }
    } catch (e) { setErr(e?.message || 'Action impossible. Réessayez.'); }
    finally { setBusy(false); }
  };

  const canName = !info || info.canChangeName;
  const canPhone = !info || info.canChangePhone;
  const phoneOk = /^[0-9]{10}$/.test(val);
  const canSend = !busy && (open === 'name' ? val.trim().length >= 2 && val.trim() !== u?.name
    : open === 'phone' ? phoneOk && val !== u?.phone && pwd.length >= 4
    : pwd.length >= 4);

  return (
    <>
      <Card style={{ marginTop: space.lg }}>
        <T size={font.sm} weight="800" color={colors.muted} style={{ marginBottom: 2 }}>MON COMPTE</T>
        <ListRow icon="person-outline" label="Modifier mon nom" value={canName ? u?.name : `dès le ${fmtDay(info.nameNextAt)}`} onPress={() => start('name')} />
        <ListRow icon="call-outline" label="Changer mon numéro" value={canPhone ? u?.phone : `dès le ${fmtDay(info.phoneNextAt)}`} onPress={() => start('phone')} />
        <ChangePassword row />
        <ListRow icon="trash-outline" label="Supprimer mon compte" onPress={() => start('delete')} />
      </Card>

      <Dialog visible={!!open} onClose={close}>
        {done ? (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={46} color={colors.success} />
            <T size={font.sm} weight="700" color={colors.text} style={{ textAlign: 'center', marginTop: 8 }}>{done}</T>
            <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 4 }}>Prochain changement possible dans 30 jours.</T>
            <Btn title="Fermer" size="sm" onPress={close} style={{ marginTop: 14, alignSelf: 'stretch' }} />
          </View>
        ) : open === 'name' ? (
          <>
            <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Modifier mon nom</T>
            {!canName ? (
              <T size={font.sm} weight="700" color={colors.warn} style={{ textAlign: 'center', marginTop: 8 }}>Vous avez déjà changé de nom ce mois-ci. Prochain changement possible le {fmtDay(info.nameNextAt)}.</T>
            ) : (
              <>
                <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 4 }}>Possible une fois par mois. C'est le nom que voient {u?.role === 'gerant' ? 'vos clients' : 'les gérants'}.</T>
                <TextInput value={val} onChangeText={setVal} placeholder="Nouveau nom" placeholderTextColor={colors.muted2} maxLength={60} style={s.input} />
              </>
            )}
          </>
        ) : open === 'phone' ? (
          <>
            <T size={font.h3} weight="800" color={colors.text} style={{ textAlign: 'center' }}>Changer mon numéro</T>
            {!canPhone ? (
              <T size={font.sm} weight="700" color={colors.warn} style={{ textAlign: 'center', marginTop: 8 }}>Vous avez déjà changé de numéro ce mois-ci. Prochain changement possible le {fmtDay(info.phoneNextAt)}.</T>
            ) : (
              <>
                <T size={font.xs} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 4 }}>
                  Possible une fois par mois. Ce numéro sert à vous connecter{u?.role === 'gerant' ? ' et à recevoir les paiements Wave de vos clients' : ''}.
                </T>
                <TextInput value={val} onChangeText={(t) => setVal(t.replace(/[^0-9]/g, '').slice(0, 10))} placeholder="Nouveau numéro (10 chiffres)" placeholderTextColor={colors.muted2} keyboardType="number-pad" style={s.input} />
                <TextInput value={pwd} onChangeText={setPwd} placeholder="Votre mot de passe" placeholderTextColor={colors.muted2} secureTextEntry autoCapitalize="none" style={s.input} />
              </>
            )}
          </>
        ) : (
          <>
            <T size={font.h3} weight="800" color={colors.danger} style={{ textAlign: 'center' }}>Supprimer mon compte ?</T>
            <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 6 }}>
              Définitif : votre compte, vos demandes, vos contacts et votre abonnement sont effacés. Vous pourrez créer un nouveau compte plus tard avec le même numéro.
            </T>
            <TextInput value={pwd} onChangeText={setPwd} placeholder="Votre mot de passe pour confirmer" placeholderTextColor={colors.muted2} secureTextEntry autoCapitalize="none" style={s.input} />
          </>
        )}
        {!done && err ? <T size={font.sm} weight="700" color={colors.danger} style={{ marginTop: 8, textAlign: 'center' }}>{err}</T> : null}
        {!done && ((open === 'name' && canName) || (open === 'phone' && canPhone) || open === 'delete') ? (
          <Btn title={open === 'delete' ? 'Oui, supprimer définitivement' : 'Enregistrer'} icon={open === 'delete' ? 'trash' : 'checkmark'} color={open === 'delete' ? colors.danger : colors.primary} size="sm" disabled={!canSend} loading={busy} onPress={submit} style={{ marginTop: 12 }} />
        ) : null}
        {!done ? <Btn title={open === 'delete' ? 'Non, garder mon compte' : 'Annuler'} size="sm" outline onPress={close} style={{ marginTop: 8 }} /> : null}
      </Dialog>
    </>
  );
}

const s = StyleSheet.create({
  input: { marginTop: 10, borderWidth: 1.4, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 12, fontSize: font.body, color: colors.text, backgroundColor: colors.bg },
});
