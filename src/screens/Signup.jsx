import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, shadow } from '../theme';
import { T, Btn, Field } from '../components/ui';
import { Dialog, DialogButtons } from '../components/modals';
import { PHONE_LEN, isValidPhone, fmtPhone } from '../phone';
import Logo from '../components/Logo';
import { api } from '../api';

export default function Signup({ role, onBack, onRegister, connecting, refCode }) {
  const isGerant = role === 'gerant';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [refCodeInput, setRefCodeInput] = useState((refCode || '').toUpperCase());
  const [refStatus, setRefStatus] = useState(null); // null | 'ok' | 'err'
  const [err, setErr] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false); // confirmation du numéro avant création

  // Vérifie le code de parrainage saisi (sans être connecté).
  const checkCode = async (code) => {
    const c = String(code || '').trim().toUpperCase();
    if (!c) { setRefStatus(null); return; }
    if (c.length < 3) { setRefStatus(null); return; }
    try {
      const r = await api.referral.check(c);
      setRefStatus(r?.valid ? 'ok' : 'err');
    } catch { setRefStatus('err'); }
  };
  useEffect(() => {
    let t;
    if (refCodeInput) t = setTimeout(() => checkCode(refCodeInput), 450);
    else setRefStatus(null);
    return () => clearTimeout(t);
  }, [refCodeInput]); // eslint-disable-line

  // Étape 1 : vérifications, puis ouverture de la confirmation du numéro.
  const submit = () => {
    if (!name.trim() || !phone.trim()) { setErr('Veuillez remplir votre nom et votre numéro.'); return; }
    if (!isValidPhone(phone)) { setErr(`Le numéro doit contenir exactement ${PHONE_LEN} chiffres (ex : 07 07 07 07 07).`); return; }
    if (pwd.length < 4) { setErr('Le mot de passe doit contenir au moins 4 caractères.'); return; }
    if (pwd !== confirmPwd) { setErr('Les mots de passe ne correspondent pas.'); return; }
    if (refCodeInput && refStatus === 'err') { setErr('Ce code de parrainage est invalide. Vérifiez-le ou laissez-le vide.'); return; }
    setErr('');
    setConfirmOpen(true);
  };

  // Étape 2 : l'utilisateur a confirmé son numéro → création du compte.
  const confirmCreate = async () => {
    setConfirmOpen(false);
    try {
      await onRegister({ role, name: name.trim(), phone, password: pwd, referrerCode: refCodeInput.trim().toUpperCase() || undefined });
    } catch (e) {
      setErr(e && e.message ? e.message : 'Inscription impossible');
    }
  };
  const phoneOk = isValidPhone(phone);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.primary }} contentContainerStyle={s.wrap}>
      <Pressable onPress={onBack} style={s.back}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </Pressable>

      <View style={s.center}>
        <Logo size={104} />
        <T size={28} weight="900" color="#fff" style={{ marginTop: 14 }}>Créer un compte</T>
        <T size={font.sm} weight="600" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
          Espace {isGerant ? 'Gérant(e)' : 'Client(e)'} · 1 mois d'essai gratuit
        </T>
      </View>

      <View style={s.card}>
        <Field icon={isGerant ? 'storefront-outline' : 'person-outline'} label={isGerant ? 'Nom de la cabine' : 'Votre nom'} placeholder={isGerant ? 'Ex : Nom Cabine' : 'Ex : Nom Client'} value={name} onChangeText={setName} />
        <Field
          icon="call-outline"
          label={`Numéro de téléphone (${PHONE_LEN} chiffres)`}
          placeholder="Ex : 07 07 07 07 07"
          value={phone}
          onChangeText={(t) => { setPhone(t.replace(/[^0-9]/g, '').slice(0, PHONE_LEN)); setErr(''); }}
          keyboardType="phone-pad"
          maxLength={PHONE_LEN}
          style={{ marginBottom: 6 }}
          right={phone.length ? (phoneOk ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : <T size={font.xs} weight="700" color={colors.muted}>{phone.length}/{PHONE_LEN}</T>) : null}
        />
        <T size={font.xs} weight="600" color={phone.length && !phoneOk ? colors.danger : colors.muted} style={{ marginBottom: space.lg }}>
          {phone.length && !phoneOk ? `Il manque ${PHONE_LEN - phone.length} chiffre${PHONE_LEN - phone.length > 1 ? 's' : ''}.` : `Numéro ivoirien à ${PHONE_LEN} chiffres, sans indicatif (+225).`}
        </T>

        <View style={{ marginBottom: space.lg, width: '100%' }}>
          <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginBottom: 7 }}>Code de parrainage (optionnel)</T>
          <View style={s.refField}>
            <Ionicons name="gift-outline" size={18} color={colors.primary} style={{ marginRight: 10 }} />
            <TextInput
              value={refCodeInput}
              onChangeText={(t) => { setRefCodeInput(t.toUpperCase().replace(/[^A-Z0-9]/g, '')); setErr(''); }}
              placeholder="Ex : CEL2QX9K"
              placeholderTextColor={colors.muted2}
              autoCapitalize="characters"
              autoCorrect={false}
              style={s.refInput}
            />
            {refStatus === 'ok' ? <Ionicons name="checkmark-circle" size={20} color={colors.success} /> : refStatus === 'err' ? <Ionicons name="close-circle" size={20} color={colors.danger} /> : null}
          </View>
          {refStatus === 'ok' && <T size={font.xs} weight="600" color={colors.success} style={{ marginTop: 6 }}>Code valide — vous aiderez votre parrain à gagner une commission.</T>}
          {refStatus === 'err' && <T size={font.xs} weight="600" color={colors.danger} style={{ marginTop: 6 }}>Code invalide. Vérifiez-le ou laissez vide.</T>}
        </View>

        <Field icon="lock-closed-outline" label="Mot de passe" placeholder="Au moins 4 caractères" value={pwd} onChangeText={setPwd} secure />
        <Field icon="lock-closed-outline" label="Confirmer le mot de passe" placeholder="Reprenez le mot de passe" value={confirmPwd} onChangeText={setConfirmPwd} secure />

        {err ? (
          <View style={s.error}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <T size={font.sm} weight="600" color={colors.danger} style={{ marginLeft: 6, flex: 1 }}>{err}</T>
          </View>
        ) : null}

        <Btn title="Créer mon compte" onPress={submit} icon="person-add-outline" loading={connecting} style={{ marginTop: 4 }} />

        <Pressable onPress={onBack} style={s.signup}>
          <T size={font.sm} weight="600" color={colors.muted}>Déjà un compte ?  <T size={font.sm} weight="800" color={colors.primary}>Se connecter</T></T>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} />

      {/* Confirmation des informations avant la création du compte */}
      <Dialog visible={confirmOpen}>
        <View style={{ alignItems: 'center', paddingVertical: 4 }}>
          <Ionicons name="call" size={44} color={colors.primary} />
          <T size={font.h3} weight="900" color={colors.text} style={{ marginTop: 10 }}>Vérifiez votre numéro</T>
          <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 6, textAlign: 'center' }}>
            Ce numéro servira à vous connecter{isGerant ? ' et à recevoir vos paiements Wave' : ''}. Est-il correct ?
          </T>
          <View style={s.confirmBox}>
            <T size={font.xs} weight="700" color={colors.muted}>{isGerant ? 'Nom de la cabine' : 'Nom'}</T>
            <T size={font.body} weight="800" color={colors.text}>{name.trim()}</T>
            <T size={font.xs} weight="700" color={colors.muted} style={{ marginTop: 10 }}>Numéro de téléphone</T>
            <T size={26} weight="900" color={colors.primary} style={{ letterSpacing: 1 }}>{fmtPhone(phone)}</T>
          </View>
        </View>
        <DialogButtons cancel="Modifier" confirm="Oui, créer mon compte" onCancel={() => setConfirmOpen(false)} onConfirm={confirmCreate} />
      </Dialog>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: Platform.OS === 'web' ? 'calc(22px + env(safe-area-inset-top, 0px))' : 52, paddingBottom: 40 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', marginTop: 10, marginBottom: 18 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: space.xl, ...shadow.card },
  error: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 10, marginBottom: space.md },
  signup: { alignItems: 'center', marginTop: 18 },
  refField: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 14, height: 52 },
  confirmBox: { width: '100%', backgroundColor: colors.bg, borderRadius: radius.md, padding: 14, marginTop: 14 },
  refInput: { flex: 1, fontSize: font.input, color: colors.text, height: '100%', paddingVertical: 0, outlineStyle: 'none' },
});
