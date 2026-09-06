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

const now = () => Date.now();
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

  // Client : ses gérants (contacts) + ses demandes
  gerants: [
    { id: 'g1', userId: 'u_amadou', name: 'Boutique Amadou', phone: '771234567', waveNumber: '771234567', payLink: '', rating: 4.8, online: true },
    { id: 'g2', userId: 'u_fatou', name: 'Kiosque Fatou', phone: '789876543', waveNumber: '789876543', payLink: '', rating: 4.6, online: false },
    { id: 'g3', userId: 'u_moussa', name: 'Cabine Moussa', phone: '765554433', waveNumber: '765554433', payLink: '', rating: 4.2, online: true },
  ],
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
  const login = useCallback(async ({ role, phone, password }) => {
    if (!online) {
      const name = role === 'gerant' ? 'Cabine Marie' : 'Jean Dupont';
      const user = { id: role === 'gerant' ? 'u_marie' : 'u_client', role, name, phone, waveNumber: phone };
      const subscription = { status: 'trial', daysLeft: 30, price: 100 };
      dispatch({ type: 'LOGIN', payload: { user, subscription } });
      persistSession({ user, subscription });
      return { source: 'mock' };
    }
    try {
      const { token, user, subscription } = await api.login({ phone, password: password || '' });
      setToken(token);
      dispatch({ type: 'LOGIN', payload: { user, subscription } });
      persistSession({ user, subscription });
      return { source: 'api' };
    } catch (e) {
      if (e && e.status === 401) throw e;
      const user = { id: 'u_client', role, name: 'Jean Dupont', phone, waveNumber: phone };
      const subscription = { status: 'trial', daysLeft: 30, price: 100 };
      dispatch({ type: 'LOGIN', payload: { user, subscription } });
      persistSession({ user, subscription });
      return { source: 'mock' };
    }
  }, [online]);

  const register = useCallback(async (payload) => {
    if (!online) {
      const subscription = { status: 'trial', daysLeft: 30, price: 100 };
      dispatch({ type: 'SIGNUP', payload: { user: { ...payload }, subscription } });
      persistSession({ user: { ...payload }, subscription });
      return { source: 'mock' };
    }
    try {
      const { token, user, subscription } = await api.register(payload);
      setToken(token);
      dispatch({ type: 'SIGNUP', payload: { user, subscription } });
      persistSession({ user, subscription });
      return { source: 'api' };
    } catch (e) {
      if (e && (e.status === 401 || e.status === 409)) throw e;
      const subscription = { status: 'trial', daysLeft: 30, price: 100 };
      dispatch({ type: 'SIGNUP', payload: { user: { ...payload }, subscription } });
      persistSession({ user: { ...payload }, subscription });
      return { source: 'mock' };
    }
  }, [online]);

  const logout = useCallback(() => { clearToken(); clearSession(); dispatch({ type: 'LOGOUT' }); }, []);

  // ---- Restauration de session au démarrage (rester connecté) ----
  const restore = useCallback(async () => {
    if (!online) return;             // hors ligne : on garde la session locale
    try {
      const { user, subscription } = await api.me();
      dispatch({ type: 'LOGIN', payload: { user, subscription } });
      persistSession({ user, subscription });
    } catch { /* jeton invalide/expiré → on laisse la session locale (démo) */ }
  }, [online]);
  useEffect(() => { if (online && state.loggedIn && getToken()) restore(); }, [online]); // eslint-disable-line

  // ---- Rafraîchit depuis le serveur ----
  const refresh = useCallback(async () => {
    if (!online) return;
    try {
      const sub = await (state.role === 'gerant' ? api.gerant.subscription() : api.client.subscription()).catch(() => null);
      if (sub) dispatch({ type: 'SET_SUBSCRIPTION', payload: sub.subscription });

      if (state.role === 'client') {
        const [g, av, d, n] = await Promise.all([
          api.client.gerants().catch(() => null),
          api.client.availableGerants().catch(() => null),
          api.client.myDemandes().catch(() => null),
          api.client.notifications().catch(() => null),
        ]);
        dispatch({ type: 'HYDRATE', payload: { gerants: g?.gerants, demandes: d?.demandes } });
        if (av) dispatch({ type: 'SET_AVAILABLE_GERANTS', payload: av.gerants });
        if (n) dispatch({ type: 'SET_CLIENT_NOTIFICATIONS', payload: n });
      } else if (state.role === 'gerant') {
        const [d, n] = await Promise.all([
          api.gerant.demandes().catch(() => null),
          api.gerant.notifications().catch(() => null),
        ]);
        if (d) dispatch({ type: 'SET_GERANT_DEMANDES', payload: d.demandes });
        if (n) dispatch({ type: 'SET_NOTIFICATIONS', payload: n });
      }
    } catch { /* silencieux */ }
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
  const addGerant = useCallback(async (payload) => {
    if (online) {
      try {
        const { gerant } = await api.client.addGerant(payload);
        dispatch({ type: 'ADD_GERANT', payload: gerant });
        return gerant;
      } catch { /* fallback */ }
    }
    dispatch({ type: 'ADD_GERANT', payload: { id: 'g_' + now(), name: payload.name || `Gérant ${(payload.phone || '').slice(-4)}`, phone: payload.phone, waveNumber: payload.phone, payLink: payload.payLink || '', rating: 4.0, online: true } });
    return { id: 'g_' + now() };
  }, [online]);

  const removeGerant = useCallback(async (id) => {
    dispatch({ type: 'REMOVE_GERANT', payload: id });
    if (online) { try { await api.client.removeGerant(id); } catch {} }
  }, [online]);

  const createDemande = useCallback(async (payload) => {
    let d;
    if (online) {
      try {
        const { demande } = await api.client.createDemande(payload);
        dispatch({ type: 'ADD_DEMANDE', payload: demande });
        return demande;
      } catch { /* fallback */ }
    }
    d = { id: 'd_' + now(), status: 'pending', type: payload.type, amount: payload.amount, gerantName: payload.gerantName, gerantWave: payload.gerantWave, gerantPayLink: payload.gerantPayLink || '', clientName: 'Vous', benefName: payload.benefName, benefPhone: payload.benefPhone, gerantId: payload.gerantId, createdAt: now() };
    dispatch({ type: 'ADD_DEMANDE', payload: d });
    return d;
  }, [online]);

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
    const price = plan === 'annual' ? 1000 : 100;
    const periodLabel = plan === 'annual' ? 'annuel' : 'mensuel';
    const sub = { status: 'active', plan, price, periodLabel, priceLabel: plan === 'annual' ? '1000 FCFA / an' : '100 FCFA / mois', daysLeft: plan === 'annual' ? 365 : 30 };
    dispatch({ type: 'SET_SUBSCRIPTION', payload: sub });
    if (online) { try { const r = await (state.role === 'gerant' ? api.gerant.subscribe(plan) : api.client.subscribe(plan)); if (r?.subscription) dispatch({ type: 'SET_SUBSCRIPTION', payload: r.subscription }); } catch {} }
    return sub;
  }, [online, state.role]);

  const value = useMemo(
    () => ({ state, dispatch, online, checking, login, register, logout, refresh, addGerant, removeGerant, createDemande, markPaid, cancelDemande, acceptDemande, declineDemande, completeDemande, subscribe, updateGerantProfile, loadNotifications, markNotificationRead, markAllNotificationsRead, loadClientNotifications, markClientNotificationRead, markAllClientNotificationsRead }),
    [state, online, checking, login, register, logout, refresh, addGerant, removeGerant, createDemande, markPaid, cancelDemande, acceptDemande, declineDemande, completeDemande, subscribe, updateGerantProfile, loadNotifications, markNotificationRead, markAllNotificationsRead, loadClientNotifications, markClientNotificationRead, markAllClientNotificationsRead],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() { return useContext(Ctx); }
