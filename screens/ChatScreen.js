import React, { useState, useEffect, useRef, useContext } from 'react';
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
  findNodeHandle,
  Keyboard,
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
import { ThemeContext } from '../context/ThemeContext';
import { useHeaderHeight } from '@react-navigation/elements';

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
  const headerHeight = useHeaderHeight();
  const { chatId, contactId, contactName } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const flatListRef = useRef(null);
  const scrollViewRef = useRef(null);
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [contactPhoto, setContactPhoto] = useState(null);
  const { darkMode } = useContext(ThemeContext);
  const [isTyping, setIsTyping] = useState(false);
  const [showRecordingUI, setShowRecordingUI] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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
    messageText: {
      color: darkMode ? '#f1f5f9' : '#1a1a1a',
    },
    // ...add more dynamic styles as needed for text, backgrounds, etc...
  };

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

      const subscription = supabase
        .channel(`messages-for-chat-${chatId}`)
        .on('postgres_changes', {
          event: '*', // Listen for both INSERT and UPDATE
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        }, async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data: newMessage, error } = await supabase
              .from('messages')
              .select(`id, chat_id, sender_id, text, created_at, attachment_url, attachment_type, attachment_metadata, status`)
              .eq('id', payload.new.id)
              .single();

            if (newMessage) {
              let username = 'Unknown';
              const { data: user, error: userError } = await supabase
                .from('users')
                .select('username')
                .eq('id', newMessage.sender_id)
                .single();
              if (!userError && user) {
                username = user.username;
              }
              setMessages(prevMessages => [...prevMessages, { ...newMessage, username }]);

              if (newMessage.sender_id !== currentUserId) {
                console.log('Marking message as delivered:', newMessage.id);
                const { data: deliveredUpdate, error: deliveredError } = await supabase.from('messages').update({ status: 'delivered' }).eq('id', newMessage.id);
                console.log('Delivered update result:', deliveredUpdate, deliveredError);
                fetchMessages();
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            console.log('Received UPDATE event:', payload);
            setMessages(prevMessages => prevMessages.map(msg =>
              msg.id === payload.new.id ? { ...msg, status: payload.new.status } : msg
            ));
          }
        })
        .subscribe();

      // On chat open, mark all received messages as read
      (async () => {
        const { data: updated, error } = await supabase.from('messages').update({ status: 'read' })
          .eq('chat_id', chatId)
          .neq('sender_id', currentUserId);
        console.log('Mark as read update result:', updated, error);
        if (!error) {
          console.log('Marked messages as read:', updated);
          fetchMessages();
          setTimeout(fetchMessages, 1000); // Fallback: force fetch after 1s in case real-time fails
        } else {
          console.log('Error marking messages as read:', error);
        }
      })();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [currentUserId, chatId]);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    // Cleanup function to remove listeners
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
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
          created_at,
          attachment_url,
          attachment_type,
          attachment_metadata,
          status
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
      // Log all message statuses
      console.log('Fetched messages:', messagesWithUsernames.map(m => ({ id: m.id, status: m.status, text: m.text })));
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

  const sendMessage = async (text = newMessage.trim(), attachments = []) => {
    if (!text && attachments.length === 0) return;

    const messageData = {
      chat_id: chatId,
      sender_id: currentUserId,
      text: text,
      status: 'sent',
      ...(attachments.length > 0 && {
        attachment_url: attachments[0].url,
        attachment_type: attachments[0].type,
        attachment_metadata: attachments[0].metadata,
      }),
    };

    console.log('Attempting to insert message:', messageData);

    const { error } = await supabase.from('messages').insert([messageData]);

    if (error) {
      console.error('Error sending message:', error.message);
      Alert.alert('Error', 'Could not send message.');
    } else {
      await supabase.from('chats').update({
        last_message: text,
        updated_at: new Date().toISOString(),
      }).eq('id', chatId);
      setNewMessage('');
    }
  };

  const pickAndUploadMedia = async (mediaType) => {
    // 1. Request Permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    // 2. Launch Picker
    let result;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType === 'image' ? ImagePicker.MediaType.IMAGE : ImagePicker.MediaType.VIDEO,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
    } catch (pickerError) {
      console.error("ImagePicker Error:", pickerError);
      Alert.alert("Error", "Could not open the media library.");
      return;
    }

    // 3. Handle Result
    if (result.canceled) {
      return;
    }

    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `${currentUserId}_${Date.now()}.${asset.uri.split('.').pop()}`;
      const filePath = `chat_attachments/${chatId}/${fileName}`;
      const fileType = asset.type || 'application/octet-stream';

      // 4. Upload to Supabase
      try {
        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(filePath, decode(asset.base64), {
            contentType: fileType,
            upsert: true,
          });

        if (uploadError) {
          throw uploadError;
        }

        // 5. Get Public URL and Send Message
        const { data: { publicUrl } } = supabase.storage
          .from('chat-media')
          .getPublicUrl(filePath);

        const attachment = [{
          url: publicUrl,
          type: mediaType,
          metadata: {
            name: fileName,
            size: asset.fileSize,
            type: fileType,
          },
        }];

        sendMessage(`[${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}]`, attachment);
      } catch (error) {
        console.error('Upload failed:', error.message);
        Alert.alert('Upload Error', 'Failed to upload the file. Please check your connection and try again.');
      }
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'You need to grant microphone access to record audio.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
         Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setShowRecordingUI(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      return;
    }

    setIsRecording(false);
    setShowRecordingUI(false);
    
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      const fileName = `voice-note-${Date.now()}.m4a`;
      const filePath = `chat-media/${chatId}/${fileName}`;
      
      const fileContent = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, decode(fileContent), {
          contentType: 'audio/m4a',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      await sendMessage('[Voice Note]', [{
        url: publicUrl,
        type: 'audio',
        metadata: { name: fileName, size: 0, type: 'audio/m4a' }
      }]);

    } catch (error) {
      console.error('Failed to stop or upload recording', error);
      Alert.alert('Error', 'Could not save the voice note.');
    } finally {
      setRecording(undefined);
    }
  };

  const pickAndUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Allow all file types
      });

      if (result.canceled) {
        return;
      }
      
      if (result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const fileContent = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
          const filePath = `chat_attachments/${chatId}/${asset.name}`;

          const { error: uploadError } = await supabase.storage
              .from('chat-media')
              .upload(filePath, decode(fileContent), {
                  contentType: asset.mimeType,
                  upsert: true
              });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
              .from('chat-media')
              .getPublicUrl(filePath);

          const attachment = [{
              url: publicUrl,
              type: 'file',
              metadata: {
                  name: asset.name,
                  size: asset.size,
                  type: asset.mimeType,
              },
          }];
          sendMessage(`[File] ${asset.name}`, attachment);
      }
    } catch (error) {
      console.error('File picking/upload failed:', error.message);
      Alert.alert('Error', 'Could not attach the file.');
    }
  };

  const takeAndUploadPhoto = async () => {
    console.log('1. Starting takeAndUploadPhoto...');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Sorry, we need camera permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled) {
      console.log('2. User cancelled camera.');
      return;
    }
    console.log('2. Photo taken successfully.');

    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const fileName = `photo_${Date.now()}.jpg`;
      const filePath = `chat-media/${chatId}/${fileName}`;

      try {
        console.log('3. Uploading to Supabase at path:', filePath);
        const { error: uploadError } = await supabase.storage
          .from('chat-media')
          .upload(filePath, decode(asset.base64), { contentType: 'image/jpeg', upsert: true });

        if (uploadError) throw uploadError;
        console.log('4. Upload successful.');

        const { data: { publicUrl } } = supabase.storage.from('chat-media').getPublicUrl(filePath);
        console.log('5. Got public URL:', publicUrl);

        const attachmentPayload = [{
          url: publicUrl,
          type: 'image',
          metadata: { name: fileName, size: asset.fileSize, type: 'image/jpeg' }
        }];
        
        console.log('6. Calling sendMessage with attachment...');
        await sendMessage('[Image]', attachmentPayload);
        console.log('7. sendMessage finished.');

      } catch (error) {
        console.error('Photo upload/send failed:', error.message);
        Alert.alert('Upload Error', 'Failed to upload and send the photo. Please check your network and Supabase policies.');
      }
    }
  };

  const handleLongPress = (message) => {
    if (message.sender_id !== currentUserId) {
      return; // Users can only delete their own messages
    }

    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: () => deleteMessage(message.id, message.attachment_url),
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const deleteMessage = async (messageId, attachmentUrl) => {
    try {
      // 1. Delete the message from the database
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (deleteError) throw deleteError;

      // 2. If there was an attachment, delete it from storage
      if (attachmentUrl) {
        const fileName = attachmentUrl.split('/').pop();
        const filePath = `chat-media/${chatId}/${fileName}`; // Reconstruct path
        await supabase.storage.from('chat-media').remove([filePath]);
      }

      // 3. Update the UI by removing the message from the state
      setMessages((currentMessages) =>
        currentMessages.filter((message) => message.id !== messageId)
      );
    } catch (error) {
      console.error('Error deleting message:', error.message);
      Alert.alert('Error', 'Failed to delete the message.');
    }
  };

  const renderMessage = ({ item }) => {
    const isOwnMessage = item.sender_id === currentUserId;
    const messageTime = new Date(item.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const renderStatusIcon = () => {
      if (!isOwnMessage) return null;
      if (item.status === 'sent') {
        return <Ionicons name="checkmark-done" size={18} color="#60a5fa" style={{ marginLeft: 4 }} />;
      } else if (item.status === 'delivered' || item.status === 'read') {
        return <Ionicons name="checkmark-done" size={18} color="#2563eb" style={{ marginLeft: 4 }} />;
      }
      return null;
    };

    const renderAttachment = () => {
      if (!item.attachment_url) return null;
      switch (item.attachment_type) {
        case 'image':
          return (
            <TouchableOpacity onPress={() => navigation.navigate('PhotoViewer', { photo: item.attachment_url })}>
              <Image
                source={{ uri: item.attachment_url }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          );
        case 'video':
          return (
            <Video
              source={{ uri: item.attachment_url }}
              style={styles.messageImage}
              useNativeControls
              resizeMode="cover"
            />
          );
        case 'file':
          return (
            <TouchableOpacity 
              style={styles.fileContainer}
              onPress={() => Linking.openURL(item.attachment_url)}
            >
              <Ionicons name="document-text-outline" size={32} color={isOwnMessage ? '#fff' : '#4f46e5'} />
              <View style={styles.fileInfo}>
                <Text style={isOwnMessage ? styles.ownMessageText : styles.otherMessageText}>
                  {item.attachment_metadata?.name || 'File'}
                </Text>
                <Text style={styles.messageTime}>
                  {formatFileSize(item.attachment_metadata?.size) || ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        case 'audio':
          return <AudioPlayer uri={item.attachment_url} />;
        default:
          return null;
      }
    };

    // If image attachment, only show the image (and any real text, but not the word 'image')
    if (item.attachment_url && item.attachment_type && item.attachment_type.startsWith('image')) {
      return (
        <TouchableOpacity onLongPress={() => handleLongPress(item)} activeOpacity={0.8}>
          <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
            <View style={[styles.messageBubble, isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble]}>
              {renderAttachment()}
              {/* Only show text if it's not empty, not 'image', and not null */}
              {item.text && item.text.trim().toLowerCase() !== 'image' && (
                <Text style={[styles.messageText, isOwnMessage ? styles.ownMessageText : styles.otherMessageText]}>{item.text}</Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                <Text style={styles.messageTime}>{messageTime}</Text>
                {renderStatusIcon()}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }
    // Otherwise, show text message
    return (
      <TouchableOpacity onLongPress={() => handleLongPress(item)} activeOpacity={0.8}>
        <View style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
          <View style={[styles.messageBubble, isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble]}>
            <Text style={[styles.messageText, isOwnMessage ? styles.ownMessageText : styles.otherMessageText]}>{item.text}</Text>
            {renderAttachment()}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: item.attachment_url ? 8 : 0 }}>
              <Text style={styles.messageTime}>{messageTime}</Text>
              {renderStatusIcon()}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Demo: Show typing indicator for 3s when user types
  const handleInputChange = (text) => {
    setNewMessage(text);
    setIsTyping(true);
    if (handleInputChange.typingTimeout) clearTimeout(handleInputChange.typingTimeout);
    handleInputChange.typingTimeout = setTimeout(() => setIsTyping(false), 3000);
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
    <View style={[dynamicStyles.container, { paddingBottom: keyboardHeight }]}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingVertical: 10, flexGrow: 1, justifyContent: 'flex-end' }}
        ListEmptyComponent={
          !isLoading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Be the first to say hello!</Text>
            </View>
          )
        }
      />

      <View>
        {showRecordingUI ? (
          <View style={styles.recordingIndicator}>
            <View style={styles.redDot} />
            <Text style={styles.recordingText}>Recording...</Text>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TouchableOpacity onPress={() => {/*TODO: Open emoji keyboard*/}}>
              <Ionicons name="happy-outline" size={28} color="#8A8A8A" style={styles.iconButton} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              value={newMessage}
              onChangeText={handleInputChange}
              placeholder="Message..."
              placeholderTextColor="#8A8A8A"
              multiline
            />
            <TouchableOpacity onPress={() => { /* Re-use existing attachment logic */
              Alert.alert(
                'Attach Media',
                'What would you like to attach?',
                [
                  { text: 'Choose from Library', onPress: () => pickAndUploadMedia('image') },
                  { text: 'Take Photo', onPress: takeAndUploadPhoto },
                  { text: 'Choose Video', onPress: () => pickAndUploadMedia('video') },
                  { text: 'Choose Document', onPress: pickAndUploadFile },
                  { text: 'Cancel', style: 'cancel' },
                ],
                { cancelable: true }
              );
            }}>
              <Ionicons name="attach" size={28} color="#8A8A8A" style={styles.iconButton} />
            </TouchableOpacity>
            {newMessage.trim().length > 0 ? (
              <TouchableOpacity
                style={styles.mainActionButton}
                onPress={() => sendMessage()}
              >
                <Ionicons name="send" size={22} color="#ffffff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPressIn={startRecording}
                onPressOut={stopRecording}
                style={styles.mainActionButton}
              >
                <Ionicons name="mic" size={24} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
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
    alignItems: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#1E1E1E', // Dark background for the bar
    borderTopWidth: 1,
    borderTopColor: '#2F2F2F',
  },
  input: {
    flex: 1,
    backgroundColor: '#2C2C2C', // Darker input field
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    paddingTop: 8, // Explicitly set paddingTop for multiline consistency
    marginHorizontal: 8,
    fontSize: 16,
    color: '#FFFFFF',
    maxHeight: 120, // Allow for multiple lines but not infinite growth
  },
  iconButton: {
    padding: 5,
    paddingBottom: 8, // Align with text input bottom
  },
  mainActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00A884', // WhatsApp green
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 5,
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
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    marginTop: 8,
  },
  fileInfo: {
    marginLeft: 10,
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
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'red',
    marginRight: 10,
  },
  recordingText: {
    fontFamily: 'Poppins-Regular',
    color: '#1a1a1a',
  },
});
