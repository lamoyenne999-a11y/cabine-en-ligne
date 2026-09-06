import React, { useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider, useStore } from './src/store';
import { colors } from './src/theme';
import Welcome from './src/screens/Welcome';
import Login from './src/screens/Login';
import Signup from './src/screens/Signup';
import ClientApp from './src/screens/client/ClientApp';
import GerantApp from './src/screens/gerant/GerantApp';

function Root() {
  const { state, dispatch, login, register, logout, checking } = useStore();
  const [screen, setScreen] = useState('welcome'); // welcome | login | signup

  if (!state.loggedIn) {
    if (screen === 'login') {
      return (
        <Login
          role={state.role || 'client'}
          onBack={() => setScreen('welcome')}
          onLogin={(u) => login(u).catch(() => {})}
          onSignup={() => setScreen('signup')}
          connecting={checking}
        />
      );
    }
    if (screen === 'signup') {
      return (
        <Signup
          role={state.role || 'client'}
          onBack={() => setScreen('login')}
          onRegister={(u) => register(u).catch(() => {})}
          connecting={checking}
        />
      );
    }
    return (
      <Welcome
        onSelect={(role) => {
          dispatch({ type: 'SELECT_ROLE', role });
          setScreen('login');
        }}
      />
    );
  }

  const doLogout = () => { logout(); setScreen('welcome'); };

  return state.role === 'gerant'
    ? <GerantApp onLogout={doLogout} />
    : <ClientApp onLogout={doLogout} />;
}

export default function App() {
  return (
    <StoreProvider>
      <View style={{ flex: 1, backgroundColor: '#150D1F', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 440, backgroundColor: colors.bg, overflow: 'hidden' }}>
          <StatusBar style="light" />
          <Root />
        </View>
      </View>
    </StoreProvider>
  );
}
