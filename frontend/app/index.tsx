import { Redirect } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

const DEFAULT_GUEST_SESSION = {
  id: "usr1",
  user_id: "usr1",
  email: "user@ecotrack.org",
  name: "Eco Explorer",
  display_name: "Eco Explorer",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
  avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
  reputation_score: 100,
  role: "user",
  loggedInAt: new Date().toISOString(),
};

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [destination, setDestination] = useState<'/(tabs)' | '/auth/login'>('/(tabs)');

  const checkSession = useCallback(async () => {
    try {
      const loggedOut = await AsyncStorage.getItem('@ecotrack_logged_out');
      if (loggedOut === 'true') {
        setDestination('/auth/login');
        setIsReady(true);
        return;
      }

      const session = await AsyncStorage.getItem('@ecotrack_user_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed && (parsed.user_id || parsed.id)) {
          setDestination('/(tabs)');
          setIsReady(true);
          return;
        }
      }

      // First time launch: initialize active guest session so app loads instantly
      await AsyncStorage.setItem('@ecotrack_user_session', JSON.stringify(DEFAULT_GUEST_SESSION));
      await AsyncStorage.setItem('@ecotrack_user_id', DEFAULT_GUEST_SESSION.id);
      setDestination('/(tabs)');
    } catch {
      setDestination('/(tabs)');
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) checkSession();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [checkSession]);

  if (!isReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return <Redirect href={destination} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0b1a13',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
