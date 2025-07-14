import React, { useEffect, useState, useContext, useRef } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, SafeAreaView, Modal, Alert, ActivityIndicator, Image } from 'react-native';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../supabase/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated } from 'react-native';

const CHATS_CACHE_KEY = 'chats_cache';

// Animated chat item for fade-in
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Helper: get initial and color for avatar
const getInitialAndColor = (name) => {
  const initial = name && name.length > 0 ? name[0].toUpperCase() : '?';
  // Simple hash for color
  const colors = ['#4f46e5', '#06b6d4', '#f59e42', '#10b981', '#ef4444', '#a21caf'];
  let hash = 0;
  for (let i = 0; i < initial.length; i++) hash += initial.charCodeAt(i);
  return { initial, color: colors[hash % colors.length] };
};

// Animated chat item as a component
function AnimatedChatItem({ item, index, darkMode, onPress, onLongPress, formatDate }) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350 + index * 40,
      useNativeDriver: true,
    }).start();
  }, []);

  const { initial, color } = getInitialAndColor(item.other_user_username);
  const showAvatar = !!item.other_user_photo;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        style={[
          styles.chatItem,
          darkMode && { backgroundColor: 'transparent' },
        ]}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.85}
      >
        {showAvatar ? (
          <Image
            source={{ uri: item.other_user_photo }}
            style={[styles.avatarPhoto, darkMode && { borderColor: '#23232b' }]}
          />
        ) : (
          <View style={[styles.avatarPhoto, { backgroundColor: color, justifyContent: 'center', alignItems: 'center', borderColor: '#fff' }]}> 
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        <View style={styles.chatInfo}>
          <Text style={[styles.username, darkMode && { color: '#f1f5f9' }]} numberOfLines={1}>{item.other_user_username}</Text>
          <Text style={[styles.lastMessage, darkMode && { color: '#a1a1aa' }]} numberOfLines={1}>{item.last_message || 'No messages'}</Text>
        </View>
        <Text style={[styles.timestamp, darkMode && { color: '#a1a1aa' }]}>{item.updated_at ? formatDate(item.updated_at) : ''}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

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
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  const isFetching = useRef(false);
  const isFocused = useIsFocused();
  const { darkMode } = useContext(ThemeContext);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    if (!currentUserId) {
      fetchCurrentUser();
    }
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('chats-main-screen-re-fix')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats', filter: `or(user1_id.eq.${currentUserId},user2_id.eq.${currentUserId})` }, 
        (payload) => {
          console.log('Change received!', payload)
          fetchChats();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Real-time channel subscribed!');
        }
      });

        fetchChats();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (isFocused && currentUserId) {
      fetchChats();
    }
  }, [isFocused]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setEmail(user.email);
        const { data: profile } = await supabase.from('users').select('profile_photo, username').eq('id', user.id).single();
        if (profile) {
          const photoUrl = profile.profile_photo ? `${profile.profile_photo}?t=${Date.now()}` : null;
          setProfilePhoto(photoUrl);
          setUsername(profile.username);
        }
      } else {
        await AsyncStorage.removeItem(CHATS_CACHE_KEY);
        navigation.replace('Login');
      }
    } catch (error) {
      console.error("Error fetching user:", error.message);
    }
  };

  const fetchChats = async () => {
    if (isFetching.current || !currentUserId) return;
    isFetching.current = true;
    if (chats.length === 0) {
      setIsLoading(true);
    }
    try {
      const { data: chatsData, error } = await supabase
        .from('chats')
        .select(`
          id,
          updated_at,
          last_message,
          user1:users!user1_id(id, username, profile_photo),
          user2:users!user2_id(id, username, profile_photo)
        `)
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order('updated_at', { ascending: false });
      console.log('Fetched chatsData:', chatsData);
      if (error) {
        console.error('Error fetching chats:', error.message);
        Alert.alert('Error', 'Could not refresh your chats.');
        return;
      }
      const processedChats = chatsData.map(chat => {
        const otherUser = chat.user1.id === currentUserId ? chat.user2 : chat.user1;
        return {
          id: chat.id,
          updated_at: chat.updated_at,
          last_message: chat.last_message,
          other_user_id: otherUser.id,
          other_user_username: otherUser.username,
          other_user_photo: otherUser.profile_photo,
        };
      });
      console.log('Processed chats:', processedChats);
      setChats(processedChats);
      setFilteredChats(processedChats);
      await AsyncStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(processedChats));
    } catch (err) {
      console.error('Error in fetchChats function:', err.message);
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  };

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
        chat.other_user_username.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredChats(filtered);
    }
  }, [searchQuery, chats]);

  const handleChatPress = (chat) => {
    navigation.navigate('ChatScreen', {
      chatId: chat.id,
      contactId: chat.other_user_id,
      contactName: chat.other_user_username,
    });
  };

  const handleLogout = async () => {
      const { error } = await supabase.auth.signOut();
    if (!error) {
      await AsyncStorage.removeItem(CHATS_CACHE_KEY);
      navigation.replace('Login');
    } else {
      console.error('Error logging out:', error.message);
      Alert.alert('Error', 'Could not log out.');
    }
  };

  const handleNewChat = () => {
    console.log('Navigating to StartChatScreen');
    navigation.navigate('StartChatScreen');
  };

  const handleSearchResultPress = async (item) => {
    try {
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

  const handleLongPressChat = (chatId) => {
    Alert.alert(
      'Delete Chat',
      'Are you sure you want to permanently delete this chat and all its messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteChat(chatId) },
      ]
    );
  };

  const deleteChat = async (chatId) => {
    try {
      await supabase.from('messages').delete().eq('chat_id', chatId);
      await supabase.from('chats').delete().eq('id', chatId);

      setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
    } catch (error) {
      console.error('Error deleting chat:', error.message);
      Alert.alert('Error', 'Failed to delete chat.');
    }
  };

  const renderChatItem = ({ item, index }) => (
    <AnimatedChatItem
      item={item}
      index={index}
      darkMode={darkMode}
      onPress={() => handleChatPress(item)}
      onLongPress={() => handleLongPressChat(item.id)}
      formatDate={formatDate}
    />
  );

  const renderSeparator = () => (
    <View style={[styles.chatSeparator, darkMode && { backgroundColor: '#23232b' }]} />
  );

  const handleProfilePhotoPress = () => {
    console.log('Profile photo pressed, opening modal');
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
        mediaTypes: 'Images',
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
          })
          .eq('id', currentUserId);

        if (updateError) throw updateError;

        await fetchCurrentUser();
      }
    } catch (error) {
      console.error('Error updating profile photo:', error.message);
      Alert.alert('Error', 'Failed to update profile photo');
    }
  };

  if (!fontsLoaded) {
    return <View style={[styles.loadingContainer, darkMode && { backgroundColor: '#18181b' }]}><ActivityIndicator size="large" /></View>;
  }

  return (
    <SafeAreaView style={[styles.safeArea, darkMode && { backgroundColor: '#18181b' }]}>
      {/* Gradient accent at top */}
      <LinearGradient
        colors={darkMode ? ['#23232b', '#23232b'] : ['#f1f5f9', '#e0e7ef']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topGradient}
      />
      <View style={[styles.container, darkMode && { backgroundColor: '#18181b' }]}>
        {/* Header */}
        <View style={[styles.header, darkMode && { backgroundColor: '#23232b' }]}>
          <View>
            <Text style={[styles.appTitle, { color: darkMode ? '#fff' : '#4f46e5' }]}>ChatApp</Text>
          </View>
          <View style={[styles.headerIconsContainer, darkMode && { flexDirection: 'row', alignItems: 'center' }]}>
            <TouchableOpacity onPress={handleProfilePhotoPress} style={[styles.headerButton, darkMode && { paddingLeft: 16 }]}>
              <Image source={profilePhoto ? { uri: profilePhoto } : require('../assets/default-avatar.png')} style={[styles.profilePhoto, darkMode && { backgroundColor: '#27272a' }]} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('SettingsScreen')} style={[styles.headerButton, darkMode && { paddingLeft: 16 }]}>
              <Ionicons name="settings-outline" size={24} color="#4f46e5" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.headerButton, darkMode && { paddingLeft: 16 }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={28} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.messagesHeader, darkMode && { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginTop: 16, marginBottom: 8 }]}>
          <Text style={[styles.messagesTitle, darkMode && { color: '#f1f5f9' }]}>Messages</Text>
          <TouchableOpacity>
            <Ionicons name="archive-outline" size={22} color="#a1a1aa" />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchContainer, darkMode && { backgroundColor: '#23232b', borderColor: '#27272a' }]}>
          <Ionicons name="search-outline" size={20} color="#a1a1aa" />
          <TextInput
            style={[styles.searchInput, darkMode && { color: '#f1f5f9' }]}
            placeholder="Search chats..."
            placeholderTextColor="#a1a1aa"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {isLoading ? (
          <View style={[styles.loadingContainer, darkMode && { backgroundColor: '#18181b' }]}><ActivityIndicator size="large" color="#4f46e5" /></View>
        ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={<View style={[styles.emptyContainer, darkMode && { backgroundColor: '#18181b' }]}><Text style={[styles.emptyText, darkMode && { color: '#a1a1aa' }]}>No chats yet.</Text></View>}
          renderItem={renderChatItem}
          ItemSeparatorComponent={renderSeparator}
        />
        )}
      </View>

      {/* Gradient FAB */}
      <LinearGradient
        colors={['#4f46e5', '#06b6d4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fabGradient}
      >
        <TouchableOpacity style={styles.fabTouchable} onPress={handleNewChat} activeOpacity={0.85}>
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <Modal
        visible={isProfileModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          console.log('Profile modal closed');
          setIsProfileModalVisible(false);
        }}
      >
        <View style={[styles.modalOverlay, darkMode && { backgroundColor: 'rgba(24,24,27,0.95)' }]}>
          <View style={[styles.modalContent, darkMode && { backgroundColor: '#23232b' }]}>
            <View style={[styles.modalHeader, darkMode && { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }]}>
              <Text style={[styles.modalTitle, darkMode && { fontSize: 24, fontFamily: 'Poppins-Bold', color: '#f1f5f9' }]}>Profile Options</Text>
              <TouchableOpacity style={[styles.closeButton, darkMode && { padding: 8 }]} onPress={() => setIsProfileModalVisible(false)}>
                <Ionicons name="close" size={24} color="#f1f5f9" />
              </TouchableOpacity>
            </View>
            <View style={[styles.modalBody, darkMode && { flex: 1 }]}>
              <TouchableOpacity
                style={[styles.modalOption, darkMode && { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }]}
                onPress={handleViewProfile}
              >
                <Ionicons name="person-outline" size={24} color="#4f46e5" />
                <Text style={[styles.modalOptionText, darkMode && { color: '#f1f5f9' }]}>View Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalOption, darkMode && { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }]}
                onPress={handleViewPhoto}
              >
                <Ionicons name="image-outline" size={24} color="#4f46e5" />
                <Text style={[styles.modalOptionText, darkMode && { color: '#f1f5f9' }]}>View Photo</Text>
              </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalOption, darkMode && { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }]}
                  onPress={handleChangePhoto}
                >
                  <Ionicons name="camera-outline" size={24} color="#4f46e5" />
                  <Text style={[styles.modalOptionText, darkMode && { color: '#f1f5f9' }]}>Change Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalOption, darkMode && { borderBottomWidth: 0, justifyContent: 'center' }]}
                  onPress={() => setIsProfileModalVisible(false)}
                >
                  <Text style={[styles.modalOptionText, darkMode && { color: '#f1f5f9' }]}>Cancel</Text>
                </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isPhotoModalVisible}
        transparent={true}
        onRequestClose={() => setIsPhotoModalVisible(false)}
      >
        <View style={[styles.photoModalOverlay, darkMode && { backgroundColor: 'rgba(0,0,0,0.9)' }]}>
          <Image
            source={
              profilePhoto
                ? { uri: profilePhoto }
                : require('../assets/default-avatar.png')
            }
            style={[styles.zoomedPhoto, darkMode && { backgroundColor: '#fff' }]}
            resizeMode="contain"
          />
        </View>
        </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
    backgroundColor: 'transparent',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 1,
  },
  appTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 32,
    letterSpacing: 1,
  },
  headerIconsContainer: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { paddingLeft: 16 },
  profilePhoto: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9' },
  messagesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginTop: 16, marginBottom: 8 },
  messagesTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 18, color: '#1a1a1a' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginHorizontal: 24,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#1a1a1a',
    paddingVertical: 12,
    marginLeft: 12,
    backgroundColor: 'transparent',
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  emptyText: { fontFamily: 'Poppins-Regular', fontSize: 16, color: '#64748b' },
  floatingActionButton: { position: 'absolute', bottom: 30, right: 24, width: 60, height: 60, borderRadius: 30, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    width: '100%',
    minHeight: 250,
    maxHeight: '60%',
    overflow: 'visible',
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
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  profilePhotoButton: {
    marginRight: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    borderRadius: 12,
    marginHorizontal: 0,
    marginBottom: 0,
    shadowColor: 'transparent',
    elevation: 0,
    minHeight: 56,
  },
  avatarPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  avatarInitial: {
    color: '#fff',
    fontFamily: 'Poppins-Bold',
    fontSize: 20,
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 2,
  },
  lastMessage: {
    fontFamily: 'Poppins-Regular',
    fontSize: 13,
    color: '#64748b',
  },
  timestamp: {
    fontFamily: 'Poppins-Regular',
    fontSize: 11,
    color: '#a1a1aa',
    alignSelf: 'flex-start',
    paddingTop: 0,
    marginLeft: 8,
  },
  chatSeparator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginLeft: 68,
  },
  photoModalOverlay: {
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
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 0,
  },
  fabGradient: {
    position: 'absolute',
    bottom: 30,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    zIndex: 2,
  },
  fabTouchable: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
