import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';

export default function SettingsScreen() {
  const { darkMode, setDarkMode, userId } = useContext(ThemeContext);
  const [loading, setLoading] = useState(false);

  const handleSetDarkMode = async (value) => {
    console.log('=== SETTINGS TOGGLE ===');
    console.log('handleSetDarkMode called with:', value);
    console.log('Current darkMode:', darkMode);
    console.log('userId:', userId);
    
    if (loading) {
      console.log('Already loading, ignoring toggle');
      return;
    }
    
    if (darkMode === value) {
      console.log('Already in this mode, ignoring toggle');
      return;
    }
    
    if (!userId) {
      console.log('No userId, cannot toggle');
      return;
    }
    
    setLoading(true);
    console.log('Calling setDarkMode with:', value);
    await setDarkMode(value);
    setLoading(false);
    console.log('Toggle completed');
  };
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: darkMode ? '#18181b' : '#f8fafc' }]}> 
      <Text style={[styles.header, { color: darkMode ? '#fff' : '#1a1a1a' }]}>Settings</Text>
      <Text style={[styles.sectionTitle, { color: darkMode ? '#a1a1aa' : '#64748b' }]}>Theme</Text>
      <View style={[styles.themeBlock, { backgroundColor: darkMode ? '#23232b' : '#fff' }]}> 
        <TouchableOpacity
          style={[styles.themeOption, !darkMode && styles.selectedOption]}
          onPress={() => handleSetDarkMode(false)}
          disabled={loading}
        >
          <Ionicons name="sunny-outline" size={22} color={!darkMode ? '#4f46e5' : '#a1a1aa'} style={styles.icon} />
          <Text style={[styles.optionText, { color: !darkMode ? '#4f46e5' : '#a1a1aa' }]}>Light</Text>
          <View style={[styles.radioCircle, { borderColor: !darkMode ? '#4f46e5' : '#a1a1aa' }]}> 
            {!darkMode && <View style={[styles.radioDot, { backgroundColor: '#4f46e5' }]} />}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.themeOption, darkMode && styles.selectedOption]}
          onPress={() => handleSetDarkMode(true)}
          disabled={loading}
        >
          <Ionicons name="moon-outline" size={22} color={darkMode ? '#4f46e5' : '#a1a1aa'} style={styles.icon} />
          <Text style={[styles.optionText, { color: darkMode ? '#4f46e5' : '#a1a1aa' }]}>Dark</Text>
          <View style={[styles.radioCircle, { borderColor: darkMode ? '#4f46e5' : '#a1a1aa' }]}> 
            {darkMode && <View style={[styles.radioDot, { backgroundColor: '#4f46e5' }]} />}
          </View>
        </TouchableOpacity>
        {loading && <ActivityIndicator style={{ marginTop: 12 }} color={darkMode ? '#fff' : '#4f46e5'} />}
        <Text style={{ marginTop: 12, fontSize: 12, color: darkMode ? '#a1a1aa' : '#64748b', textAlign: 'center' }}>
          Current: {darkMode ? 'Dark' : 'Light'} | UserID: {userId ? 'Yes' : 'No'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { fontFamily: 'Poppins-Bold', fontSize: 28, marginTop: 32, marginLeft: 24, marginBottom: 24 },
  sectionTitle: { fontFamily: 'Poppins-SemiBold', fontSize: 14, marginLeft: 24, marginBottom: 12, textTransform: 'uppercase' },
  themeBlock: { borderRadius: 12, marginHorizontal: 16, paddingVertical: 8, marginBottom: 32 },
  themeOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  selectedOption: { backgroundColor: 'rgba(79,70,229,0.08)' },
  icon: { marginRight: 16 },
  optionText: { fontFamily: 'Poppins-Medium', fontSize: 16, flex: 1 },
  radioCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
});