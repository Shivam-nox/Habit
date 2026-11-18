// components/WebContainer.tsx
import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
}

export default function WebContainer({ children }: Props) {
  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <View style={styles.outer}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  frame: {
    width: '100%' as any,
    maxWidth: 480,
    flex: 1,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden' as any,
    ...({ boxShadow: '0 0 40px rgba(0,0,0,0.15)' } as any),
  },
});
