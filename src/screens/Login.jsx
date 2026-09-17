import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, shadow } from '../theme';
import { T, Btn, Field } from '../components/ui';
import Logo from '../components/Logo';
import { api } from '../api';

export default function Login({ role, onBack, onLogin, onSignup, connecting }) {
  const [phone, setPhone] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [unblockMsg, setUnblockMsg] = useState('');
  const [unblockSent, setUnblockSent] = useState(false);
  const [unblockErr, setUnblockErr] = useState('');
  const [sending, setSending] = useState(false);
  const isGerant = role === 'gerant';

  const submit = async () => {
    if (!phone.trim()) { setErr('Veuillez saisir votre numéro de téléphone.'); return; }
    setErr(''); setBlocked(false); setUnblockSent(false); setUnblockErr('');
    try {
      await onLogin({ role, phone, password: pwd });
    } catch (e) {
      // Compte bloqué : on affiche le formulaire de demande de déblocage.
      if (e && e.code === 'BLOCKED') { setBlocked(true); return; }
      setErr(e && e.message ? e.message : 'Connexion impossible');
    }
  };

  const sendUnblock = async () => {
    if (!phone.trim()) { setUnblockErr('Votre numéro est requis pour la demande.'); return; }
    setUnblockErr(''); setSending(true);
    try {
      await api.public.submitUnblockRequest(phone.trim(), unblockMsg.trim());
      setUnblockSent(true);
    } catch (e) {
      setUnblockErr(e && e.message ? e.message : 'Impossible d\'envoyer la demande. Réessayez.');
    } finally { setSending(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.primary }} contentContainerStyle={s.wrap}>
      <Pressable onPress={onBack} style={s.back}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </Pressable>

      <View style={s.center}>
        <Logo size={120} />
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

        <T size={font.xs} weight="600" color={colors.muted2} style={{ marginTop: -8, marginBottom: space.md }}>
          Nouveau ? Créez un compte {isGerant ? 'gérant' : 'client'} en un instant.
        </T>

        {err ? (
          <View style={s.error}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <T size={font.sm} weight="600" color={colors.danger} style={{ marginLeft: 6, flex: 1 }}>{err}</T>
          </View>
        ) : null}

        {blocked ? (
          <View style={s.blockedBox}>
            <Ionicons name="ban" size={30} color={colors.danger} style={{ marginBottom: 8 }} />
            <T size={font.body} weight="800" color={colors.danger} style={{ textAlign: 'center' }}>
              Ce compte a été bloqué
            </T>
            <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center', marginTop: 4 }}>
              Votre numéro ne peut plus être utilisé pour vous connecter ou créer un compte. Si vous pensez que c'est une erreur, vous pouvez faire une demande de déblocage ci-dessous.
            </T>

            {!unblockSent ? (
              <>
                <Field
                  label="Votre explication"
                  placeholder="Expliquez pourquoi votre compte devrait être débloqué…"
                  value={unblockMsg}
                  onChangeText={setUnblockMsg}
                  multiline
                  style={{ marginTop: space.md }}
                />
                {unblockErr ? (
                  <T size={font.sm} weight="600" color={colors.danger} style={{ marginTop: 6 }}>{unblockErr}</T>
                ) : null}
                <Btn title="Envoyer la demande de déblocage" icon="paper-plane" onPress={sendUnblock} loading={sending} style={{ marginTop: space.md }} />
              </>
            ) : (
              <View style={{ alignItems: 'center', marginTop: space.md }}>
                <Ionicons name="checkmark-circle" size={36} color={colors.success} />
                <T size={font.sm} weight="700" color={colors.text} style={{ marginTop: 6, textAlign: 'center' }}>
                  Demande envoyée. Le propriétaire l'examinera et vous débloquera s'il accepte.
                </T>
              </View>
            )}
          </View>
        ) : (
          <>
            <Btn title="Se connecter" onPress={submit} icon="log-in-outline" loading={connecting} style={{ marginTop: 4 }} />

            <Pressable onPress={onSignup} style={s.signup}>
              <T size={font.sm} weight="600" color={colors.muted}>
                Pas encore de compte ?  <T size={font.sm} weight="800" color={colors.primary}>S'inscrire</T>
              </T>
            </Pressable>
          </>
        )}

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
  blockedBox: { alignItems: 'center', backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: 14, marginTop: space.md },
});
