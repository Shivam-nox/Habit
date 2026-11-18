import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useApi } from '../services/api';

// On web push notifications are not supported — the hook becomes a safe no-op.
export function usePushNotifications() {
  const [expoPushToken] = useState('');
  const { savePushToken } = useApi();

  useEffect(() => {
    if (Platform.OS === 'web') return; // skip entirely on web
    registerForPushNotificationsAsync(savePushToken);
  }, []);

  return { expoPushToken, notification: undefined };
}

async function registerForPushNotificationsAsync(
  savePushToken: (token: string) => Promise<any>,
) {
  try {
    const Device = await import('expo-device');
    const Notifications = await import('expo-notifications');
    const Constants = (await import('expo-constants')).default;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) return;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    if (tokenData?.data) {
      savePushToken(tokenData.data).catch(() => {});
    }
  } catch (e) {
    console.log('Push notification setup failed (non-fatal):', e);
  }
}
