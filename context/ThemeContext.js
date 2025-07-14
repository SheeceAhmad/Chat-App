import React, { createContext, useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import supabase from '../supabase/supabaseClient';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [darkMode, setDarkModeState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const isToggling = useRef(false);

  // Fetch current user and their dark_mode preference
  useEffect(() => {
    let retryCount = 0;
    const fetchUserAndTheme = async () => {
      try {
        const { data: { user }, error: userFetchError } = await supabase.auth.getUser();
        if (userFetchError) {
          console.log('Error fetching user:', userFetchError);
          Alert.alert('Auth Error', 'Could not fetch user.');
        }
        if (user) {
          setUserId(user.id);
          console.log('Fetched user:', user.id);
          const { data, error: userError } = await supabase
            .from('users')
            .select('dark_mode')
            .eq('id', user.id)
            .single();
          if (userError) {
            console.log('Error fetching user theme:', userError);
            Alert.alert('Theme Error', 'Could not fetch theme preference.');
          } else if (data) {
            console.log('Fetched dark_mode from DB:', data.dark_mode);
            setDarkModeState(!!data.dark_mode);
          }
        } else {
          console.log('No user found. Retrying...');
          if (retryCount < 3) {
            retryCount++;
            setTimeout(fetchUserAndTheme, 1000);
          }
        }
      } catch (err) {
        console.log('Unexpected error in fetchUserAndTheme:', err);
        Alert.alert('Error', 'Unexpected error fetching user/theme.');
      }
      setLoading(false);
    };
    fetchUserAndTheme();
  }, []);

  // Real-time subscription to dark_mode changes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('public:users:theme')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${userId}`,
      }, (payload) => {
        console.log('Realtime update payload:', payload);
        if (isToggling.current) {
          isToggling.current = false;
          return;
        }
        if (payload.new && typeof payload.new.dark_mode === 'boolean') {
          console.log('Realtime: setting darkMode to', payload.new.dark_mode);
          setDarkModeState(payload.new.dark_mode);
        }
      })
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  // Set dark mode and update in DB
  const setDarkMode = async (value) => {
    console.log('=== DARK MODE TOGGLE ===');
    console.log('setDarkMode called with value:', value, 'userId:', userId);
    console.log('Current darkMode state before:', darkMode);
    if (!userId) {
      console.log('setDarkMode called but no userId!');
      Alert.alert('Error', 'No user found. Please log in again.');
      return;
    }
    isToggling.current = true;
    setDarkModeState(value); // Optimistic update
    console.log('DarkMode state updated to:', value);
    // Update in database
    console.log('Updating DB with dark_mode:', value);
    const { error } = await supabase
      .from('users')
      .update({ dark_mode: value })
      .eq('id', userId);
    if (error) {
      isToggling.current = false;
      setDarkModeState(!value); // Roll back
      console.log('Error updating dark_mode in DB:', error);
      Alert.alert('Sync Error', 'Could not save your theme preference.');
    } else {
      console.log('Successfully updated dark_mode in DB to', value);
      console.log('Final darkMode state:', value);
    }
  };

  if (loading || !userId) return <></>;

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode, userId }}>
      {children}
    </ThemeContext.Provider>
  );
}; 