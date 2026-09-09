import React, { useState } from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T } from './ui';
import { pushSupported, enableNotifications } from '../push';
import { useStore } from '../store';

// ==================================================================
//  Option « notifications push » — paramétrable dans le profil
//  (client et gérant). Sur mobile, on demande la permission, on
//  récupère le jeton Expo et on l'enregistre côté serveur pour que
//  l'utilisateur soit alerté directement sur son téléphone.
//  Sur le web (PWA), les push ne sont pas disponibles : on l'explique.
// ==================================================================

function usePushRegistration() {
  const { registerPushToken } = useStore();
  const [enabled, setEnabled] = useState(typeof window !== 'undefined' && typeof window.__celPushEnabled === 'boolean' ? window.__celPushEnabled : false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const supported = pushSupported();

  const toggle = async (value) => {
    setBusy(true); setMsg('');
    if (!value) { setEnabled(false); setBusy(false); return; }
    const res = await enableNotifications();
    setBusy(false);
    if (res && res.ok && res.token) {
      await registerPushToken(res.token);
      setEnabled(true);
      try { if (typeof window !== 'undefined') window.__celPushEnabled = true; } catch { /* ignore */ }
    } else {
      setEnabled(false);
      setMsg((res && res.reason) || 'Impossible d’activer les notifications.');
    }
  };

  return { enabled, busy, msg, supported, toggle };
}

export default function PushSettings() {
  const { enabled, busy, msg, supported, toggle } = usePushRegistration();

  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={s.icon}><Ionicons name="notifications" size={18} color={colors.primary} /></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <T size={font.body} weight="800" color={colors.text}>Notifications sur le téléphone</T>
          <T size={font.xs} weight="600" color={colors.muted} style={{ marginTop: 2 }}>
            {supported
              ? 'Soyez alerté immédiatement (nouvelle demande, paiement, réponse…).'
              : 'Réservé à l’application mobile (Expo Go / build EAS).'}
          </T>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          disabled={busy || !supported}
          trackColor={{ true: colors.primary, false: colors.gray }}
          thumbColor={enabled ? '#fff' : '#fff'}
        />
      </View>
      {msg ? <T size={font.sm} weight="600" color={colors.danger} style={{ marginTop: 10 }}>{msg}</T> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 16, marginBottom: space.md, marginTop: space.lg },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
