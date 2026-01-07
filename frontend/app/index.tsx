import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Image,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { router } from 'expo-router';
import { UserRole } from '../src/types';

export default function LandingPage() {
  const { user, isLoading, isAuthenticated, login } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, user]);

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

        {/* Login Section */}
        <View style={styles.loginSection}>
          <TouchableOpacity style={styles.loginButton} onPress={login}>
            <Ionicons name="logo-google" size={22} color="#fff" />
            <Text style={styles.loginButtonText}>Accedi con Google</Text>
          </TouchableOpacity>
          
          <Text style={styles.loginHint}>
            Accedi per visualizzare la tua dashboard personalizzata
          </Text>
        </View>

        {/* Roles Info */}
        <View style={styles.rolesSection}>
          <Text style={styles.rolesSectionTitle}>Aree Dedicate</Text>
          
          <View style={styles.roleCard}>
            <Ionicons name="shield-checkmark" size={24} color="#4A90D9" />
            <View style={styles.roleInfo}>
              <Text style={styles.roleTitle}>Amministratore</Text>
              <Text style={styles.roleDesc}>Gestione completa di utenti, corsi, lezioni e pagamenti</Text>
            </View>
          </View>
          
          <View style={styles.roleCard}>
            <Ionicons name="person" size={24} color="#10B981" />
            <View style={styles.roleInfo}>
              <Text style={styles.roleTitle}>Studente</Text>
              <Text style={styles.roleDesc}>Visualizza i tuoi corsi, lezioni e pagamenti</Text>
            </View>
          </View>
          
          <View style={styles.roleCard}>
            <Ionicons name="school" size={24} color="#F59E0B" />
            <View style={styles.roleInfo}>
              <Text style={styles.roleTitle}>Insegnante</Text>
              <Text style={styles.roleDesc}>Gestisci le tue lezioni e monitora i compensi</Text>
            </View>
          </View>
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
    paddingBottom: 20,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '300',
    color: '#333',
  },
  titleHighlight: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4A90D9',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 8,
  },
  featuresSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  featureDesc: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
  loginSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A90D9',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  loginHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 12,
    textAlign: 'center',
  },
  rolesSection: {
    marginTop: 30,
  },
  rolesSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 14,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  roleInfo: {
    flex: 1,
    marginLeft: 14,
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  roleDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
