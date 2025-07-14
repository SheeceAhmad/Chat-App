import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import * as ImagePicker from 'expo-image-picker';
import supabase from '../supabase/supabaseClient';
import { decode } from 'base64-arraybuffer';
import { ThemeContext } from '../context/ThemeContext';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);
  const [editedUser, setEditedUser] = useState(null);
  const { darkMode } = useContext(ThemeContext);

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
  });

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: darkMode ? '#18181b' : '#fff',
    },
    label: {
      fontSize: 14,
      fontFamily: 'Poppins-Medium',
      color: darkMode ? '#a1a1aa' : '#64748b',
      marginBottom: 8,
    },
    value: {
      fontSize: 16,
      fontFamily: 'Poppins-Regular',
      color: darkMode ? '#f1f5f9' : '#1a1a1a',
    },
    // ...add more dynamic styles as needed for text, backgrounds, etc...
  };

  useEffect(() => {
    navigation.setOptions({
      title: 'Profile',
      headerTitleStyle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
      },
    });
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) throw profileError;

      // Add cache-busting query string
      if (profile && profile.profile_photo) {
        profile.profile_photo = `${profile.profile_photo}?t=${Date.now()}`;
      }
      setUser(profile);
      setEditedUser(profile);
    } catch (error) {
      console.error('Error fetching user profile:', error.message);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          username: editedUser.username,
          phone: editedUser.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setUser(editedUser);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error.message);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handlePhotoUpdate = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.IMAGE,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsLoading(true);
        const asset = result.assets[0];
        const fileName = `${user.id}_${Date.now()}.jpg`;
        const filePath = `${user.id}/${fileName}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('profile-photos')
          .upload(filePath, decode(asset.base64), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (error) {
          console.error('Upload error:', error);
          Alert.alert('Upload failed', error.message);
          return;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(filePath);

        // Update user profile with new photo URL
        const { error: updateError } = await supabase
          .from('users')
          .update({ profile_photo: publicUrl })
          .eq('id', user.id);

        if (updateError) {
          console.error('Profile update error:', updateError);
          Alert.alert('Update failed', 'Failed to update profile photo');
          return;
        }

        // Re-fetch user profile to update photo in state (with cache-busting)
        await fetchUserProfile();

        Alert.alert('Success', 'Profile photo updated successfully');
      }
    } catch (error) {
      console.error('Photo update error:', error);
      Alert.alert('Error', 'Failed to update profile photo');
    } finally {
      setIsLoading(false);
    }
  };

  if (!fontsLoaded || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={styles.photoContainer}>
        <TouchableOpacity onPress={() => setIsPhotoModalVisible(true)}>
          <Image
            source={
              user?.profile_photo
                ? { uri: user.profile_photo }
                : require('../assets/default-avatar.png')
            }
            style={styles.profilePhoto}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.editPhotoButton} onPress={handlePhotoUpdate}>
          <Ionicons name="camera" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.detailsContainer}>
        {isEditing ? (
          <>
            <View style={styles.inputGroup}>
              <Text style={dynamicStyles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={editedUser.username}
                onChangeText={(text) => setEditedUser(prev => ({ ...prev, username: text }))}
                placeholder="Username"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={dynamicStyles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={editedUser.phone}
                onChangeText={(text) => setEditedUser(prev => ({ ...prev, phone: text }))}
                placeholder="Phone number"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.buttonText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setEditedUser(user);
                  setIsEditing(false);
                }}
              >
                <Text style={[styles.buttonText, { color: '#64748b' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.detailRow}>
              <Text style={dynamicStyles.label}>Username</Text>
              <Text style={dynamicStyles.value}>{user.username}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={dynamicStyles.label}>Email</Text>
              <Text style={dynamicStyles.value}>{user.email}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={dynamicStyles.label}>Phone</Text>
              <Text style={dynamicStyles.value}>{user.phone}</Text>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Modal
        visible={isPhotoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPhotoModalVisible(false)}
      >
        <View style={{ 
          flex: 1, 
          backgroundColor: 'rgba(0,0,0,0.9)', 
          justifyContent: 'center', 
          alignItems: 'center' 
        }}>
          <View style={{ 
            backgroundColor: darkMode ? '#18181b' : '#fff', 
            borderRadius: 20, 
            padding: 30, 
            alignItems: 'center',
            margin: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5
          }}>
            <Image
              source={user?.profile_photo ? { uri: user.profile_photo } : require('../assets/default-avatar.png')}
              style={{ 
                width: 180, 
                height: 180, 
                borderRadius: 90, 
                marginBottom: 25
              }}
              resizeMode="cover"
            />
            <TouchableOpacity 
              onPress={() => setIsPhotoModalVisible(false)} 
              style={{ 
                backgroundColor: '#4f46e5', 
                paddingVertical: 15, 
                paddingHorizontal: 30, 
                borderRadius: 10,
                minWidth: 100,
                alignItems: 'center'
              }}
            >
              <Text style={{ 
                color: '#fff', 
                fontFamily: 'Poppins-Medium', 
                fontSize: 16 
              }}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  photoContainer: {
    alignItems: 'center',
    padding: 24,
    position: 'relative',
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f1f5f9',
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 24,
    right: '50%',
    marginRight: -60,
    backgroundColor: '#4f46e5',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  detailsContainer: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailRow: {
    marginBottom: 24,
  },
  editButton: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
  },
  inputGroup: {
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  buttonContainer: {
    marginTop: 24,
  },
  saveButton: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#ffffff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomedPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
  },
}); 