import React, { useState, useContext } from 'react';
import { View, TouchableOpacity, TextInput, Button, Text, Alert, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import supabase from '../supabase/supabaseClient';
import Toast from 'react-native-root-toast';
import { ThemeContext } from '../context/ThemeContext';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { darkMode } = useContext(ThemeContext);

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const showToast = (message) => {
    Toast.show(message, {
      duration: Toast.durations.SHORT,
      position: Toast.positions.TOP,
      shadow: true,
      animation: true,
      hideOnPress: true,
      delay: 0,
    });
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showToast('Please enter both email and password');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('Please enter a valid email address');
      return;
    }

    // Basic password validation
    if (password.length < 6) {
      showToast('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Attempting login for email:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
    });

    if (error) {
        console.error('Login error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          stack: error.stack
        });
        
      if (error.message.toLowerCase().includes('invalid login credentials')) {
          showToast('Invalid email or password');
      } else if (error.message.toLowerCase().includes('email not confirmed')) {
          showToast('Please verify your email before logging in');
        } else if (error.message.toLowerCase().includes('rate limit')) {
          showToast('Too many attempts. Please try again later');
        } else {
          showToast(`Login failed: ${error.message}`);
        }
        return;
      }

      if (data?.user) {
        console.log('Login successful for user:', data.user.id);
        showToast('Logged in successfully');
        navigation.replace('MainScreen');
      } else {
        console.log('Login response missing user data');
        showToast('Login failed. Please try again');
      }
    } catch (error) {
      console.error('Unexpected login error:', error);
      showToast('An unexpected error occurred. Please try again');
    } finally {
      setIsLoading(false);
      }
  };

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: darkMode ? '#18181b' : '#fff',
    },
    formContainer: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
      backgroundColor: darkMode ? '#23232b' : '#fff',
    },
    title: {
      fontSize: 32,
      fontFamily: 'Poppins-Bold',
      color: darkMode ? '#f1f5f9' : '#1a1a1a',
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      fontFamily: 'Poppins-Regular',
      color: darkMode ? '#a1a1aa' : '#64748b',
      marginBottom: 32,
      textAlign: 'center',
    },
    inputContainer: {
      marginBottom: 20,
    },
    input: {
      backgroundColor: darkMode ? '#23232b' : '#f8fafc',
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 16,
      fontSize: 16,
      fontFamily: 'Poppins-Regular',
      color: darkMode ? '#f1f5f9' : '#1a1a1a',
      borderWidth: 1,
      height: 48,
      borderColor: darkMode ? '#4b5563' : '#e2e8f0',
    },
    inputFocused: {
      borderColor: '#4f46e5',
    },
    loginButton: {
      backgroundColor: '#4f46e5',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 16,
    },
    loginButtonDisabled: {
      opacity: 0.7,
    },
    loginButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontFamily: 'Poppins-SemiBold',
    },
    signupButton: {
      alignItems: 'center',
      padding: 16,
    },
    signupButtonText: {
      color: darkMode ? '#a1a1aa' : '#64748b',
      fontSize: 16,
      fontFamily: 'Poppins-Regular',
    },
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={dynamicStyles.container}
    >
      <View style={dynamicStyles.formContainer}>
        <Text style={dynamicStyles.title}>Welcome Back</Text>
        <Text style={dynamicStyles.subtitle}>Sign in to continue</Text>

        <View style={dynamicStyles.inputContainer}>
            <TextInput
            style={[
              dynamicStyles.input,
              focusedInput === 'email' && dynamicStyles.inputFocused
            ]}
            placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              placeholderTextColor={darkMode ? '#a1a1aa' : '#94a3b8'}
            editable={!isLoading}
            />
          </View>

        <View style={dynamicStyles.inputContainer}>
            <TextInput
              style={[
                dynamicStyles.input,
                focusedInput === 'password' && dynamicStyles.inputFocused
              ]}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              placeholderTextColor={darkMode ? '#a1a1aa' : '#94a3b8'}
            editable={!isLoading}
            />
          </View>

          <TouchableOpacity 
          style={[dynamicStyles.loginButton, isLoading && dynamicStyles.loginButtonDisabled]}
            onPress={handleLogin}
          disabled={isLoading}
          >
          <Text style={dynamicStyles.loginButtonText}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Text>
          </TouchableOpacity>

          <TouchableOpacity 
          style={dynamicStyles.signupButton}
            onPress={() => navigation.navigate('Signup')}
          disabled={isLoading}
          >
          <Text style={dynamicStyles.signupButtonText}>
            Don't have an account? Sign up
            </Text>
          </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
