import React, { useState } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, shadow } from '../theme';
import { T, Btn, Field } from '../components/ui';
import Logo from '../components/Logo';

export default function Login({ role, onBack, onLogin, onSignup }) {
  const [phone, setPhone] = useState(role === 'gerant' ? '0202020202' : '0101010101');
  const [pwd, setPwd] = useState('');
  const isGerant = role === 'gerant';

  const submit = () => {
    if (!phone.trim()) return;
    onLogin({
      role,
      name: isGerant ? 'Marie Diallo' : 'Jean Dupont',
      phone,
      email: isGerant ? 'marie@example.com' : 'jean@example.com',
    });
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
          placeholder="Numéro de téléphone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Field
          icon="lock-closed-outline"
          placeholder="Mot de passe"
          value={pwd}
          onChangeText={setPwd}
          secure
        />
        <Btn title="Se connecter" onPress={submit} icon="log-in-outline" style={{ marginTop: 4 }} />

        <Pressable onPress={onSignup} style={s.signup}>
          <T size={font.sm} weight="600" color={colors.muted}>
            Pas encore de compte ?  <T size={font.sm} weight="800" color={colors.primary}>S'inscrire</T>
          </T>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: Platform.OS === 'web' ? 22 : 52, paddingBottom: 40 },
  back: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  center: { alignItems: 'center', marginTop: 10, marginBottom: 22 },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: space.xl,
    ...shadow.card,
  },
  signup: { alignItems: 'center', marginTop: 18 },
});
