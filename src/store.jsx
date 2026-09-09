import React, { createContext, useContext, useMemo, useReducer, useState, useEffect, useCallback } from 'react';
import { api, setToken, clearToken, getToken } from './api';
import { DATA_MODE } from './config';
import { storage } from './storage';

// ============================================================
//  Cabine En Ligne — store global (v2 simplifiée)
//  ZÉRO argent stocké sur l'app. L'app ne fait que connecter
//  clients <-> gérants. Paiement direct via Wave hors app.
//  La session est persistée (localStorage) pour rester connecté
//  jusqu'à déconnexion volontaire.
// ============================================================

const SESSION_KEY = 'cel_session';

function loadSession() {
  try {
    const raw = storage.get(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.user) return null;
    return s; // { user, subscription }
  } catch { return null; }
}
function persistSession(payload) {
  if (!payload || !payload.user) return;
  storage.set(SESSION_KEY, JSON.stringify({ user: payload.user, subscription: payload.subscription || null }));
}
function clearSession() { storage.remove(SESSION_KEY); }

const seed = () => {
  const s = loadSession();
  return {
    loggedIn: !!s,
    role: s ? s.user.role : null,
    user: s ? s.user : null,          // { id, role, name, phone, waveNumber, email }
    subscription: s ? s.subscription : null,  // { status: trial|active|expired, daysLeft, price }

  // Client : ses gérants (contacts) + ses demandes. On démarre vide :
  // seuls les gérants réellement inscrits / ajoutés apparaîtront.
  gerants: [],
  // Gérants déjà inscrits, proposés au client (sans qu'il ait à les ajouter)
  availableGerants: [],
  demandes: [],

  // Gérant : demandes reçues
  gerantDemandes: [],
  // Gérant : notifications
  notifications: [],
  unread: 0,
  // Client : notifications (demande acceptée / refusée…)
  clientNotifications: [],
  clientUnread: 0,

  // Parrainage : { code, count, rate, nextTier, totalCommission, earnings, referrals }
  referral: null,
  };
};

function reducer(state, action) {
  switch (action.type) {
    case 'SELECT_ROLE':
      return { ...state, role: action.role };
    case 'SET_BACKEND':
      return { ...state, connected: true, backendMode: action.mode };
    case 'LOGIN':
    case 'SIGNUP':
      return { ...state, loggedIn: true, user: action.payload.user, subscription: action.payload.subscription };
    case 'LOGOUT':
      return { ...seed(), loggedIn: false, role: state.role };

    case 'HYDRATE': {
      const p = action.payload || {};
      return {
        ...state,
        ...(p.user ? { subscription: p.subscription, user: p.user } : {}),
        ...(p.gerants ? { gerants: p.gerants } : {}),
        ...(p.demandes ? { demandes: p.demandes } : {}),
        ...(p.subscription !== undefined ? { subscription: p.subscription } : {}),
      };
    }

    case 'ADD_GERANT':
      return { ...state, gerants: [...state.gerants, action.payload] };
    case 'SET_AVAILABLE_GERANTS':
      return { ...state, availableGerants: action.payload || [] };
    case 'REMOVE_GERANT':
      return { ...state, gerants: state.gerants.filter((g) => g.id !== action.payload) };

    case 'ADD_DEMANDE':
      return { ...state, demandes: [action.payload, ...state.demandes] };
    case 'CLIENT_UPDATE_DEMANDE':
      return { ...state, demandes: state.demandes.map((d) => (d.id === action.payload.id ? { ...d, ...action.payload } : d)) };
    case 'CANCEL_DEMANDE':
      return { ...state, demandes: state.demandes.map((d) => (d.id === action.payload ? { ...d, status: 'canceled', canceledAt: Date.now() } : d)) };

    case 'SET_GERANT_DEMANDES':
      return { ...state, gerantDemandes: action.payload };
    case 'GERANT_UPDATE_DEMANDE':
      return { ...state, gerantDemandes: state.gerantDemandes.map((d) => (d.id === action.payload.id ? { ...d, ...action.payload } : d)) };

    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload.notifications || [], unread: action.payload.unread ?? (action.payload.notifications || []).filter((n) => !n.read).length };
    case 'SET_CLIENT_NOTIFICATIONS':
      return { ...state, clientNotifications: action.payload.notifications || [], clientUnread: action.payload.unread ?? (action.payload.notifications || []).filter((n) => !n.read).length };
    case 'MARK_CLIENT_NOTIFICATION_READ':
      return {
        ...state,
        clientNotifications: state.clientNotifications.map((n) => (n.id === action.payload ? { ...n, read: true } : n)),
        clientUnread: Math.max(0, (state.clientUnread || 0) - 1),
      };
    case 'MARK_ALL_CLIENT_NOTIFICATIONS_READ':
      return { ...state, clientNotifications: state.clientNotifications.map((n) => ({ ...n, read: true })), clientUnread: 0 };
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === action.payload ? { ...n, read: true } : n)),
        unread: Math.max(0, state.unread - 1),
      };
    case 'MARK_ALL_NOTIFICATIONS_READ':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })), unread: 0 };

    case 'SET_SUBSCRIPTION':
      return { ...state, subscription: action.payload };

    case 'SET_REFERRAL':
      return { ...state, referral: action.payload, user: { ...state.user, referralCode: action.payload?.code ?? state.user?.referralCode } };

    case 'SET_GERANT_PROFILE':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : state.user,
      };

    default:
      return state;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, seed);
  const [online, setOnline] = useState(false);
  const [checking, setChecking] = useState(true);

  const probe = useCallback(async () => {
    setChecking(true);
    if (DATA_MODE === 'mock') { setChecking(false); setOnline(false); return; }
    try {
      const h = await api.health();
      setOnline(!!h && h.status === 'ok');
      if (h && h.status === 'ok' && h.mode) dispatch({ type: 'SET_BACKEND', mode: h.mode });
    } catch { setOnline(false); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => { probe(); }, [probe]);

  // ---- Auth ----
  // Pas de compte de démonstration : la connexion exige le vrai backend.
  // Hors ligne, on affiche un message clair au lieu de créer un faux compte.
  const login = useCallback(async ({ role, phone, password }) => {
    try {
      // On envoie le rôle pour que le serveur verrouille l'accès à la bonne
      // espace : un compte client ne peut pas se connecter en gérant, etc.
      const { token, user, subscription } = await api.login({ phone, password: password || '', role });
      setToken(token);
      dispatch({ type: 'LOGIN', payload: { user, subscription } });
      persistSession({ user, subscription });
      return { source: 'api' };
    } catch (e) {
      // 403 = mauvais rôle ; 401 = identifiants faux ; réseau = hors ligne.
      if (e && e.status) throw e;
      throw Object.assign(new Error('Impossible de se connecter. Vérifiez votre connexion internet ou réessayez.'), { status: 0 });
    }
  }, []);

  const register = useCallback(async (payload) => {
    try {
      const { token, user, subscription } = await api.register(payload);
      setToken(token);
      dispatch({ type: 'SIGNUP', payload: { user, subscription } });
      persistSession({ user, subscription });
      return { source: 'api' };
    } catch (e) {
      // 400/401/409 = message serveur à afficher (numéro déjà pris, etc.).
      // Jamais de bascule silencieuse vers un faux compte local.
      if (e && e.status) throw e;
      throw Object.assign(new Error('Impossible de créer le compte. Vérifiez votre connexion internet ou réessayez.'), { status: 0 });
    }
  }, []);

  const logout = useCallback(() => { clearToken(); clearSession(); dispatch({ type: 'LOGOUT' }); }, []);

  // ---- Restauration de session au démarrage (rester connecté) ----
  // Si le compte a été SUPPRIMÉ pendant que l'utilisateur était connecté, le
  // serveur répond 401 (utilisateur introuvable) : on force la déconnexion et
  // on le renvoie à l'accueil pour qu'il ne puisse plus utiliser l'app.
  const restore = useCallback(async () => {
    if (!online) return;             // hors ligne : on garde la session locale
    try {
      const { user, subscription } = await api.me();
      dispatch({ type: 'LOGIN', payload: { user, subscription } });
      persistSession({ user, subscription });
    } catch (e) {
      if (e && e.status === 401) { clearToken(); clearSession(); dispatch({ type: 'LOGOUT' }); }
      /* autre erreur (réseau…) : on garde la session locale */
    }
  }, [online]);
  useEffect(() => { if (online && state.loggedIn && getToken()) restore(); }, [online]); // eslint-disable-line

  // ---- Rafraîchit depuis le serveur ----
  // `safe` déconnecte l'utilisateur et le renvoie à l'accueil si le serveur
  // répond 401 (compte supprimé ou jeton invalidé), sinon renvoie null.
  const safe = (e) => {
    if (e && e.status === 401) { clearToken(); clearSession(); dispatch({ type: 'LOGOUT' }); }
    return null;
  };
  const refresh = useCallback(async () => {
    if (!online) return;
    try {
      const sub = await (state.role === 'gerant' ? api.gerant.subscription() : api.client.subscription()).catch(safe);
      if (sub) dispatch({ type: 'SET_SUBSCRIPTION', payload: sub.subscription });

      // Parrainage : code, invités, taux et gains.
      const ref = await api.referral.my().catch(safe);
      if (ref?.referral) dispatch({ type: 'SET_REFERRAL', payload: ref.referral });

      if (state.role === 'client') {
        const [g, av, d, n] = await Promise.all([
          api.client.gerants().catch(safe),
          api.client.availableGerants().catch(safe),
          api.client.myDemandes().catch(safe),
          api.client.notifications().catch(safe),
        ]);
        dispatch({ type: 'HYDRATE', payload: { gerants: g?.gerants, demandes: d?.demandes } });
        if (av) dispatch({ type: 'SET_AVAILABLE_GERANTS', payload: av.gerants });
        if (n) dispatch({ type: 'SET_CLIENT_NOTIFICATIONS', payload: n });
      } else if (state.role === 'gerant') {
        const [d, n] = await Promise.all([
          api.gerant.demandes().catch(safe),
          api.gerant.notifications().catch(safe),
        ]);
        if (d) dispatch({ type: 'SET_GERANT_DEMANDES', payload: d.demandes });
        if (n) dispatch({ type: 'SET_NOTIFICATIONS', payload: n });
      }
    } catch (e) { safe(e); }
  }, [online, state.role, state.loggedIn]);

  useEffect(() => { if (online && state.loggedIn) refresh(); }, [online, state.loggedIn]); // eslint-disable-line

  // Rafraîchit périodiquement les données du rôle connecté :
  // pour le gérant -> demandes + notifications en direct ;
  // pour le client -> gérants + demandes, afin que le lien Wave
  // marchand ajouté par un gérant apparaisse sans devoir se reconnecter.
  useEffect(() => {
    if (!online || !state.loggedIn) return;
    const t = setInterval(() => refresh(), 10000);
    return () => clearInterval(t);
  }, [online, state.loggedIn, state.role, refresh]);

  // ---- Actions ----
  // Aucune donnée de secours hors-ligne : on ne fabrique JAMAIS de faux gérant.
  const addGerant = useCallback(async (payload) => {
    try {
      // On ne crée PAS de contact fantôme : si le numéro n'est pas un gérant
      // inscrit, on remonte l'erreur pour l'afficher à l'écran.
      const { gerant } = await api.client.addGerant(payload);
      dispatch({ type: 'ADD_GERANT', payload: gerant });
      return gerant;
    } catch (e) {
      if (e && e.status) throw e;
      throw Object.assign(new Error('Impossible d\'ajouter le gérant. Vérifiez votre connexion internet ou réessayez.'), { status: 0 });
    }
  }, []);

  const removeGerant = useCallback(async (id) => {
    dispatch({ type: 'REMOVE_GERANT', payload: id });
    if (online) { try { await api.client.removeGerant(id); } catch {} }
  }, [online]);

  const createDemande = useCallback(async (payload) => {
    try {
      const { demande } = await api.client.createDemande(payload);
      dispatch({ type: 'ADD_DEMANDE', payload: demande });
      return demande;
    } catch (e) {
      if (e && e.status) throw e;
      throw Object.assign(new Error('Impossible d\'envoyer la demande. Vérifiez votre connexion internet ou réessayez.'), { status: 0 });
    }
  }, []);

  const markPaid = useCallback(async (id) => {
    dispatch({ type: 'CLIENT_UPDATE_DEMANDE', payload: { id, status: 'paid' } });
    if (online) { try { await api.client.markPaid(id); } catch {} }
  }, [online]);

  const cancelDemande = useCallback(async (id) => {
    dispatch({ type: 'CANCEL_DEMANDE', payload: id });
    if (online) { try { await api.client.cancelDemande(id); } catch { /* silencieux */ } }
  }, [online]);

  const acceptDemande = useCallback(async (id) => {
    dispatch({ type: 'GERANT_UPDATE_DEMANDE', payload: { id, status: 'accepted' } });
    if (online) { try { await api.gerant.accept(id); } catch {} }
  }, [online]);

  const declineDemande = useCallback(async (id) => {
    dispatch({ type: 'GERANT_UPDATE_DEMANDE', payload: { id, status: 'declined' } });
    if (online) { try { await api.gerant.decline(id); } catch {} }
  }, [online]);

  const completeDemande = useCallback(async (id) => {
    dispatch({ type: 'GERANT_UPDATE_DEMANDE', payload: { id, status: 'completed' } });
    if (online) { try { await api.gerant.complete(id); } catch {} }
  }, [online]);

  // Enregistre le jeton de notification push de l'appareil (app mobile uniquement)
  // pour recevoir les alertes directement sur le téléphone.
  const registerPushToken = useCallback(async (token) => {
    if (!online || !token) return;
    try { await api.pushToken(token); } catch { /* silencieux */ }
  }, [online]);

  // Mise à jour du profil gérant (numéro + lien Wave marchand)
  const loadNotifications = useCallback(async () => {
    if (!online) return;
    try {
      const n = await api.gerant.notifications();
      dispatch({ type: 'SET_NOTIFICATIONS', payload: n });
    } catch { /* silencieux */ }
  }, [online]);

  const markNotificationRead = useCallback(async (id) => {
    dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id });
    if (online) { try { await api.gerant.markNotificationRead(id); } catch {} }
  }, [online]);

  const markAllNotificationsRead = useCallback(async () => {
    dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' });
    if (online) { try { await api.gerant.markAllNotificationsRead(); } catch {} }
  }, [online]);

  // ---- Notifications côté CLIENT ----
  const loadClientNotifications = useCallback(async () => {
    if (!online) return;
    try {
      const n = await api.client.notifications();
      dispatch({ type: 'SET_CLIENT_NOTIFICATIONS', payload: n });
    } catch { /* silencieux */ }
  }, [online]);

  const markClientNotificationRead = useCallback(async (id) => {
    dispatch({ type: 'MARK_CLIENT_NOTIFICATION_READ', payload: id });
    if (online) { try { await api.client.markNotificationRead(id); } catch {} }
  }, [online]);

  const markAllClientNotificationsRead = useCallback(async () => {
    dispatch({ type: 'MARK_ALL_CLIENT_NOTIFICATIONS_READ' });
    if (online) { try { await api.client.markAllNotificationsRead(); } catch {} }
  }, [online]);

  const loadReferral = useCallback(async () => {
    if (!online) return;
    try {
      const { referral } = await api.referral.my();
      dispatch({ type: 'SET_REFERRAL', payload: referral });
      return referral;
    } catch { /* silencieux */ }
  }, [online]);

  const updateReferralCode = useCallback(async (code) => {
    try {
      const { referral } = await api.referral.setCode(code);
      dispatch({ type: 'SET_REFERRAL', payload: referral });
      return referral;
    } catch (e) {
      if (e && e.status) throw e;
      throw Object.assign(new Error('Impossible de mettre à jour le code. Vérifiez votre connexion.'), { status: 0 });
    }
  }, []);

  const updateGerantProfile = useCallback(async (patch) => {
    let updated = null;
    if (online) {
      try {
        const { user } = await api.gerant.updateProfile(patch);
        updated = user;
      } catch { updated = { waveNumber: patch.waveNumber, payLink: patch.payLink }; }
    } else {
      updated = { waveNumber: patch.waveNumber, payLink: patch.payLink };
    }
    if (updated) {
      dispatch({ type: 'SET_GERANT_PROFILE', payload: updated });
      // Note : les contacts gérants côté clients seront rafraîchis au prochain refresh.
    }
    return updated;
  }, [online]);

  const subscribe = useCallback(async (plan = 'monthly') => {
    // Pas de bascule optimiste : on enregistre le paiement côté serveur et on
    // ne considère l'abonnement comme payé QUE si le backend confirme.
    // En cas d'échec, on remonte l'erreur (pas de fausse confirmation).
    try {
      const r = await (state.role === 'gerant' ? api.gerant.subscribe(plan) : api.client.subscribe(plan));
      if (r?.subscription) dispatch({ type: 'SET_SUBSCRIPTION', payload: r.subscription });
      return { ...(r?.subscription || {}), payment: r?.payment || null };
    } catch (e) {
      if (e && e.status) throw e;
      throw Object.assign(new Error('Impossible de valider le paiement. Vérifiez votre connexion internet ou réessayez.'), { status: 0 });
    }
  }, [state.role]);

  const value = useMemo(
    () => ({ state, dispatch, online, checking, recheck: probe, login, register, logout, refresh, addGerant, removeGerant, createDemande, markPaid, cancelDemande, acceptDemande, declineDemande, completeDemande, subscribe, updateGerantProfile, registerPushToken, loadNotifications, markNotificationRead, markAllNotificationsRead, loadClientNotifications, markClientNotificationRead, markAllClientNotificationsRead, loadReferral, updateReferralCode }),
    [state, online, checking, probe, login, register, logout, refresh, addGerant, removeGerant, createDemande, markPaid, cancelDemande, acceptDemande, declineDemande, completeDemande, subscribe, updateGerantProfile, registerPushToken, loadNotifications, markNotificationRead, markAllNotificationsRead, loadClientNotifications, markClientNotificationRead, markAllClientNotificationsRead, loadReferral, updateReferralCode],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() { return useContext(Ctx); }
