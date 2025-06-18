import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import supabase from '../supabase/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function SettingsScreen({ navigation }) {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      if (user) {
        setCurrentUserId(user.id);
        setEmail(user.email);

        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('username, profile_photo')
          .eq('id', user.id)
          .single();

        if (!profileError && profile) {
          setUsername(profile.username);
          setProfilePhoto(profile.profile_photo);
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error.message);
    }
  };

  const handleChangePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to your media library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = `${Date.now()}_profile.jpg`;
        const filePath = `profile-photos/${currentUserId}/${fileName}`;

        const { data, error } = await supabase.storage
          .from('profile-photos')
          .upload(filePath, decode(asset.base64), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(filePath);

        await supabase
          .from('users')
          .update({ profile_photo: publicUrl })
          .eq('id', currentUserId);

        setProfilePhoto(publicUrl);
      }
    } catch (error) {
      console.error('Error updating profile photo:', error.message);
      Alert.alert('Error', 'Failed to update profile photo');
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      Alert.alert('Error', 'Username cannot be empty');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ username: newUsername.trim() })
        .eq('id', currentUserId);

      if (error) throw error;

      setUsername(newUsername.trim());
      setIsEditingUsername(false);
      Alert.alert('Success', 'Username updated successfully');
    } catch (error) {
      console.error('Error updating username:', error.message);
      Alert.alert('Error', 'Failed to update username');
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('Error signing out:', error.message);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      {/* Profile Section */}
      <View style={styles.profileSection}>
        <TouchableOpacity onPress={handleChangePhoto}>
          <Image
            source={
              profilePhoto
                ? { uri: profilePhoto }
                : require('../assets/default-avatar.png')
            }
            style={styles.profilePhoto}
          />
          <View style={styles.editPhotoButton}>
            <Ionicons name="camera" size={20} color="#ffffff" />
          </View>
        </TouchableOpacity>
        
        <View style={styles.profileInfo}>
          {isEditingUsername ? (
            <View style={styles.usernameEdit}>
              <TextInput
                style={styles.usernameInput}
                value={newUsername}
                onChangeText={setNewUsername}
                placeholder="Enter new username"
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleUpdateUsername}
              >
                <Ionicons name="checkmark" size={24} color="#4f46e5" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.usernameContainer}
              onPress={() => {
                setNewUsername(username);
                setIsEditingUsername(true);
              }}
            >
              <Text style={styles.username}>{username}</Text>
              <Ionicons name="pencil" size={16} color="#64748b" />
            </TouchableOpacity>
          )}
          <Text style={styles.email}>{email}</Text>
        </View>
      </View>

      {/* Settings Sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Dark Mode</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: '#e2e8f0', true: '#4f46e5' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Push Notifications</Text>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: '#e2e8f0', true: '#4f46e5' }}
            thumbColor="#ffffff"
          />
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Sound</Text>
          <Switch
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ false: '#e2e8f0', true: '#4f46e5' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Read Receipts</Text>
          <Switch
            value={readReceipts}
            onValueChange={setReadReceipts}
            trackColor={{ false: '#e2e8f0', true: '#4f46e5' }}
            thumbColor="#ffffff"
          />
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Typing Indicator</Text>
          <Switch
            value={typingIndicator}
            onValueChange={setTypingIndicator}
            trackColor={{ false: '#e2e8f0', true: '#4f46e5' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  profileSection: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 20,
    right: 0,
    backgroundColor: '#4f46e5',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileInfo: {
    alignItems: 'center',
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#1a1a1a',
    marginRight: 8,
  },
  usernameEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  usernameInput: {
    fontSize: 20,
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    minWidth: 200,
  },
  saveButton: {
    padding: 8,
  },
  email: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#64748b',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 20,
    marginBottom: 40,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#ef4444',
    marginLeft: 8,
  },
}); 