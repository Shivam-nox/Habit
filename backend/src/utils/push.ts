import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { db } from '../db';
import { appNotifications } from '../db/schema';

// Create a new Expo SDK client
// optionally providing an access token if you have enabled push security
const expo = new Expo();

export const sendPushNotification = async (
  userId: string,
  pushToken: string | null | undefined,
  title: string,
  body: string,
  data: Record<string, any> = {}
) => {
  try {
    await db.insert(appNotifications).values({
      userId,
      title,
      message: body,
    });
  } catch (dbError) {
    console.error("Failed to save notification to DB:", dbError);
  }

  if (!pushToken) {
    console.log("No push token available, skipping notification.");
    return;
  }

  // Check that all your push tokens appear to be valid Expo push tokens
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const messages: ExpoPushMessage[] = [
    {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
    },
  ];

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log("Push notification sent:", ticketChunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  }
};
