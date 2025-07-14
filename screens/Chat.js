import React, { useEffect, useState } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native';
import supabase from '../supabase/supabaseClient';

export default function MainScreen({ navigation }) {
  const [contacts, setContacts] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  const fetchCurrentUser = async () => {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (user) {
      setCurrentUserId(user.id);
      fetchContacts(user.id);
    }
  };

  const fetchContacts = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email')
      .neq('id', userId); 

    if (error) {
      console.error('Error fetching contacts:', error.message);
    } else {
      setContacts(data);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const handleChatPress = (contact) => {
    navigation.navigate('ChatScreen', {
      contactId: contact.id,
      contactName: contact.username,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chats</Text>
      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => handleChatPress(item)}
          >
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.email}>{item.email}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#1e1e2f',
    flex: 1,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  contactItem: {
    backgroundColor: '#2a2a40',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  username: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  email: {
    color: '#aaa',
    fontSize: 12,
  },
});
