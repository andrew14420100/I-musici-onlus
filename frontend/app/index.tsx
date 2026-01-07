import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { router } from 'expo-router';

export default function LandingPage() {
  const { user, isLoading, isAuthenticated, login, selectedRole, setSelectedRole } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, user]);

  const handleLogin = (role: string) => {
    setSelectedRole(role);
    login(role);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="musical-notes" size={48} color="#4A90D9" />
          </View>
          <Text style={styles.title}>Accademia de</Text>
          <Text style={styles.titleHighlight}>"I Musici"</Text>
          <Text style={styles.subtitle}>La tua accademia musicale digitale</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Gestisci tutto in un'unica app</Text>
          
          <View style={styles.featureRow}>
            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: '#EBF5FF' }]}>
                <Ionicons name="school" size={28} color="#4A90D9" />
              </View>
              <Text style={styles.featureTitle}>Corsi</Text>
              <Text style={styles.featureDesc}>Gestisci e segui i corsi musicali</Text>
            </View>
            
            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="calendar" size={28} color="#10B981" />
              </View>
              <Text style={styles.featureTitle}>Lezioni</Text>
              <Text style={styles.featureDesc}>Programma e visualizza le lezioni</Text>
            </View>
          </View>
          
          <View style={styles.featureRow}>
            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="card" size={28} color="#F59E0B" />
              </View>
              <Text style={styles.featureTitle}>Pagamenti</Text>
              <Text style={styles.featureDesc}>Monitora quote e compensi</Text>
            </View>
            
            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: '#FCE7F3' }]}>
                <Ionicons name="notifications" size={28} color="#EC4899" />
              </View>
              <Text style={styles.featureTitle}>Notifiche</Text>
              <Text style={styles.featureDesc}>Resta sempre aggiornato</Text>
            </View>
          </View>
        </View>

        {/* Login Section with Role Selection */}
        <View style={styles.loginSection}>
          <Text style={styles.loginTitle}>Accedi come:</Text>
          
          {/* Admin Login */}
          <TouchableOpacity 
            style={[styles.roleLoginButton, styles.adminButton]} 
            onPress={() => handleLogin('admin')}
          >
            <View style={styles.roleLoginContent}>
              <View style={[styles.roleLoginIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="shield-checkmark" size={24} color="#fff" />
              </View>
              <View style={styles.roleLoginText}>
                <Text style={styles.roleLoginTitle}>Amministratore</Text>
                <Text style={styles.roleLoginDesc}>Gestione completa dell'accademia</Text>
              </View>
            </View>
            <View style={styles.googleBadge}>
              <Ionicons name="logo-google" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          
          {/* Student Login */}
          <TouchableOpacity 
            style={[styles.roleLoginButton, styles.studentButton]} 
            onPress={() => handleLogin('studente')}
          >
            <View style={styles.roleLoginContent}>
              <View style={[styles.roleLoginIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View style={styles.roleLoginText}>
                <Text style={styles.roleLoginTitle}>Studente</Text>
                <Text style={styles.roleLoginDesc}>Visualizza corsi, lezioni e pagamenti</Text>
              </View>
            </View>
            <View style={styles.googleBadge}>
              <Ionicons name="logo-google" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          
          {/* Teacher Login */}
          <TouchableOpacity 
            style={[styles.roleLoginButton, styles.teacherButton]} 
            onPress={() => handleLogin('insegnante')}
          >
            <View style={styles.roleLoginContent}>
              <View style={[styles.roleLoginIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="school" size={24} color="#fff" />
              </View>
              <View style={styles.roleLoginText}>
                <Text style={styles.roleLoginTitle}>Insegnante</Text>
                <Text style={styles.roleLoginDesc}>Gestisci lezioni e monitora compensi</Text>
              </View>
            </View>
            <View style={styles.googleBadge}>
              <Ionicons name="logo-google" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.loginHint}>
            Seleziona il tuo ruolo e accedi con il tuo account Google
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 Accademia de "I Musici"</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 16,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '300',
    color: '#333',
  },
  titleHighlight: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4A90D9',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
  },
  featuresSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  featureDesc: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
    marginTop: 2,
  },
  loginSection: {
    marginTop: 24,
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  roleLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  adminButton: {
    backgroundColor: '#4A90D9',
  },
  studentButton: {
    backgroundColor: '#10B981',
  },
  teacherButton: {
    backgroundColor: '#F59E0B',
  },
  roleLoginContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roleLoginIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roleLoginText: {
    flex: 1,
  },
  roleLoginTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  roleLoginDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  googleBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
});
