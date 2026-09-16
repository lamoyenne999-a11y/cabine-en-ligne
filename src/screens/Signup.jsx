import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, shadow } from '../theme';
import { T, Btn, Field } from '../components/ui';
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

  const submit = async () => {
    if (!name.trim() || !phone.trim()) { setErr('Veuillez remplir votre nom et votre numéro.'); return; }
    if (pwd.length < 6) { setErr('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (pwd !== confirmPwd) { setErr('Les mots de passe ne correspondent pas.'); return; }
    if (refCodeInput && refStatus === 'err') { setErr('Ce code de parrainage est invalide. Vérifiez-le ou laissez-le vide.'); return; }
    setErr('');
    try {
      await onRegister({ role, name: name.trim(), phone, password: pwd, referrerCode: refCodeInput.trim().toUpperCase() || undefined });
    } catch (e) {
      setErr(e && e.message ? e.message : 'Inscription impossible');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.primary }} contentContainerStyle={s.wrap}>
      <Pressable onPress={onBack} style={s.back}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </Pressable>

      <View style={s.center}>
        <Logo size={84} />
        <T size={28} weight="900" color="#fff" style={{ marginTop: 14 }}>Créer un compte</T>
        <T size={font.sm} weight="600" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
          Espace {isGerant ? 'Gérant' : 'Client'} · 1 mois d'essai gratuit
        </T>
      </View>

      <View style={s.card}>
        <Field icon={isGerant ? 'storefront-outline' : 'person-outline'} label={isGerant ? 'Nom de la cabine' : 'Votre nom'} placeholder={isGerant ? 'Ex : Nom Cabine' : 'Ex : Nom Client'} value={name} onChangeText={setName} />
        <Field icon="call-outline" label="Numéro de téléphone" placeholder="Ex : 07 07 07 07 07" value={phone} onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))} keyboardType="phone-pad" />

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

        <Field icon="lock-closed-outline" label="Mot de passe" placeholder="Au moins 6 caractères" value={pwd} onChangeText={setPwd} secure />
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
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: Platform.OS === 'web' ? 22 : 52, paddingBottom: 40 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', marginTop: 10, marginBottom: 18 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: space.xl, ...shadow.card },
  error: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 10, marginBottom: space.md },
  signup: { alignItems: 'center', marginTop: 18 },
  refField: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: 14, height: 52 },
  refInput: { flex: 1, fontSize: font.input, color: colors.text, height: '100%', paddingVertical: 0, outlineStyle: 'none' },
});
