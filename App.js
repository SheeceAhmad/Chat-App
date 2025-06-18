import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import Toast from 'react-native-root-toast'
import SignupScreen from './screens/SignUp'
import LoginScreen from './screens/Login'
import MainScreen from './screens/MainScreen'
import ChatScreen from './screens/ChatScreen'
import StartChatScreen from './screens/StartChatScreen'
import ProfileScreen from './screens/ProfileScreen'
import PhotoViewer from './screens/PhotoViewer'

const Stack = createNativeStackNavigator()

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Signup">
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="MainScreen" component={MainScreen}/>
        <Stack.Screen 
          name="StartChatScreen" 
          component={StartChatScreen}
          options={{
            headerTitleStyle: {
              fontFamily: 'Poppins-SemiBold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen 
          name="ChatScreen" 
          component={ChatScreen}
          options={({ route }) => ({
            title: route.params?.contactName || 'Chat',
            headerTitleStyle: {
              fontFamily: 'Poppins-SemiBold',
              fontSize: 18,
            },
          })}
        />
        <Stack.Screen 
          name="ProfileScreen" 
          component={ProfileScreen}
          options={{
            headerTitleStyle: {
              fontFamily: 'Poppins-SemiBold',
              fontSize: 18,
            },
          }}
        />
        <Stack.Screen
          name="PhotoViewer"
          component={PhotoViewer}
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
