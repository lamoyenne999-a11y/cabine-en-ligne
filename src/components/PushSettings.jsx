import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font } from '../theme';
import { T } from './ui';
import { pushSupported, enableNotifications, getPushState, disableNotifications } from '../push';
import { useStore } from '../store';

// ==================================================================
//  Option « notifications push » — paramétrable dans le profil
//  (client et gérant). Le commutateur reflète l'ÉTAT RÉEL de
//  l'appareil/navigateur : il reste sur « activé » tant que l'utilisateur
//  ne l'a pas désactivé lui-même, même après un rechargement de l'app.
// ==================================================================

function usePushRegistration() {
  const { registerPushToken, registerPushSubscription, unregisterPushSubscription, unregisterPushToken } = useStore();
  const supported = pushSupported();
  // On ne connaît pas encore l'état réel au premier rendu : on affiche
  // "off" un court instant, puis getPushState() le corrige si les
  // notifications sont déjà actives (source de vérité = le navigateur).
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Au montage : lit l'état réel (permission + abonnement) pour ne JAMAIS
  // faire repasser le commutateur sur « off » alors que tout est actif.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const st = await getPushState();
        if (!alive) return;
        if (st.supported && st.granted && st.subscribed) setEnabled(true);
      } catch { /* silencieux */ }
      finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const toggle = async (value) => {
    if (busy) return;
    setBusy(true); setMsg('');

    if (value) {
      // ==== ACTIVATION ====
      const res = await enableNotifications();
      if (res && res.ok) {
        // Web Push (PWA) : enregistre l'abonnement du navigateur.
        if (res.subscription) await registerPushSubscription(res.subscription);
        // Push natif (app mobile) : enregistre le jeton Expo.
        if (res.token) await registerPushToken(res.token);
        setEnabled(true);
      } else {
        setEnabled(false);
        setMsg((res && res.reason) || 'Impossible d’activer les notifications.');
      }
      setBusy(false);
      return;
    }

    // ==== DÉSACTIVATION VOLONTAIRE ====
    // L'utilisateur est le SEUL à pouvoir éteindre les notifications.
    // On désabonne réellement l'appareil et on retire l'enregistrement serveur.
    try {
      const off = await disableNotifications();
      if (off.endpoint) await unregisterPushSubscription(off.endpoint);
      if (off.token) await unregisterPushToken(off.token);
      setEnabled(false);
    } catch {
      setEnabled(false);
    }
    setBusy(false);
  };

  return { enabled, busy, checking, msg, supported, toggle };
}

export default function PushSettings() {
  const { enabled, busy, checking, msg, supported, toggle } = usePushRegistration();

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
          disabled={busy || checking || !supported}
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
