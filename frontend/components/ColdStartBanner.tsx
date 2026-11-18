// components/ColdStartBanner.tsx
import React, { useEffect, useState } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';

const API_HOST = process.env.EXPO_PUBLIC_API_URL || 'https://habit-32hx.onrender.com';

export default function ColdStartBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let dismissed = false;
    const timer = setTimeout(() => {
      if (!dismissed) setVisible(true);
    }, 2500);

    fetch(API_HOST, { method: 'GET', signal: AbortSignal.timeout?.(30000) })
      .catch(() => {/* ignore errors — server woke up or failed, either way dismiss */})
      .finally(() => {
        dismissed = true;
        clearTimeout(timer);
        setVisible(false);
      });

    return () => {
      dismissed = true;
      clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>⏳ Waking up demo server, please wait a few seconds…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
  },
  text: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '500' as const,
  },
});
