import React from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Switch, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, shadow } from '../theme';

// ---------------------------------------------------------------
//  Small building blocks
// ---------------------------------------------------------------

export function T({ children, size = font.body, weight = '400', color = colors.text, style, numberOfLines }) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[{ fontSize: size, color, fontWeight: weight, includeFontPadding: false }, style]}
    >
      {children}
    </Text>
  );
}

export function SectionTitle({ children, style }) {
  return (
    <T size={font.h3} weight="800" color={colors.text} style={[{ marginBottom: space.md }, style]}>
      {children}
    </T>
  );
}

export function Card({ children, style, onPress }) {
  const Comp = onPress ? Pressable : View;
  return (
    <Comp
      onPress={onPress}
      style={[base.card, shadow.card, style]}
    >
      {children}
    </Comp>
  );
}

export function Pill({ children, color = colors.primary, bg = colors.primarySoft, icon, style }) {
  return (
    <View style={[base.row, base.pill, { backgroundColor: bg }, style]}>
      {icon ? <Ionicons name={icon} size={14} color={color} style={{ marginRight: 5 }} /> : null}
      <T size={font.sm} weight="700" color={color}>{children}</T>
    </View>
  );
}

export function Btn({
  title, onPress, color = colors.primary, textColor = colors.white,
  icon, outline = false, disabled = false, style, size = 'lg', loading = false,
}) {
  const height = size === 'lg' ? 54 : 44;
  return (
    <Pressable
      onPress={disabled ? null : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        base.btn,
        { height },
        outline
          ? { backgroundColor: 'transparent', borderWidth: 1.6, borderColor: color }
          : { backgroundColor: color },
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <Ionicons name="sync" size={20} color={textColor} style={{ transform: [{ rotate: '0deg' }] }} />
      ) : icon ? (
        <Ionicons name={icon} size={20} color={textColor} style={{ marginRight: 8 }} />
      ) : null}
      <T size={font.body} weight="800" color={outline ? color : textColor}>{title}</T>
    </Pressable>
  );
}

export function Field({ label, placeholder, value, onChangeText, keyboardType = 'default', icon, onFocus, onBlur, style, secure, multiline }) {
  return (
    <View style={[{ marginBottom: space.lg, width: '100%' }, style]}>
      {label ? <T size={font.sm} weight="700" color={colors.textSoft} style={{ marginBottom: 7 }}>{label}</T> : null}
      <View style={[base.field, multiline && { height: 'auto', minHeight: 88, alignItems: 'flex-start', paddingTop: 12 }]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.primary} style={{ marginRight: 10, marginTop: multiline ? 2 : 0 }} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted2}
          keyboardType={keyboardType}
          secureTextEntry={secure}
          multiline={multiline}
          onFocus={onFocus}
          onBlur={onBlur}
          style={[base.input, { paddingLeft: icon ? 0 : 14 }, multiline && { height: 'auto', minHeight: 64, textAlignVertical: 'top' }]}
        />
      </View>
    </View>
  );
}

// Segmented toggle  (Pour moi / Pour quelqu'un)
export function Segmented({ options, value, onChange }) {
  return (
    <View style={[base.row, base.segmented]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[base.segItem, active && { backgroundColor: colors.primary }]}
          >
            <T size={font.sm} weight="700" color={active ? colors.white : colors.muted}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress, selectedColor = colors.primary }) {
  return (
    <Pressable
      onPress={onPress}
      style={[base.chip, active && { backgroundColor: selectedColor, borderColor: selectedColor }]}
    >
      <T size={font.sm} weight="800" color={active ? colors.white : selectedColor}>{label}</T>
    </Pressable>
  );
}

export function StatTile({ icon, value, label, tone = 'purple', style }) {
  const tones = {
    purple: { bg: colors.primarySoft2, color: colors.primary },
    green: { bg: colors.successBg, color: colors.success },
    blue: { bg: '#E7F0FE', color: '#2E7BF6' },
    orange: { bg: '#FDF0E0', color: colors.warn },
  };
  const t = tones[tone] || tones.purple;
  return (
    <Card style={[base.statTile, style]}>
      <View style={[base.iconCircle, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={20} color={t.color} />
      </View>
      <T size={font.h2} weight="800" color={colors.text} style={{ marginTop: 8 }}>{value}</T>
      <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2, textAlign: 'center' }}>{label}</T>
    </Card>
  );
}

// Generic bottom-sheet style modal content container
export function Sheet({ children }) {
  return <View style={base.sheet}>{children}</View>;
}

export function SheetHandle() {
  return <View style={base.handle} />;
}

export function ListRow({ icon, iconColor = colors.primary, label, value, onPress, iconBg }) {
  return (
    <Pressable onPress={onPress} style={[base.row, base.listRow]}>
      <View style={[base.iconCircle, { backgroundColor: iconBg || colors.primarySoft, marginRight: 12 }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <T size={font.body} weight="600" color={colors.text}>{label}</T>
      {value != null ? <T size={font.body} weight="700" color={colors.text} style={{ marginLeft: 'auto' }}>{value}</T> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted2} style={{ marginLeft: 6 }} /> : null}
    </Pressable>
  );
}

const base = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: font.body,
    color: colors.text,
    height: '100%',
    paddingVertical: 0,
    outlineStyle: 'none',
    ...(Platform.OS === 'web' ? { outline: 'none' } : {}),
  },
  segmented: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: 4,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.gray,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  statTile: { flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 34,
    alignSelf: 'center',
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.muted2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  listRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
