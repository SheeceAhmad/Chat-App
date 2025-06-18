import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
  Video,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import supabase from '../supabase/supabaseClient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer'; // For file upload
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import NotificationService from '../services/NotificationService';
import * as DocumentPicker from 'expo-document-picker';

const AudioPlayer = ({ uri }) => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playSound = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
      return;
    }
    const { sound: newSound } = await Audio.Sound.createAsync({ uri });
    setSound(newSound);
    setIsPlaying(true);
    await newSound.playAsync();
    newSound.setOnPlaybackStatusUpdate(status => {
      if (!status.isPlaying) {
        setIsPlaying(false);
        setSound(null);
      }
    });
  };

  return (
    <TouchableOpacity onPress={playSound} style={{ marginTop: 8 }}>
      <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#4f46e5" />
    </TouchableOpacity>
  );
};

export default function ChatScreen({ route, navigation }) {
  const { chatId, contactId, contactName } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef(null);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [contactPhoto, setContactPhoto] = useState(null);

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
  });

  useEffect(() => {
    navigation.setOptions({
      title: contactName,
      headerTitleStyle: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 18,
      },
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerPhotoButton}
          onPress={() => {
            if (contactPhoto) {
              navigation.navigate('PhotoViewer', { photo: contactPhoto });
            }
          }}
        >
          <Image
            source={
              contactPhoto
                ? { uri: contactPhoto }
                : require('../assets/default-avatar.png')
            }
            style={styles.headerPhoto}
          />
        </TouchableOpacity>
      ),
    });
    fetchCurrentUser();
    fetchContactPhoto();
    setupNotifications();
  }, [contactName]);

  useEffect(() => {
    if (currentUserId) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [currentUserId]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (user) {
        setCurrentUserId(user.id);
      }
    } catch (error) {
      console.error('Error fetching current user:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select(`
          id,
          chat_id,
          sender_id,
          text,
          created_at
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      // Fetch all unique sender_ids
      const senderIds = Array.from(new Set((messagesData || []).map(m => m.sender_id)));
      let usersMap = {};
      if (senderIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, username')
          .in('id', senderIds);
        if (!usersError && users) {
          usersMap = Object.fromEntries(users.map(u => [u.id, u.username]));
        }
      }
      // Attach username to each message
      const messagesWithUsernames = (messagesData || []).map(m => ({ ...m, username: usersMap[m.sender_id] || 'Unknown' }));
      setMessages(messagesWithUsernames);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error('Error fetching messages:', error.message);
    }
  };

  const fetchContactPhoto = async () => {
    try {
      // First try to get the user's data
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', contactId)
        .single();

      if (error) {
        console.error('Error fetching contact data:', error.message);
        return;
      }

      // If we have data and it has a profile_photo, use it
      if (data?.profile_photo) {
        setContactPhoto(data.profile_photo);
      } else {
        // If no profile photo, use default avatar
        setContactPhoto(null);
      }
    } catch (error) {
      console.error('Error fetching contact photo:', error.message);
      // On error, just use default avatar
      setContactPhoto(null);
    }
  };

  const setupNotifications = async () => {
    try {
      const token = await NotificationService.registerForPushNotifications();
      if (token && currentUserId) {
        await NotificationService.savePushToken(currentUserId, token);
      }
    } catch (error) {
      console.log('Push notifications not available:', error.message);
      // Continue without push notifications
    }
  };

  const subscribeToMessages = () => {
    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`,
      }, async (payload) => {
        // Fetch the new message and its username
        const { data: newMessage, error } = await supabase
          .from('messages')
          .select(`
            id,
            chat_id,
            sender_id,
            text,
            created_at
          `)
          .eq('id', payload.new.id)
          .single();
        let username = 'Unknown';
        if (newMessage) {
          const { data: user, error: userError } = await supabase
            .from('users')
            .select('username')
            .eq('id', newMessage.sender_id)
            .single();
          if (!userError && user) {
            username = user.username;
          }
        }
        if (!error && newMessage) {
          setMessages(current => {
            const updated = [...current, { ...newMessage, username }];
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
            return updated;
          });

          // Send push notification if the message is from the other user
          if (newMessage.sender_id !== currentUserId) {
            const recipientToken = await NotificationService.getRecipientPushToken(currentUserId);
            if (recipientToken) {
              const notificationTitle = username;
              const notificationBody = newMessage.text || '[Media]';
              await NotificationService.sendPushNotification(
                recipientToken,
                notificationTitle,
                notificationBody,
                {
                  chatId,
                  messageId: newMessage.id,
                  type: 'message'
                }
              );
            }
          }
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const sendMessage = async (text = newMessage.trim(), attachments = []) => {
    if (!text && attachments.length === 0) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          chat_id: chatId,
          sender_id: currentUserId,
          text,
          attachments: attachments.length > 0 ? attachments : null,
          created_at: new Date().toISOString(),
        }]);

      if (error) throw error;

      // Update last_message in chats table
      await supabase
        .from('chats')
        .update({
          last_message: text || (attachments.length > 0 ? '[Media]' : ''),
        })
        .eq('id', chatId);

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error.message);
    }
  };

  const pickAndUploadMedia = async (mediaType) => {
    console.log('Starting media upload for type:', mediaType);
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Permission result:', permissionResult);
      
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Please allow access to your media library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType === 'image' 
          ? ImagePicker.MediaTypeOptions.Images 
          : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsLoading(true);
        const asset = result.assets[0];
        const fileExtension = mediaType === 'image' ? 'jpg' : 'mp4';
        const fileName = `${Date.now()}_${asset.fileName || `media.${fileExtension}`}`;
        const filePath = `chat-media/${chatId}/${fileName}`;
        const contentType = mediaType === 'image' ? 'image/jpeg' : 'video/mp4';

        console.log('Uploading to path:', filePath);

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from('chat-media')
          .upload(filePath, decode(asset.base64), {
            contentType,
            upsert: true,
          });

        if (error) {
          console.error('Upload error:', error);
          Alert.alert('Upload failed', error.message);
          return;
        }

        console.log('Upload successful, getting public URL');

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('chat-media')
          .getPublicUrl(filePath);

        console.log('Public URL obtained:', publicUrl);

        // Send message with media attachment
        await sendMessage('', [{
          url: publicUrl,
          type: mediaType,
          name: fileName,
          size: asset.fileSize,
          duration: asset.duration,
        }]);

        console.log('Message sent with media attachment');
      }
    } catch (error) {
      console.error('Media upload error:', error);
      Alert.alert('Error', 'Failed to upload media');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please allow microphone access.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    // Upload to Supabase Storage
    const fileName = `${Date.now()}_voice.m4a`;
    const filePath = `chat-media/${chatId}/${fileName}`;
    const fileData = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

    const { data, error } = await supabase.storage
      .from('chat-media')
      .upload(filePath, decode(fileData), {
        contentType: 'audio/m4a',
        upsert: true,
      });

    if (error) {
      Alert.alert('Upload failed', error.message);
      return;
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('chat-media')
      .getPublicUrl(filePath);

    // Send message with audio attachment
    await sendMessage('', [{ url: publicUrlData.publicUrl, type: 'audio', name: fileName }]);
  };

  const pickAndUploadFile = async () => {
    console.log('Starting file upload');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      console.log('Document picker result:', result);

      if (result.canceled) {
        console.log('Document picker cancelled');
        return;
      }

      const file = result.assets[0];
      setIsLoading(true);

      console.log('Reading file as base64');

      // Read file as base64
      const fileData = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `chat-media/${chatId}/${fileName}`;

      console.log('Uploading to path:', filePath);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('chat-media')
        .upload(filePath, decode(fileData), {
          contentType: file.mimeType,
          upsert: true,
        });

      if (error) {
        console.error('File upload error:', error);
        Alert.alert('Upload failed', error.message);
        return;
      }

      console.log('Upload successful, getting public URL');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      console.log('Public URL obtained:', publicUrl);

      // Send message with file attachment
      await sendMessage('', [{
        url: publicUrl,
        type: 'file',
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
      }]);

      console.log('Message sent with file attachment');
    } catch (error) {
      console.error('File upload error:', error);
      Alert.alert('Error', 'Failed to upload file');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isOwnMessage = item.sender_id === currentUserId;
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessage : styles.otherMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
        ]}>
          {item.text ? (
            <Text style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText
            ]}>
              {item.text}
            </Text>
          ) : null}
          <Text style={styles.messageTime}>
            {item.username} · {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!fontsLoaded || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start the conversation!</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={[styles.attachButton, { padding: 8 }]}
            onPress={() => {
              console.log('Attachment button pressed');
              Alert.alert(
                'Choose Attachment',
                'Select attachment type',
                [
                  {
                    text: 'Image',
                    onPress: () => {
                      console.log('Image option selected');
                      pickAndUploadMedia('image');
                    },
                  },
                  {
                    text: 'Video',
                    onPress: () => {
                      console.log('Video option selected');
                      pickAndUploadMedia('video');
                    },
                  },
                  {
                    text: 'File',
                    onPress: () => {
                      console.log('File option selected');
                      pickAndUploadFile();
                    },
                  },
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => console.log('Attachment cancelled'),
                  },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="attach" size={24} color="#4f46e5" />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={1000}
          />
          
          <TouchableOpacity
            onPressIn={startRecording}
            onPressOut={stopRecording}
            style={styles.voiceButton}
          >
            <Ionicons name={isRecording ? 'mic' : 'mic-outline'} size={24} color={isRecording ? '#e11d48' : '#4f46e5'} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              !newMessage.trim() && styles.sendButtonDisabled
            ]}
            onPress={() => sendMessage()}
            disabled={!newMessage.trim()}
          >
            <Ionicons
              name="send"
              size={24}
              color={newMessage.trim() ? '#4f46e5' : '#94a3b8'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#64748b',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 20,
    maxWidth: '100%',
  },
  ownMessageBubble: {
    backgroundColor: '#4f46e5',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#1a1a1a',
  },
  messageTime: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#94a3b8',
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#64748b',
  },
  attachButton: {
    marginRight: 8,
  },
  voiceButton: {
    marginLeft: 8,
    marginRight: 8,
  },
  headerPhotoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 16,
  },
  headerPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginTop: 8,
  },
  videoContainer: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  messageVideo: {
    width: '100%',
    height: '100%',
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    maxWidth: 250,
  },
  fileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#1a1a1a',
  },
  fileSize: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#64748b',
    marginTop: 2,
  },
});
