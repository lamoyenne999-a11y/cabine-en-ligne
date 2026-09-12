import React, { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, space } from '../theme';
import { T } from '../components/ui';
import Logo from '../components/Logo';
import InstallGuide from '../components/InstallGuide';

export default function Welcome({ onSelect, onAdmin }) {
  const [showHow, setShowHow] = useState(false);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.primary }}
      contentContainerStyle={s.wrap}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.hero}>
        <Logo size={104} />
        <T size={32} weight="900" color="#fff" style={{ marginTop: 20 }}>Cabine En Ligne</T>
        <T size={font.body} weight="600" color="rgba(255,255,255,0.85)" style={{ marginTop: 6, textAlign: 'center', paddingHorizontal: 20 }}>
          Rechargez vos unités, minutes et internet en direct, par un gérant de cabine.
        </T>

        <View style={s.features}>
          <View style={s.feature}>
            <Ionicons name="flash" size={20} color="#fff" />
            <T size={font.body} weight="700" color="#fff" style={{ marginLeft: 8 }}>Rapide</T>
          </View>
          <View style={s.feature}>
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
            <T size={font.body} weight="700" color="#fff" style={{ marginLeft: 8 }}>Sécurisé</T>
          </View>
        </View>
      </View>

      <View style={s.body}>
        {/* Comment ça marche — accordéon compact (replié par défaut) */}
        <Pressable onPress={() => setShowHow((v) => !v)} style={({ pressed }) => [s.howToggle, pressed && { opacity: 0.7 }]}>
          <Ionicons name="help-circle-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <T size={font.sm} weight="800" color={colors.primary}>Comment ça marche</T>
          <Ionicons name={showHow ? 'chevron-up' : 'chevron-down'} size={15} color={colors.muted} style={{ marginLeft: 6 }} />
        </Pressable>

        {showHow && (
          <View style={s.howCard}>
            <View style={s.step}>
              <View style={s.stepIcon}><Ionicons name="person-outline" size={20} color={colors.primary} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T size={font.body} weight="800" color={colors.text}>Choisissez un gérant en ligne</T>
                <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>Son nom et son numéro sont visibles avant de choisir.</T>
              </View>
            </View>
            <View style={s.step}>
              <View style={s.stepIcon}><Ionicons name="water" size={20} color={colors.primary} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T size={font.body} weight="800" color={colors.text}>Payez-le en direct sur son Wave</T>
                <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>Aucun argent ne passe par l'app.</T>
              </View>
            </View>
            <View style={s.step}>
              <View style={s.stepIcon}><Ionicons name="flash" size={20} color={colors.primary} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <T size={font.body} weight="800" color={colors.text}>Il vous crédite vos unités / internet</T>
                <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 2 }}>Rapide, sans vous déplacer.</T>
              </View>
            </View>

            {/* Notice d'installation (Android + iPhone) — ajoutée dans « Comment ça marche » */}
            <InstallGuide />
          </View>
        )}

        <T size={font.h2} weight="800" color={colors.text} style={{ textAlign: 'center', marginTop: space.lg, marginBottom: space.lg }}>
          Choisissez votre profil
        </T>

        <Pressable onPress={() => onSelect('client')} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
          <View style={s.profileCard}>
            <View style={s.profilePill}>
              <Ionicons name="person-outline" size={28} color={colors.primary} />
            </View>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <T size={font.h3} weight="800" color={colors.primary}>Je suis Client</T>
              <T size={font.sm} weight="600" color={colors.muted} style={{ marginTop: 3 }}>
                Demandez unités, minutes ou internet
              </T>
            </View>
          </View>
        </Pressable>

        <Pressable onPress={() => onSelect('gerant')} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
          <View style={[s.profileCard, s.profileCardActive]}>
            <View style={[s.profilePill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="storefront-outline" size={28} color="#fff" />
            </View>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <T size={font.h3} weight="800" color="#fff">Je suis Gérant</T>
              <T size={font.sm} weight="600" color="rgba(255,255,255,0.8)" style={{ marginTop: 3 }}>
                Recevez et traitez les demandes
              </T>
            </View>
          </View>
        </Pressable>

        <Pressable onPress={onAdmin} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: space.xxl }}>
            © Cabine En Ligne · <T size={font.xs} weight="700" color={colors.muted}>Espace propriétaire</T>
          </T>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1 },
  hero: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 56 : 74,
    paddingBottom: 34,
  },
  features: { flexDirection: 'row', marginTop: 22 },
  feature: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 6,
  },
  body: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    padding: space.xl,
    paddingBottom: 40,
    marginTop: -8,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: space.lg,
    marginBottom: space.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  profileCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  profilePill: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  howToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  howCard: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stepIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
});
