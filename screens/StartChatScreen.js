import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../supabase/supabaseClient';

export default function StartChatScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
  });

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (user) {
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error('Error fetching current user:', error.message);
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, profile_photo')
        .neq('id', currentUserId)
        .ilike('username', `%${query}%`)
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error.message);
      Alert.alert('Error', 'Failed to search users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = async (user) => {
    try {
      // Check if chat already exists
      const { data: existingChat, error: checkError } = await supabase
        .from('chats')
        .select('id')
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingChat) {
        // Navigate to existing chat
        navigation.navigate('ChatScreen', {
          chatId: existingChat.id,
          contactId: user.id,
          contactName: user.username,
        });
        return;
      }

      // Create new chat
      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert([
          {
            user1_id: currentUserId,
            user2_id: user.id,
            last_message: '',
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (createError) throw createError;

      // Navigate to new chat
      navigation.navigate('ChatScreen', {
        chatId: newChat.id,
        contactId: user.id,
        contactName: user.username,
      });
    } catch (error) {
      console.error('Error creating chat:', error.message);
      Alert.alert('Error', 'Failed to create chat');
    }
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserSelect(item)}
    >
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#64748b" />
    </TouchableOpacity>
  );

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Chat</Text>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={24} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              searchUsers(text);
            }}
            placeholder="Search users..."
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
          />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4f46e5" />
          </View>
        ) : (
          <FlatList
            data={searchResults}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.resultsList}
            ListEmptyComponent={
              searchQuery ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No users found</Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1a1a1a',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
  },
  resultsList: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#1a1a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#64748b',
  },
});
