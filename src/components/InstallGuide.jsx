import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T } from './ui';

// ==================================================================
//  Notice « Installer l'application sur mon téléphone ».
//  Cabine En Ligne est une PWA : on peut l'ajouter à l'écran
//  d'accueil pour l'ouvrir comme n'importe quelle application.
//  Étapes exactes pour Android (Chrome) et iPhone (Safari, iOS 16.4+).
// ==================================================================
const INSTALL_STEPS = [
  {
    os: 'Android',
    icon: 'logo-android',
    steps: [
      'Ouvrez cabineenligne.com dans Chrome.',
      'Appuyez sur le menu ⋮ (en haut à droite).',
      'Choisissez « Ajouter à l\'écran d\'accueil » (ou « Installer l\'application »).',
      'Confirmez : l\'icône apparaît sur votre écran comme une vraie application.',
    ],
  },
  {
    os: 'iPhone',
    icon: 'logo-apple',
    steps: [
      'Ouvrez cabineenligne.com dans Safari.',
      'Appuyez sur le bouton Partager (carré avec flèche vers le haut).',
      'Choisissez « Sur l\'écran d\'accueil ».',
      'Appuyez sur « Ajouter » : l\'icône apparaît comme une application.',
    ],
    note: 'Sur iPhone, installez l\'app sur l\'écran d\'accueil (iOS 16.4 ou plus) pour recevoir les notifications.',
  },
];

export default function InstallGuide() {
  return (
    <View style={s.box}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={s.headIcon}><Ionicons name="download-outline" size={18} color={colors.primary} /></View>
        <T size={font.sm} weight="800" color={colors.text} style={{ marginLeft: 10 }}>Installer l'application sur mon téléphone</T>
      </View>
      <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 6 }}>
        Ajoutez Cabine En Ligne à votre écran d'accueil pour l'ouvrir comme une vraie application, en un geste.
      </T>

      {INSTALL_STEPS.map((os) => (
        <View key={os.os} style={s.osBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={os.icon} size={16} color={os.os === 'Android' ? '#3DDC84' : colors.text} />
            <T size={font.sm} weight="800" color={colors.text} style={{ marginLeft: 8 }}>Sur {os.os}</T>
          </View>
          {os.steps.map((st, i) => (
            <View key={i} style={s.osStep}>
              <View style={s.num}><T size={font.xs} weight="800" color={colors.primary}>{i + 1}</T></View>
              <T size={font.xs} weight="600" color={colors.textSoft} style={{ flex: 1, marginLeft: 10, lineHeight: 17 }}>{st}</T>
            </View>
          ))}
          {os.note ? (
            <View style={s.note}>
              <Ionicons name="notifications-outline" size={13} color={colors.primary} style={{ marginRight: 6 }} />
              <T size={font.xs} weight="600" color={colors.primary} style={{ flex: 1 }}>{os.note}</T>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, marginTop: space.md },
  headIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  osBlock: { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  osStep: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  num: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  note: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radius.sm, padding: 8, marginTop: 8 },
});
