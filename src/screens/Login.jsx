import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, shadow } from '../theme';
import { T, Btn, Field } from '../components/ui';
import Logo from '../components/Logo';

// Compte de démonstration CLIENT : il existe réellement côté backend et ce
// mot de passe fonctionne. Il n'y a AUCUN compte gérant de démonstration
// (pour ne pas afficher de faux gérants dans les listes des clients).
const DEMO_CLIENT = { phone: '0101010101', password: 'demo123' };

export default function Login({ role, onBack, onLogin, onSignup, connecting }) {
  const [phone, setPhone] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const isGerant = role === 'gerant';

  const useDemo = () => {
    setPhone(DEMO_CLIENT.phone);
    setPwd(DEMO_CLIENT.password);
    setErr('');
  };

  const submit = async () => {
    if (!phone.trim()) { setErr('Veuillez saisir votre numéro de téléphone.'); return; }
    setErr('');
    try {
      await onLogin({ role, phone, password: pwd });
    } catch (e) {
      setErr(e && e.message ? e.message : 'Connexion impossible');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.primary }} contentContainerStyle={s.wrap}>
      <Pressable onPress={onBack} style={s.back}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </Pressable>

      <View style={s.center}>
        <Logo size={96} />
        <T size={32} weight="900" color="#fff" style={{ marginTop: 18 }}>Connexion</T>
        <T size={font.body} weight="600" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
          Espace {isGerant ? 'Gérant' : 'Client'}
        </T>
      </View>

      <View style={s.card}>
        <Field
          icon="call-outline"
          label="Numéro de téléphone"
          placeholder="Ex : 07 07 07 07 07"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
          keyboardType="phone-pad"
        />
        <Field
          icon="lock-closed-outline"
          label="Mot de passe"
          placeholder="Votre mot de passe"
          value={pwd}
          onChangeText={setPwd}
          secure
        />

        {isGerant ? (
          <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: -8, marginBottom: space.md }}>
            Pas de compte démo gérant : inscrivez-vous pour créer votre compte gérant.
          </T>
        ) : (
          <View style={s.demo}>
            <Ionicons name="flask-outline" size={16} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <T size={font.xs} weight="700" color={colors.textSoft}>Compte démo client</T>
              <T size={font.xs} weight="600" color={colors.muted}>0101010101 · mot de passe demo123</T>
            </View>
            <Pressable onPress={useDemo} style={s.demoBtn}>
              <T size={font.xs} weight="800" color="#fff">Utiliser</T>
            </Pressable>
          </View>
        )}

        {err ? (
          <View style={s.error}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <T size={font.sm} weight="600" color={colors.danger} style={{ marginLeft: 6, flex: 1 }}>{err}</T>
          </View>
        ) : null}

        <Btn title="Se connecter" onPress={submit} icon="log-in-outline" loading={connecting} style={{ marginTop: 4 }} />

        <Pressable onPress={onSignup} style={s.signup}>
          <T size={font.sm} weight="600" color={colors.muted}>
            Pas encore de compte ?  <T size={font.sm} weight="800" color={colors.primary}>S'inscrire</T>
          </T>
        </Pressable>
        <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: 8 }}>
          Votre numéro de téléphone est votre identifiant.
        </T>
      </View>

      <View style={{ flex: 1 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: Platform.OS === 'web' ? 22 : 52, paddingBottom: 40 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', marginTop: 10, marginBottom: 22 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: space.xl, ...shadow.card },
  signup: { alignItems: 'center', marginTop: 18 },
  error: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.dangerBg, borderRadius: radius.sm, padding: 10, marginBottom: space.md },
  demo: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.sm, padding: 10, marginTop: -8, marginBottom: space.md },
  demoBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, marginLeft: 8 },
});
