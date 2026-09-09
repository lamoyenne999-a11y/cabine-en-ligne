// ==================================================================
//  Notifications push — version NATIVE (Expo Go / build EAS).
//  Demande la permission, configure le canal Android puis récupère le
//  jeton Expo Push. Ce jeton est ensuite envoyé au serveur pour recevoir
//  les alertes sur le téléphone (à chaque nouvelle demande/paiement…).
// ==================================================================
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function pushSupported() {
  return Platform.OS !== 'web' && Device.isDevice;
}

export async function enableNotifications() {
  try {
    if (!Device.isDevice) {
      return { ok: false, reason: 'Les notifications push ne fonctionnent pas sur un simulateur/émulateur.' };
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Cabine En Ligne',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') {
      perm = await Notifications.requestPermissionsAsync();
    }
    if (perm.status !== 'granted') {
      return { ok: false, reason: 'Autorisation de notifications refusée. Activez-les dans les réglages du téléphone.' };
    }
    // L'ID du projet EAS (propriétaire des push) vient de la variable d'env,
    // ou de app.json (extra.eas.projectId) défini par `eas init`.
    const projectId =
      process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
      Constants.expoConfig?.extra?.eas?.projectId ||
      undefined;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: token.data };
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : 'Impossible d’activer les notifications.' };
  }
}
