// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useApi } from '../services/api';
import { storage } from '../utils/storage';
import FinancialOnboarding from '../components/FinancialOnboarding';
import { AuthProvider, useAuth } from '../context/AuthContext';
import WebContainer from '../components/WebContainer';
import ColdStartBanner from '../components/ColdStartBanner';

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const api = useApi();

  const { isAuthenticated, isAuthLoaded, logout } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Register service worker on web only
  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  const checkProfileStatus = useCallback(async () => {
    try {
      const profile = await api.getProfile();
      if (!profile) setShowOnboarding(true);
    } catch (e: any) {
      console.error('Profile check failed', e);

      if (e.message === 'AUTH_DEAD' || e.message?.includes('Unauthenticated')) {
        await storage.deleteItem('jwt_token');
        if (logout) logout();
        router.replace('/sign-in');
      }
    }
  }, [api, router, logout]);

  useEffect(() => {
    if (!isAuthLoaded) return;

    const inAuthGroup = segments[0] === 'sign-in' || segments[0] === 'sign-up';

    if (isAuthenticated) {
      checkProfileStatus();
      if (inAuthGroup) {
        router.replace('/(tabs)/records');
      }
    } else {
      if (!inAuthGroup) {
        router.replace('/sign-in');
      }
    }
  }, [isAuthenticated, isAuthLoaded, segments, checkProfileStatus]);

  const handleOnboardingComplete = async (data: any) => {
    try {
      await api.updateProfile(data);
      setShowOnboarding(false);
    } catch (e) {
      console.error('Failed to save profile', e);
    }
  };

  if (!isAuthLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2E7D6E" />
      </View>
    );
  }

  return (
    <>
      <ColdStartBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack>
      <FinancialOnboarding visible={showOnboarding} onComplete={handleOnboardingComplete} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <WebContainer>
        <RootLayoutNav />
      </WebContainer>
    </AuthProvider>
  );
}
