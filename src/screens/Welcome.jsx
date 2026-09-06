import React from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, space } from '../theme';
import { T } from '../components/ui';
import Logo from '../components/Logo';

export default function Welcome({ onSelect }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.primary }}
      contentContainerStyle={s.wrap}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.hero}>
        <Logo size={104} />
        <T size={32} weight="900" color="#fff" style={{ marginTop: 20 }}>Cabine En Ligne</T>
        <T size={font.body} weight="600" color="rgba(255,255,255,0.85)" style={{ marginTop: 6 }}>
          Votre solution de recharge mobile
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
        <T size={font.h2} weight="800" color={colors.text} style={{ textAlign: 'center', marginBottom: space.xl }}>
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
                Rechargez et gérez vos services
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
                Gérez les demandes clients
              </T>
            </View>
          </View>
        </Pressable>

        <T size={font.xs} weight="600" color={colors.muted2} style={{ textAlign: 'center', marginTop: space.xxl }}>
          Version de démonstration
        </T>
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
});
