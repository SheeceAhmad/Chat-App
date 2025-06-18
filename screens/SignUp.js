import React, { useState } from 'react';
import {View, TextInput, Button, Text, Alert, ScrollView, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Image, Modal} from 'react-native';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import supabase from '../supabase/supabaseClient';

// Common country codes
const countryCodes = [
  { code: '91', country: 'India', flag: '🇮🇳' },
  { code: '1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '44', country: 'UK', flag: '🇬🇧' },
  { code: '61', country: 'Australia', flag: '🇦🇺' },
  { code: '49', country: 'Germany', flag: '🇩🇪' },
  { code: '33', country: 'France', flag: '🇫🇷' },
  { code: '86', country: 'China', flag: '🇨🇳' },
  { code: '81', country: 'Japan', flag: '🇯🇵' },
  { code: '82', country: 'South Korea', flag: '🇰🇷' },
  { code: '65', country: 'Singapore', flag: '🇸🇬' },
];

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState('');
  const [focusedInput, setFocusedInput] = useState(null);
  const [countryCode, setCountryCode] = useState('91');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

const handleSignup = async () => {
  if (!email || !password || !firstName || !lastName || !username || !phoneNumber || !gender) {
    Alert.alert('Error', 'Please fill in all fields');
    return;
  }

  if (password.length < 6) {
    Alert.alert('Error', 'Password must be at least 6 characters');
    return;
  }

  // Format phone number with country code
  const formattedPhoneNumber = `+${countryCode}${phoneNumber.replace(/^0+/, '')}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    Alert.alert('Signup Failed', error.message);
    return;
  }

  const user = data.user;

  if (user) {
    const { error: insertError } = await supabase
      .from('users')
      .insert([
        {
          id: user.id,
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          username: username,
          phone: formattedPhoneNumber,
          gender: gender,
          created_at: new Date(),
        },
      ]);

    if (insertError) {
      console.log('DB insert error:', insertError.message);
      Alert.alert('Signup Incomplete', 'Auth OK, but failed to save profile');
    } else {
      navigation.navigate('Login');
    }
  } else {
    Alert.alert('Signup Failed', 'Unexpected error occurred.');
  }
};


  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.headerContainer}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>ChatApp</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join our community today</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedInput === 'firstName' && styles.inputFocused
                ]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="John"
                placeholderTextColor={'#94a3b8'}
                onFocus={() => setFocusedInput('firstName')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedInput === 'lastName' && styles.inputFocused
                ]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
                placeholderTextColor={'#94a3b8'}
                onFocus={() => setFocusedInput('lastName')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={[
                styles.input,
                focusedInput === 'username' && styles.inputFocused
              ]}
              value={username}
              onChangeText={setUsername}
              placeholder="johndoe123"
              placeholderTextColor={'#94a3b8'}
              onFocus={() => setFocusedInput('username')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <View style={styles.phoneInputContainer}>
              <TouchableOpacity
                style={styles.countryCodeButton}
                onPress={() => setShowCountryPicker(true)}
              >
                <Text style={styles.countryCodeText}>+{countryCode}</Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.phoneNumberInput,
                  focusedInput === 'phone' && styles.inputFocused
                ]}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholder="300 1234567"
                placeholderTextColor={'#94a3b8'}
                onFocus={() => setFocusedInput('phone')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <Modal
            visible={showCountryPicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowCountryPicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Country Code</Text>
                  <TouchableOpacity
                    onPress={() => setShowCountryPicker(false)}
                    style={styles.closeButton}
                  >
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.countryList}>
                  {countryCodes.map((country) => (
                    <TouchableOpacity
                      key={country.code}
                      style={styles.countryItem}
                      onPress={() => {
                        setCountryCode(country.code);
                        setShowCountryPicker(false);
                      }}
                    >
                      <Text style={styles.countryFlag}>{country.flag}</Text>
                      <Text style={styles.countryName}>{country.country}</Text>
                      <Text style={styles.countryCode}>+{country.code}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <TextInput
              style={[
                styles.input,
                focusedInput === 'gender' && styles.inputFocused
              ]}
              value={gender}
              onChangeText={setGender}
              placeholderTextColor={'#94a3b8'}
              placeholder="Male / Female / Other"
              onFocus={() => setFocusedInput('gender')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[
                styles.input,
                focusedInput === 'email' && styles.inputFocused
              ]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="example@email.com"
              placeholderTextColor={'#94a3b8'}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[
                styles.input,
                focusedInput === 'password' && styles.inputFocused
              ]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Minimum 6 characters"
              placeholderTextColor={'#94a3b8'}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <TouchableOpacity 
            onPress={handleSignup} 
            style={styles.button}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => navigation.navigate('Login')}
            style={styles.loginLinkContainer}
          >
            <Text style={styles.loginLinkText}>
              Already have an account? <Text style={styles.loginLinkHighlight}>Login</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 24,
  },
  headerContainer: {
    marginBottom: 32,
    alignItems: 'center',
    marginTop: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoText: {
    fontSize: 32,
    fontFamily: 'Poppins-Bold',
    color: '#4f46e5',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#64748b',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#1a1a1a',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputFocused: {
    borderColor: '#7c3aed',
    borderWidth: 2,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    backgroundColor: '#faf5ff',
  },
  button: {
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#4f46e5',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    letterSpacing: 0.5,
  },
  loginLinkContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginLinkText: {
    color: '#64748b',
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  loginLinkHighlight: {
    color: '#4f46e5',
    fontFamily: 'Poppins-SemiBold',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryCodeButton: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minWidth: 80,
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
  },
  phoneNumberInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748b',
  },
  countryList: {
    maxHeight: 400,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
  },
  countryCode: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#4f46e5',
  },
});


