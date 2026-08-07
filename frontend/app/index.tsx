import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const session = await AsyncStorage.getItem('@ecotrack_user_session');
      if (session) {
        const parsed = JSON.parse(session);
        // Validate session has required fields
        if (parsed && parsed.email && parsed.user_id) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      setIsAuthenticated(false);
    } finally {
      setIsReady(true);
    }
  };

  if (!isReady) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(tabs)' : '/auth/login'} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0b1a13',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
