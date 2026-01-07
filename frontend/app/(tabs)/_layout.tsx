import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { UserRole } from '../../src/types';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function TabsLayout() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  if (!isAuthenticated) {
    router.replace('/');
    return null;
  }

  const isAdmin = user?.role === UserRole.ADMIN;
  const isTeacher = user?.role === UserRole.TEACHER;
  const isStudent = user?.role === UserRole.STUDENT;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4A90D9',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginBottom: 4,
        },
        headerStyle: {
          backgroundColor: '#4A90D9',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerRight: () => (
          <TouchableOpacity 
            onPress={logout} 
            style={{ marginRight: 16 }}
          >
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: 'Accademia de "I Musici"',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Utenti',
          headerTitle: 'Anagrafica Utenti',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
          href: isAdmin ? '/users' : null,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'Corsi',
          headerTitle: 'Corsi e Lezioni',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="school" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Pagamenti',
          headerTitle: 'Pagamenti',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Avvisi',
          headerTitle: 'Notifiche',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});
