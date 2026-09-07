import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, shadow } from '../theme';
import { T, Btn, Field } from '../components/ui';
import Logo from '../components/Logo';

export default function Signup({ role, onBack, onRegister, connecting }) {
  const isGerant = role === 'gerant';
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pwd, setPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!name.trim() || !phone.trim()) { setErr('Veuillez remplir votre nom et votre numéro.'); return; }
    if (pwd.length < 4) { setErr('Le mot de passe doit contenir au moins 4 caractères.'); return; }
    if (pwd !== confirmPwd) { setErr('Les mots de passe ne correspondent pas.'); return; }
    setErr('');
    try {
      await onRegister({ role, name: name.trim(), phone, password: pwd });
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
});
