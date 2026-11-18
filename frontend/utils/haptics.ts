/**
 * Platform-safe haptics wrapper.
 * On web: all calls are silent no-ops (vibration API not reliable across browsers).
 * On native: delegates to expo-haptics.
 */
import { Platform } from 'react-native';

let Haptics: typeof import('expo-haptics') | null = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Haptics = require('expo-haptics');
}

export const haptics = {
  impact: (style?: any) => {
    if (Platform.OS === 'web' || !Haptics) return;
    Haptics.impactAsync(style ?? Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  selection: () => {
    if (Platform.OS === 'web' || !Haptics) return;
    Haptics.selectionAsync().catch(() => {});
  },
  notification: (type?: any) => {
    if (Platform.OS === 'web' || !Haptics) return;
    Haptics.notificationAsync(type ?? Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
};
