import React from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, shadow } from '../theme';
import { T } from './ui';

// ---------------------------------------------------------------
//  Purple page header
// ---------------------------------------------------------------
export function Header({ title, subtitle, onBack, right, noPad }) {
  return (
    <View style={[s.header, noPad && { paddingTop: 18 }]}>
      <View style={s.topRow}>
        <View style={s.side}>
          {onBack ? (
            <Pressable onPress={onBack} style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.8 }]}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>
          ) : <View style={{ width: 40 }} />}
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T size={font.h2} weight="800" color="#fff">{title}</T>
          {subtitle ? <T size={font.sm} weight="600" color="rgba(255,255,255,0.85)" style={{ marginTop: 3 }}>{subtitle}</T> : null}
        </View>
        <View style={[s.side, { alignItems: 'flex-end' }]}>
          {right || <View style={{ width: 40 }} />}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------
//  Screen wrapper with header + scrollable body
// ---------------------------------------------------------------
export function Page({ title, subtitle, onBack, right, children, noPad, contentStyle }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={title} subtitle={subtitle} onBack={onBack} right={right} noPad={noPad} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, contentStyle]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------
//  Bottom navigation bar
// ---------------------------------------------------------------
export function TabBar({ tabs, active, onChange }) {
  return (
    <View style={s.tabbarWrap}>
      <View style={s.tabbar}>
        {tabs.map((t) => {
          const on = t.key === active;
          return (
            <Pressable key={t.key} onPress={() => onChange(t.key)} style={s.tab}>
              <Ionicons
                name={on ? (t.filled ? t.icon : t.icon) : t.icon}
                size={24}
                color={on ? colors.primary : colors.muted2}
              />
              <T size={10} weight={on ? '800' : '600'} color={on ? colors.primary : colors.muted2} numberOfLines={1} style={{ marginTop: 2 }}>
                {t.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingTop: Platform.OS === 'web' ? 'calc(20px + env(safe-area-inset-top, 0px))' : 46,
    paddingBottom: 20,
    paddingHorizontal: 16,
    shadowColor: colors.primaryDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 2,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', minHeight: 46 },
  side: { width: 46, justifyContent: 'center' },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: 120,
  },
  tabbarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'web' ? 'calc(10px + env(safe-area-inset-bottom, 0px))' : 22,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 12,
  },
  tabbar: { flexDirection: 'row', justifyContent: 'space-around' },
  tab: { alignItems: 'center', flex: 1 },
});
