import React, { useState, useContext } from 'react';
import {View, TextInput, Button, Text, Alert, ScrollView, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Image, Modal} from 'react-native';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import supabase from '../supabase/supabaseClient';
import { ThemeContext } from '../context/ThemeContext';

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

const dynamicStyles = {
  container: {
    flex: 1,
    backgroundColor: darkMode ? '#18181b' : '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 40,
    backgroundColor: darkMode ? '#18181b' : '#fff',
  },
  formContainer: {
    backgroundColor: darkMode ? '#23232b' : '#f8fafc',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: darkMode ? 0.3 : 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  logoText: {
    fontSize: 32,
    fontFamily: 'Poppins-Bold',
    color: darkMode ? '#f1f5f9' : '#4f46e5',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-SemiBold',
    color: darkMode ? '#f1f5f9' : '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: darkMode ? '#a1a1aa' : '#64748b',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: darkMode ? '#a1a1aa' : '#334155',
    marginBottom: 4,
  },
  input: {
    backgroundColor: darkMode ? '#23232b' : '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: darkMode ? '#f1f5f9' : '#1a1a1a',
    borderWidth: 1,
    borderColor: darkMode ? '#4b5563' : '#e2e8f0',
  },
  phoneNumberInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: darkMode ? '#f1f5f9' : '#1a1a1a',
    height: 48,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: darkMode ? '#23232b' : '#fff',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkMode ? '#23232b' : '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: darkMode ? '#4b5563' : '#e2e8f0',
    height: 48,
    paddingHorizontal: 8,
  },
  countryCodeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: darkMode ? '#374151' : '#f1f5f9',
  },
  countryCodeText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: darkMode ? '#f1f5f9' : '#1e293b',
  },
  // ...add more dynamic styles as needed for text, backgrounds, etc...
};

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={dynamicStyles.container}
    >
      <ScrollView contentContainerStyle={dynamicStyles.scrollContainer}>
        <View style={styles.headerContainer}>
          <View style={styles.logoContainer}>
            <Text style={dynamicStyles.logoText}>ChatApp</Text>
          </View>
          <Text style={dynamicStyles.title}>Create Account</Text>
          <Text style={dynamicStyles.subtitle}>Join our community today</Text>
        </View>

        <View style={dynamicStyles.formContainer}>
          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={dynamicStyles.label}>First Name</Text>
              <TextInput
                style={[
                  dynamicStyles.input,
                  focusedInput === 'firstName' && styles.inputFocused
                ]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="John"
                placeholderTextColor={darkMode ? '#a1a1aa' : '#94a3b8'}
                onFocus={() => setFocusedInput('firstName')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={dynamicStyles.label}>Last Name</Text>
              <TextInput
                style={[
                  dynamicStyles.input,
                  focusedInput === 'lastName' && styles.inputFocused
                ]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
                placeholderTextColor={darkMode ? '#a1a1aa' : '#94a3b8'}
                onFocus={() => setFocusedInput('lastName')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={dynamicStyles.label}>Username</Text>
            <TextInput
              style={[
                dynamicStyles.input,
                focusedInput === 'username' && styles.inputFocused
              ]}
              value={username}
              onChangeText={setUsername}
              placeholder="johndoe123"
              placeholderTextColor={darkMode ? '#a1a1aa' : '#94a3b8'}
              onFocus={() => setFocusedInput('username')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={dynamicStyles.label}>Phone</Text>
            <View style={dynamicStyles.phoneInputContainer}>
              <TouchableOpacity
                style={dynamicStyles.countryCodeButton}
                onPress={() => setShowCountryPicker(true)}
              >
                <Text style={dynamicStyles.countryCodeText}>+{countryCode}</Text>
              </TouchableOpacity>
              <TextInput
                style={[
                  dynamicStyles.phoneNumberInput,
                  focusedInput === 'phone' && styles.inputFocused
                ]}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholder="300 1234567"
                placeholderTextColor={darkMode ? '#a1a1aa' : '#94a3b8'}
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
            <Text style={dynamicStyles.label}>Gender</Text>
            <TextInput
              style={[
                dynamicStyles.input,
                focusedInput === 'gender' && styles.inputFocused
              ]}
              value={gender}
              onChangeText={setGender}
              placeholderTextColor={darkMode ? '#a1a1aa' : '#94a3b8'}
              placeholder="Male / Female / Other"
              onFocus={() => setFocusedInput('gender')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={dynamicStyles.label}>Email</Text>
            <TextInput
              style={[
                dynamicStyles.input,
                focusedInput === 'email' && styles.inputFocused
              ]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="example@email.com"
              placeholderTextColor={darkMode ? '#a1a1aa' : '#94a3b8'}
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={dynamicStyles.label}>Password</Text>
            <TextInput
              style={[
                dynamicStyles.input,
                focusedInput === 'password' && styles.inputFocused
              ]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Minimum 6 characters"
              placeholderTextColor={darkMode ? '#a1a1aa' : '#94a3b8'}
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
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    marginBottom: 8,
  },
  logoText: {
    fontSize: 32,
    fontFamily: 'Poppins-Bold',
    color: '#4f46e5',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-SemiBold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#64748b',
    marginBottom: 16,
  },
  formContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  inputGroup: {
    marginVertical: 10,
  },
  inputFocused: {
    borderColor: '#4f46e5',
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    height: 48,
    paddingHorizontal: 8,
  },
  countryCodeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  countryCodeText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#1e293b',
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


