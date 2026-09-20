import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider, useStore } from './src/store';
import { colors } from './src/theme';
import ConnectionBanner from './src/components/ConnectionBanner';
import Welcome from './src/screens/Welcome';
import Login from './src/screens/Login';
import { storage } from './src/storage';
import Signup from './src/screens/Signup';
import PublicProfile from './src/screens/PublicProfile';
import Admin from './src/screens/Admin';
import ClientApp from './src/screens/client/ClientApp';
import GerantApp from './src/screens/gerant/GerantApp';

function useShareId() {
  const [id, setId] = useState(null);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location) {
      const u = new URLSearchParams(window.location.search).get('u');
      if (u) setId(u);
    }
  }, []);
  return id;
}

function useRefCode() {
  const [code, setCode] = useState(null);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location) {
      const c = new URLSearchParams(window.location.search).get('ref');
      if (c) setCode(String(c).toUpperCase());
    }
  }, []);
  return code;
}

function Root() {
  const { state, dispatch, login, register, logout, checking } = useStore();
  const refCode = useRefCode();
  // Si on arrive via un lien de parrainage (?ref=CODE) et qu'on n'est pas
  // connecté, on ouvre directement l'inscription avec le code pré-rempli.
  // ?admin=1 : ouverture depuis une notification du propriétaire → Espace propriétaire direct.
  // (ou clé propriétaire mémorisée sur ce téléphone et aucun compte connecté).
  const wantsAdmin = (typeof window !== 'undefined' && window.location && /[?&]admin=1/.test(window.location.search))
    || (!state.loggedIn && !!storage.get('cel_owner_key'));
  const [screen, setScreen] = useState(wantsAdmin ? 'admin' : refCode ? 'signup' : 'welcome'); // welcome | login | signup | admin
  const shareId = useShareId();

  // Lien de partage : un profil ciblé -> page publique (par-dessus tout)
  if (shareId) {
    return <PublicProfile userId={shareId} />;
  }

  // Espace propriétaire (vue des paiements d'abonnement)
  if (screen === 'admin') {
    return <Admin onBack={() => setScreen('welcome')} />;
  }

  if (!state.loggedIn) {
    if (state.blockedPhone) {
      return (
        <Login role={state.role || 'client'} onBack={() => { dispatch({ type: 'CLEAR_BLOCKED_PHONE' }); setScreen('welcome'); }} onLogin={(u) => login(u)} onSignup={() => setScreen('signup')} connecting={checking} blockedPhone={state.blockedPhone} />
      );
    }
    if (screen === 'login') {
      return (
        <Login role={state.role || 'client'} onBack={() => setScreen('welcome')} onLogin={(u) => login(u)} onSignup={() => setScreen('signup')} connecting={checking} />
      );
    }
    if (screen === 'signup') {
      return (
        <Signup role={state.role || 'client'} onBack={() => setScreen('login')} onRegister={(u) => register(u)} connecting={checking} refCode={screen === 'signup' ? refCode : undefined} />
      );
    }
    return <Welcome onSelect={(role) => { dispatch({ type: 'SELECT_ROLE', role }); setScreen('login'); }} onAdmin={() => setScreen('admin')} />;
  }

  const doLogout = () => { logout(); setScreen('welcome'); };
  return state.role === 'gerant' ? <GerantApp onLogout={doLogout} /> : <ClientApp onLogout={doLogout} />;
}

export default function App() {
  return (
    <StoreProvider>
      <View style={{ flex: 1, backgroundColor: '#150D1F', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 440, backgroundColor: colors.bg, overflow: 'hidden' }}>
          <StatusBar style="light" />
          <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
            <ConnectionBanner />
          </View>
          <View style={{ flex: 1 }}>
            <Root />
          </View>
        </View>
      </View>
    </StoreProvider>
  );
}
