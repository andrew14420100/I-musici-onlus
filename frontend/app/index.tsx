import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { router } from 'expo-router';

type LoginMode = 'select' | 'user' | 'admin_pin' | 'admin_google';

export default function LandingPage() {
  const { 
    user, 
    isLoading, 
    isAuthenticated, 
    pendingAdminEmail,
    loginWithCredentials, 
    loginAdminPin, 
    loginAdminGoogle 
  } = useAuth();
  
  const [loginMode, setLoginMode] = useState<LoginMode>('select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    // If there's a pending admin email, go to Google step
    if (pendingAdminEmail) {
      setLoginMode('admin_google');
    }
  }, [pendingAdminEmail]);

  const handleUserLogin = async () => {
    if (!email || !password) {
      Alert.alert('Errore', 'Inserisci email e password');
      return;
    }
    
    setIsSubmitting(true);
    const result = await loginWithCredentials(email, password);
    setIsSubmitting(false);
    
    if (!result.success) {
      Alert.alert('Errore', result.error || 'Login fallito');
    }
  };

  const handleAdminPinSubmit = async () => {
    if (!email || !pin) {
      Alert.alert('Errore', 'Inserisci email e PIN');
      return;
    }
    
    setIsSubmitting(true);
    const result = await loginAdminPin(email, pin);
    setIsSubmitting(false);
    
    if (result.success && result.needsGoogle) {
      setLoginMode('admin_google');
    } else if (!result.success) {
      Alert.alert('Errore', result.error || 'PIN non valido');
    }
  };

  const handleAdminGoogleLogin = async () => {
    setIsSubmitting(true);
    await loginAdminGoogle();
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  const renderSelectMode = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Ionicons name="musical-notes" size={44} color="#4A90D9" />
        </View>
        <Text style={styles.title}>Accademia de</Text>
        <Text style={styles.titleHighlight}>"I Musici"</Text>
      </View>

      {/* Login Options */}
      <View style={styles.loginSection}>
        <Text style={styles.loginTitle}>Accedi come:</Text>
        
        {/* Admin Login */}
        <TouchableOpacity 
          style={[styles.roleButton, styles.adminButton]} 
          onPress={() => setLoginMode('admin_pin')}
        >
          <View style={styles.roleButtonContent}>
            <View style={[styles.roleIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="shield-checkmark" size={24} color="#fff" />
            </View>
            <View style={styles.roleText}>
              <Text style={styles.roleTitle}>Amministratore</Text>
              <Text style={styles.roleDesc}>Accesso con PIN + Google</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        
        {/* Teacher Login */}
        <TouchableOpacity 
          style={[styles.roleButton, styles.teacherButton]} 
          onPress={() => setLoginMode('user')}
        >
          <View style={styles.roleButtonContent}>
            <View style={[styles.roleIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="school" size={24} color="#fff" />
            </View>
            <View style={styles.roleText}>
              <Text style={styles.roleTitle}>Insegnante</Text>
              <Text style={styles.roleDesc}>Accesso con email e password</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        
        {/* Student Login */}
        <TouchableOpacity 
          style={[styles.roleButton, styles.studentButton]} 
          onPress={() => setLoginMode('user')}
        >
          <View style={styles.roleButtonContent}>
            <View style={[styles.roleIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
            <View style={styles.roleText}>
              <Text style={styles.roleTitle}>Allievo</Text>
              <Text style={styles.roleDesc}>Accesso con email e password</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
        
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#666" />
          <Text style={styles.infoText}>
            Le credenziali vengono fornite dall'amministrazione.{'\n'}
            Non è possibile recuperare la password autonomamente.
          </Text>
        </View>
      </View>
    </>
  );

  const renderUserLogin = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={() => setLoginMode('select')}>
        <Ionicons name="arrow-back" size={24} color="#4A90D9" />
        <Text style={styles.backText}>Indietro</Text>
      </TouchableOpacity>

      <View style={styles.formHeader}>
        <View style={[styles.formIcon, { backgroundColor: '#10B981' }]}>
          <Ionicons name="person" size={32} color="#fff" />
        </View>
        <Text style={styles.formTitle}>Accesso Allievo/Insegnante</Text>
        <Text style={styles.formSubtitle}>
          Inserisci le credenziali fornite dall'amministrazione
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="email@esempio.it"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#999" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
          onPress={handleUserLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Accedi</Text>
          )}
        </TouchableOpacity>

        <View style={styles.warningBox}>
          <Ionicons name="warning" size={18} color="#F59E0B" />
          <Text style={styles.warningText}>
            In caso di problemi con le credenziali, contatta l'amministrazione.
          </Text>
        </View>
      </View>
    </>
  );

  const renderAdminPinLogin = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={() => setLoginMode('select')}>
        <Ionicons name="arrow-back" size={24} color="#4A90D9" />
        <Text style={styles.backText}>Indietro</Text>
      </TouchableOpacity>

      <View style={styles.formHeader}>
        <View style={[styles.formIcon, { backgroundColor: '#4A90D9' }]}>
          <Ionicons name="shield-checkmark" size={32} color="#fff" />
        </View>
        <Text style={styles.formTitle}>Accesso Amministratore</Text>
        <Text style={styles.formSubtitle}>
          Fase 1 di 2: Verifica PIN
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email Amministratore</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@musici.it"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>PIN</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="keypad" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="Inserisci PIN"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.submitButton, { backgroundColor: '#4A90D9' }, isSubmitting && styles.submitButtonDisabled]} 
          onPress={handleAdminPinSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Verifica PIN</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.stepsIndicator}>
          <View style={[styles.step, styles.stepActive]}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepLabel}>PIN</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.step}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepLabel}>Google</Text>
          </View>
        </View>
      </View>
    </>
  );

  const renderAdminGoogleLogin = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={() => setLoginMode('admin_pin')}>
        <Ionicons name="arrow-back" size={24} color="#4A90D9" />
        <Text style={styles.backText}>Indietro</Text>
      </TouchableOpacity>

      <View style={styles.formHeader}>
        <View style={[styles.formIcon, { backgroundColor: '#4A90D9' }]}>
          <Ionicons name="shield-checkmark" size={32} color="#fff" />
        </View>
        <Text style={styles.formTitle}>Accesso Amministratore</Text>
        <Text style={styles.formSubtitle}>
          Fase 2 di 2: Verifica Google
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.successBox}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.successText}>
            PIN verificato correttamente!{'\n'}
            Procedi con l'autenticazione Google.
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.googleButton, isSubmitting && styles.submitButtonDisabled]} 
          onPress={handleAdminGoogleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="logo-google" size={22} color="#fff" />
              <Text style={styles.googleButtonText}>Continua con Google</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.stepsIndicator}>
          <View style={[styles.step, styles.stepCompleted]}>
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={styles.stepLabel}>PIN</Text>
          </View>
          <View style={[styles.stepLine, styles.stepLineActive]} />
          <View style={[styles.step, styles.stepActive]}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepLabel}>Google</Text>
          </View>
        </View>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {loginMode === 'select' && renderSelectMode()}
          {loginMode === 'user' && renderUserLogin()}
          {loginMode === 'admin_pin' && renderAdminPinLogin()}
          {loginMode === 'admin_google' && renderAdminGoogleLogin()}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2025 Accademia de "I Musici"</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  roleButton: {
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
  teacherButton: {
    backgroundColor: '#F59E0B',
  },
  studentButton: {
    backgroundColor: '#10B981',
  },
  roleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  roleText: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  roleDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F1F5F9',
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    marginLeft: 10,
    lineHeight: 18,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  backText: {
    fontSize: 16,
    color: '#4A90D9',
    marginLeft: 8,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  formIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
  },
  formSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 10,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 14,
    borderRadius: 10,
    marginTop: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    marginLeft: 10,
    lineHeight: 18,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#D1FAE5',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: '#065F46',
    marginLeft: 10,
    lineHeight: 20,
  },
  stepsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  step: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepActive: {
    backgroundColor: '#4A90D9',
  },
  stepCompleted: {
    backgroundColor: '#10B981',
  },
  stepNumber: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  stepLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    position: 'absolute',
    bottom: -20,
  },
  stepLine: {
    width: 60,
    height: 3,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#10B981',
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
