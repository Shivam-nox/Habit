// app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useApi } from '../services/api';
import * as SecureStore from 'expo-secure-store'; // ADD THIS IMPORT
import FinancialOnboarding from '../components/FinancialOnboarding';
import { AuthProvider, useAuth } from '../context/AuthContext'; 

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const api = useApi();
  
  // ⚠️ Ensure you pull out whatever function logs the user out from your context!
  // It might be called `logout`, `setIsAuthenticated`, or similar depending on how you wrote it.
  const { isAuthenticated, isAuthLoaded, logout } = useAuth(); 
  const [showOnboarding, setShowOnboarding] = useState(false);

 const checkProfileStatus = useCallback(async () => {
    try {
      const profile = await api.getProfile();
      if (!profile) setShowOnboarding(true);
    } catch (e: any) {
      console.error("Profile check failed", e);
      
      // 🛡️ THE LOOP BREAKER (Now catches raw backend errors too!) 🛡️
      if (e.message === 'AUTH_DEAD' || e.message?.includes('Unauthenticated')) {
        // 1. Clear the missing/dead token from the phone
        await SecureStore.deleteItemAsync('jwt_token');
        
        // 2. Tell the Context we are no longer authenticated
        if (logout) logout(); 
        
        // 3. Immediately kick to the sign-in screen
        router.replace('/sign-in');
      }
    }
  }, [api, router, logout]);
  // 🛡️ BULLETPROOF NAVIGATION GUARD 🛡️
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
      console.error("Failed to save profile", e);
    }
  };

  if (!isAuthLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <>
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
      <RootLayoutNav />
    </AuthProvider>
  );
}