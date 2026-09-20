import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T, Btn, Card, Pill } from '../components/ui';
import { Header } from '../components/Shell';
import { api } from '../api';
import { useStore } from '../store';

// Profil public d'un utilisateur, ouvert via son lien de partage /?u=ID.
// Pas de données fictives : on ne dépend que du backend réel. Si le profil
// n'existe pas ou si le réseau ne répond pas, on affiche « Profil introuvable ».
export default function PublicProfile({ userId }) {
  const { state, online, addGerant } = useStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);
  const copyWave = () => {
    const n = profile?.waveNumber || profile?.phone || '';
    if (n && typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(n).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    (async () => {
      try {
        const { profile } = await api.public.profile(userId);
        setProfile(profile);
      } catch { setProfile(null); }
      finally { setLoading(false); }
    })();
  }, [userId]);

  const isGerant = profile?.role === 'gerant';
  const isMe = state.user && state.user.id === profile?.id;

  const doAdd = async () => {
    setErr('');
    try {
      if (online) {
        await addGerant({ phone: profile.phone, name: profile.name });
      }
      setAdded(true);
    } catch (e) { setErr(e && e.message ? e.message : 'Ajout impossible'); }
  };

  const close = () => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, '', '/');
      window.location.reload();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.primary }}>
      <Header title="Profil" onBack={close} />
      <ScrollView contentContainerStyle={{ padding: space.lg }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}><ActivityIndicator size="large" color="#fff" /></View>
        ) : !profile ? (
          <Card style={{ alignItems: 'center', paddingVertical: 30 }}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            <T size={font.h3} weight="800" color={colors.text} style={{ marginTop: 10 }}>Profil introuvable</T>
            <Btn title="Fermer" onPress={close} style={{ marginTop: 16, alignSelf: 'stretch' }} />
          </Card>
        ) : (
          <>
            <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
              <View style={s.avatar}>
                <Ionicons name={isGerant ? 'storefront' : 'person'} size={42} color="#fff" />
              </View>
              <T size={font.h2} weight="800" color={colors.text} style={{ marginTop: 12 }}>{profile.name}</T>
              <Pill icon={isGerant ? 'storefront-outline' : 'person-outline'} color={isGerant ? colors.primary : colors.textSoft} bg={colors.primarySoft} style={{ marginTop: 8 }}>
                {isGerant ? 'Gérant(e) de cabine' : 'Client(e)'}
              </Pill>
              <View style={s.phoneRow}>
                <Ionicons name="call-outline" size={16} color={colors.primary} />
                <T size={font.body} weight="700" color={colors.text} style={{ marginLeft: 8 }}>{profile.phone}</T>
              </View>
              {isGerant && (
                <View style={s.waveRow}>
                  <Ionicons name="water" size={16} color={colors.wave} />
                  <T size={font.sm} weight="700" color={colors.wave} style={{ marginLeft: 8 }}>Numéro Wave : {profile.waveNumber}</T>
                </View>
              )}
              {isGerant && (
                <>
                  <Btn title={copied ? 'Numéro copié ✓' : 'Copier le numéro Wave'} icon={copied ? 'checkmark' : 'copy-outline'} onPress={copyWave} style={{ alignSelf: 'stretch', marginTop: space.md }} />
                  <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 6, textAlign: 'center' }}>
                    Transférez le montant à ce numéro depuis votre app Wave. Les frais Wave (1 %) sont sur votre compte — le gérant reçoit la totalité.
                  </T>
                </>
              )}
            </Card>

            {isMe ? (
              <Card style={{ alignItems: 'center', marginTop: space.lg, paddingVertical: 20 }}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                <T size={font.body} weight="800" color={colors.text} style={{ marginTop: 8 }}>C'est votre profil</T>
                <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4, textAlign: 'center' }}>Partagez votre lien pour que des clients ou gérants vous trouvent.</T>
              </Card>
            ) : isGerant && state.loggedIn && state.role === 'client' ? (
              <Card style={{ marginTop: space.lg }}>
                <T size={font.h3} weight="800" color={colors.text}>Ajouter ce gérant</T>
                <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 4, marginBottom: space.md }}>
                  Ajoutez {profile.name} à votre liste pour lui envoyer des demandes.
                </T>
                {added ? (
                  <View style={{ alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={36} color={colors.success} />
                    <T size={font.body} weight="800" color={colors.success} style={{ marginTop: 6 }}>Gérant ajouté ✓</T>
                  </View>
                ) : (
                  <Btn title="Ajouter à mes gérants" icon="person-add" onPress={doAdd} />
                )}
                {err ? <T size={font.sm} weight="600" color={colors.danger} style={{ marginTop: 8, textAlign: 'center' }}>{err}</T> : null}
              </Card>
            ) : (
              <Card style={{ marginTop: space.lg, paddingVertical: 18 }}>
                <T size={font.sm} weight="600" color={colors.muted} style={{ textAlign: 'center' }}>
                  {state.loggedIn
                    ? 'Connectez-vous en tant que client pour ajouter / transacter.'
                    : 'Connectez-vous pour ajouter ce profil et faire des transactions.'}
                </T>
                <Btn title="Fermer" onPress={close} style={{ marginTop: 14 }} />
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  waveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#E7F0FE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
});
