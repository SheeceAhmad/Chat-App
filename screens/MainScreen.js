import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, SafeAreaView, Modal, Alert, ActivityIndicator, Image } from 'react-native';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../supabase/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export default function MainScreen({ navigation }) {
  console.log('MainScreen rendering');
  
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newChatUsername, setNewChatUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.profilePhotoButton}
            onPress={handleProfilePhotoPress}
          >
            <Image
              source={
                profilePhoto
                  ? { uri: profilePhoto }
                  : require('../assets/default-avatar.png')
              }
              style={styles.profilePhotoAdjusted}
            />
          </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerButton}
            onPress={() => navigation.navigate('Settings')}
        >
            <Ionicons name="settings-outline" size={24} color="#4f46e5" />
        </TouchableOpacity>
        </View>
      ),
      headerTitleStyle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
      },
    });
    fetchCurrentUser();
  }, [profilePhoto]);

  useEffect(() => {
    if (currentUserId) {
      fetchChats();
      subscribeToChats();
    }
  }, [currentUserId]);

  // Get current user
  const fetchCurrentUser = async () => {
    console.log('Fetching current user...');
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('User data:', user);
      
      if (error) {
        console.error('Error fetching user:', error.message);
        return;
      }
      
      if (user) {
        setCurrentUserId(user.id);
        // Fetch user profile including photo
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('profile_photo')
          .eq('id', user.id)
          .single();

        if (!profileError && profile?.profile_photo) {
          setProfilePhoto(profile.profile_photo);
        }
      }
    } catch (error) {
      console.error('Error in fetchCurrentUser:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch chats
  const fetchChats = async () => {
    console.log('Fetching chats for user:', currentUserId);
    try {
      const { data: chats, error } = await supabase
        .from('chats')
        .select(`
          id,
          user1_id,
          user2_id,
          updated_at,
          last_message
        `)
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching chats:', error.message);
        return;
      }

      // Fetch usernames for each chat
      const userIds = Array.from(new Set(chats.flatMap(chat => [chat.user1_id, chat.user2_id])));
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, username')
        .in('id', userIds);

      if (usersError) {
        console.error('Error fetching users:', usersError.message);
        return;
      }

      // Process chats to get the other user's info
      const processedChats = chats.map(chat => {
        const otherUserId = chat.user1_id === currentUserId ? chat.user2_id : chat.user1_id;
        const otherUser = users.find(u => u.id === otherUserId) || { username: 'Unknown' };
        return {
          id: chat.id,
          otherUserId,
          otherUsername: otherUser.username,
          lastMessage: chat.last_message,
          updatedAt: chat.updated_at
        };
      });

      console.log('Fetched chats:', processedChats);
      setChats(processedChats);
      setFilteredChats(processedChats);
    } catch (error) {
      console.error('Error in fetchChats:', error.message);
    }
  };

  const subscribeToChats = () => {
    const subscription = supabase
      .channel('chats')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chats',
        filter: `or(user1_id.eq.${currentUserId},user2_id.eq.${currentUserId})`,
      }, () => {
        fetchChats();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  // Search for users
  const searchUsers = async (username) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email')
        .neq('id', currentUserId)
        .ilike('username', `%${username}%`)
        .limit(5);

      if (error) {
        console.error('Error searching users:', error.message);
        return;
      }

      setSearchResults(data || []);
    } catch (error) {
      console.error('Error in searchUsers:', error.message);
    }
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredChats(chats);
    } else {
      const filtered = chats.filter(chat => 
        chat.otherUsername.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredChats(filtered);
    }
  }, [searchQuery, chats]);

  const handleChatPress = (chat) => {
    navigation.navigate('ChatScreen', {
      chatId: chat.id,
      contactId: chat.otherUserId,
      contactName: chat.otherUsername,
    });
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.replace('Login');
    } catch (error) {
      console.error('Error signing out:', error.message);
    }
  };

  const handleNewChat = () => {
    console.log('Navigating to StartChatScreen');
    navigation.navigate('StartChatScreen');
  };

  const handleSearchResultPress = async (item) => {
    try {
      // Create a new chat
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .insert([
          {
            user1_id: currentUserId,
            user2_id: item.id,
            last_message: '',
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (chatError) {
        Alert.alert('Error', 'Failed to create chat');
        return;
      }

      setIsModalVisible(false);
      setNewChatUsername('');
      navigation.navigate('ChatScreen', {
        chatId: chatData.id,
        contactId: item.id,
        contactName: item.username,
      });
    } catch (error) {
      console.error('Error creating new chat:', error.message);
      Alert.alert('Error', 'Failed to create chat');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderChatItem = ({ item }) => (
    <TouchableOpacity
      style={styles.chatItem}
      onPress={() => handleChatPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
          {item.otherUsername.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.username}>{item.otherUsername}</Text>
          <Text style={styles.timestamp}>{formatDate(item.updatedAt)}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage || 'No messages yet'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const handleProfilePhotoPress = () => {
    setIsProfileModalVisible(true);
  };

  const handleViewProfile = () => {
    setIsProfileModalVisible(false);
    navigation.navigate('ProfileScreen');
  };

  const handleViewPhoto = () => {
    setIsProfileModalVisible(false);
    setIsPhotoModalVisible(true);
  };

  const handleChangePhoto = async () => {
    setIsProfileModalVisible(false);
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to your photos.');
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
        const fileName = `${currentUserId}_${Date.now()}.jpg`;
        const filePath = `profile-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('profile-photos')
          .upload(filePath, decode(asset.base64), {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('profile-photos')
          .getPublicUrl(filePath);

        const { error: updateError } = await supabase
          .from('users')
          .update({
            profile_photo: publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentUserId);

        if (updateError) throw updateError;

        setProfilePhoto(publicUrl);
      }
    } catch (error) {
      console.error('Error updating profile photo:', error.message);
      Alert.alert('Error', 'Failed to update profile photo');
    }
  };

  if (!fontsLoaded || isLoading) {
    console.log('Loading state:', { fontsLoaded, isLoading });
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </View>
    );
  }

  console.log('Rendering main content');
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#4f46e5" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chats..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No chats found</Text>
            </View>
          }
        />

        <Modal
          visible={isModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Chat</Text>
                <TouchableOpacity
                  onPress={() => setIsModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Enter username..."
                  placeholderTextColor="#94a3b8"
                  value={newChatUsername}
                  onChangeText={(text) => {
                    setNewChatUsername(text);
                    searchUsers(text);
                  }}
                />

                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.searchResultItem}
                      onPress={() => {
                        setIsModalVisible(false);
                        setNewChatUsername('');
                        navigation.navigate('StartChatScreen', {
                          contactId: item.id,
                          contactName: item.username,
                        });
                      }}
                    >
                      <View style={styles.avatarContainer}>
                        <Text style={styles.avatarText}>
                          {item.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.contactInfo}>
                        <Text style={styles.username}>{item.username}</Text>
                        <Text style={styles.email}>{item.email}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <Text style={styles.noResultsText}>
                      {newChatUsername.trim() ? 'No users found' : 'Start typing to search'}
                    </Text>
                  }
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleNewChat}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={32} color="#ffffff" />
      </TouchableOpacity>

      {/* Profile Options Modal */}
      <Modal
        visible={isProfileModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsProfileModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsProfileModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleViewProfile}
            >
              <Ionicons name="person-outline" size={24} color="#4f46e5" />
              <Text style={styles.modalOptionText}>View Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleViewPhoto}
            >
              <Ionicons name="image-outline" size={24} color="#4f46e5" />
              <Text style={styles.modalOptionText}>View Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={handleChangePhoto}
            >
              <Ionicons name="camera-outline" size={24} color="#4f46e5" />
              <Text style={styles.modalOptionText}>Change Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalOption, styles.cancelOption]}
              onPress={() => setIsProfileModalVisible(false)}
            >
              <Text style={[styles.modalOptionText, { color: '#64748b' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Photo View Modal */}
      <Modal
        visible={isPhotoModalVisible}
        transparent={true}
        onRequestClose={() => setIsPhotoModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.photoModalOverlay}
          activeOpacity={1}
          onPress={() => setIsPhotoModalVisible(false)}
        >
          <Image
            source={
              profilePhoto
                ? { uri: profilePhoto }
                : require('../assets/default-avatar.png')
            }
            style={styles.zoomedPhoto}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#64748b',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#1a1a1a',
  },
  logoutButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginHorizontal: 24,
    marginVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#1a1a1a',
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#64748b',
  },
  lastMessage: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#64748b',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 8,
  },
  modalBody: {
    flex: 1,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  noResultsText: {
    textAlign: 'center',
    color: '#64748b',
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    marginTop: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePhotoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#4f46e5',
    marginRight: 8,
    backgroundColor: '#fff',
    alignSelf: 'center',
  },
  profilePhotoAdjusted: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#4f46e5',
    marginRight: 8,
    backgroundColor: '#fff',
    alignSelf: 'center',
  },
  headerButton: {
    marginRight: 16,
    padding: 4,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalOptionText: {
    marginLeft: 16,
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#1a1a1a',
  },
  cancelOption: {
    borderBottomWidth: 0,
    justifyContent: 'center',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomedPhoto: {
    width: '100%',
    height: '100%',
  },
});
