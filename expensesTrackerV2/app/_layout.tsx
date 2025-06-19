import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';

// Create an authentication context
export const AuthContext = React.createContext<{
  user: FirebaseAuthTypes.User | null;
  initializing: boolean;
}>({
  user: null,
  initializing: true,
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Handle user state changes
  function onAuthStateChanged(user: FirebaseAuthTypes.User | null) {
    console.log('Root Layout - Auth state changed:', user ? `User: ${user.email}` : 'No user');
    setUser(user);
    if (initializing) setInitializing(false);
  }

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, []);

  if (!loaded || initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <ActivityIndicator size="large" color="#4285F4" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>
          {!loaded ? 'Loading fonts...' : 'Checking authentication...'}
        </Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, initializing }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthContext.Provider>
  );
}
