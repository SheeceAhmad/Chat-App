import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import supabase from '../supabase/supabaseClient';

// Configure how notifications appear when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  static async registerForPushNotifications() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4f46e5',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }
      
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'your-expo-project-id', // Replace with your Expo project ID
      })).data;
      
      console.log('Push token generated:', token);
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  static async savePushToken(userId, token) {
    try {
      console.log('Saving push token for user:', userId);
      const { data, error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          push_token: token,
          updated_at: new Date().toISOString(),
        })
        .select();

      if (error) {
        console.error('Error saving push token:', error.message);
        throw error;
      }
      
      console.log('Push token saved successfully:', data);
    } catch (error) {
      console.error('Error saving push token:', error.message);
    }
  }

  static async getRecipientPushToken(recipientId) {
    try {
      console.log('Getting push token for recipient:', recipientId);
      const { data, error } = await supabase
        .from('user_push_tokens')
        .select('push_token')
        .eq('user_id', recipientId)
        .single();

      if (error) {
        console.error('Error getting recipient push token:', error.message);
        throw error;
      }
      
      console.log('Recipient push token:', data?.push_token);
      return data?.push_token;
    } catch (error) {
      console.error('Error getting recipient push token:', error.message);
      return null;
    }
  }

  static async sendPushNotification(pushToken, title, body, data = {}) {
    try {
      console.log('Sending push notification to token:', pushToken);
      const message = {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
        badge: 1,
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      console.log('Push notification sent:', result);
    } catch (error) {
      console.error('Error sending push notification:', error.message);
    }
  }
}

export default NotificationService; 