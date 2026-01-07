import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { router } from 'expo-router';
import { INSTRUMENTS } from '../src/types';

export default function LandingPage() {
  const { user, isLoading, isAuthenticated, login, setSelectedRole, setSelectedInstrument } = useAuth();
  const [showInstrumentModal, setShowInstrumentModal] = useState(false);
  const [pendingRole, setPendingRole] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, user]);

  const handleRoleSelect = (role: string) => {
    if (role === 'admin') {
      // Admin doesn't need instrument selection
      setSelectedRole(role);
      login(role);
    } else {
      // Students and teachers need to select instrument
      setPendingRole(role);
      setShowInstrumentModal(true);
    }
  };

  const handleInstrumentSelect = (instrument: string) => {
    setShowInstrumentModal(false);
    if (pendingRole) {
      setSelectedRole(pendingRole);
      setSelectedInstrument(instrument);
      login(pendingRole, instrument);
    }
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
            <Ionicons name="musical-notes" size={44} color="#4A90D9" />
          </View>
          <Text style={styles.title}>Accademia de</Text>
          <Text style={styles.titleHighlight}>"I Musici"</Text>
        </View>

        {/* Login Section with Role Selection */}
        <View style={styles.loginSection}>
          <Text style={styles.loginTitle}>Seleziona il tuo ruolo:</Text>
          
          {/* Admin Login */}
          <TouchableOpacity 
            style={[styles.roleLoginButton, styles.adminButton]} 
            onPress={() => handleRoleSelect('admin')}
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
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          
          {/* Teacher Login */}
          <TouchableOpacity 
            style={[styles.roleLoginButton, styles.teacherButton]} 
            onPress={() => handleRoleSelect('insegnante')}
          >
            <View style={styles.roleLoginContent}>
              <View style={[styles.roleLoginIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="school" size={24} color="#fff" />
              </View>
              <View style={styles.roleLoginText}>
                <Text style={styles.roleLoginTitle}>Insegnante</Text>
                <Text style={styles.roleLoginDesc}>Gestisci lezioni, presenze e compiti</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          
          {/* Student Login */}
          <TouchableOpacity 
            style={[styles.roleLoginButton, styles.studentButton]} 
            onPress={() => handleRoleSelect('studente')}
          >
            <View style={styles.roleLoginContent}>
              <View style={[styles.roleLoginIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <View style={styles.roleLoginText}>
                <Text style={styles.roleLoginTitle}>Studente</Text>
                <Text style={styles.roleLoginDesc}>Visualizza presenze, compiti e pagamenti</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          
          <View style={styles.googleHint}>
            <Ionicons name="logo-google" size={16} color="#666" />
            <Text style={styles.loginHint}>
              Accedi con il tuo account Google
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 Accademia de "I Musici"</Text>
        </View>
      </ScrollView>

      {/* Instrument Selection Modal */}
      <Modal
        visible={showInstrumentModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInstrumentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Seleziona il tuo corso
              </Text>
              <TouchableOpacity onPress={() => setShowInstrumentModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              {pendingRole === 'insegnante' ? 'Quale strumento insegni?' : 'Quale strumento studi?'}
            </Text>

            <View style={styles.instrumentsGrid}>
              {INSTRUMENTS.map((inst) => (
                <TouchableOpacity
                  key={inst.value}
                  style={styles.instrumentCard}
                  onPress={() => handleInstrumentSelect(inst.value)}
                >
                  <View style={styles.instrumentIconContainer}>
                    <Ionicons name={inst.icon as any} size={32} color="#4A90D9" />
                  </View>
                  <Text style={styles.instrumentLabel}>{inst.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
    flexGrow: 1,
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
    paddingTop: 40,
    paddingBottom: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
  loginSection: {
    flex: 1,
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  roleLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 12,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  roleLoginText: {
    flex: 1,
  },
  roleLoginTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  roleLoginDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  googleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginHint: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  instrumentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  instrumentCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  instrumentIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EBF5FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  instrumentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});
