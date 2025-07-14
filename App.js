import React, { useEffect, useContext } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Signup from './screens/SignUp'
import Login from './screens/Login'
import MainScreen from './screens/MainScreen'
import ChatScreen from './screens/ChatScreen'
import StartChatScreen from './screens/StartChatScreen'
import ProfileScreen from './screens/ProfileScreen'
import PhotoViewer from './screens/PhotoViewer'
import SettingsScreen from './screens/SettingsScreen'
import { ThemeProvider, ThemeContext } from './context/ThemeContext'
import * as Notifications from 'expo-notifications'
import { Platform, StatusBar } from 'react-native'
import { DefaultTheme, DarkTheme } from '@react-navigation/native'

const Stack = createNativeStackNavigator()

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

// Separate component that consumes ThemeContext
function AppContent() {
  const { darkMode } = useContext(ThemeContext);
  console.log('AppContent - Current darkMode:', darkMode);
  
  return (
    <>
      <StatusBar 
        barStyle={darkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={darkMode ? '#18181b' : '#fff'} 
      />
      <NavigationContainer theme={darkMode ? DarkTheme : DefaultTheme}>
        <Stack.Navigator initialRouteName="Signup">
          <Stack.Screen name="Signup" component={Signup} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen name="MainScreen" component={MainScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="StartChatScreen" component={StartChatScreen} options={{ title: 'New Chat' }} />
          <Stack.Screen name="ProfileScreen" component={ProfileScreen} options={{ title: 'Profile' }} />
          <Stack.Screen name="PhotoViewer" component={PhotoViewer} options={{ title: 'Photo' }} />
          <Stack.Screen name="SettingsScreen" component={SettingsScreen} options={{ title: 'Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  useEffect(() => {
    registerForPushNotificationsAsync()
  }, [])

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}

async function registerForPushNotificationsAsync() {
  let token
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    // Note: It's better to inform the user that permission was not granted.
    console.log('Failed to get push token for push notification!')
    return
  }
  token = (await Notifications.getExpoPushTokenAsync()).data
  console.log(token)

  return token
}
