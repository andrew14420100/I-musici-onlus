import React, { useState, useEffect } from 'react';
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
  Image,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Layout } from '../src/theme';

type LoginMode = 'select' | 'login';
type SelectedRole = 'amministratore' | 'insegnante' | 'allievo';

export default function LandingPage() {
  const { 
    user, 
    isLoading, 
    isAuthenticated, 
    loginWithCredentials
  } = useAuth();
  
  const [loginMode, setLoginMode] = useState<LoginMode>('select');
  const [selectedRole, setSelectedRole] = useState<SelectedRole>('allievo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string>('');
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.replace('/(tabs)');
    }
  }, [isLoading, isAuthenticated, user]);

  const handleLogin = async () => {
    setLoginError('');
    
    if (!email || !password) {
      setLoginError('Inserisci email e password');
      return;
    }
    
    setIsSubmitting(true);
    const result = await loginWithCredentials(email, password, selectedRole);
    setIsSubmitting(false);
    
    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setLoginError(result.error || 'Email o password non validi');
    }
  };

  const selectRoleAndLogin = (role: SelectedRole) => {
    setSelectedRole(role);
    setLoginMode('login');
    setLoginError('');
  };

  const getRoleColor = (role: SelectedRole) => {
    switch (role) {
      case 'amministratore':
        return Colors.admin;
      case 'insegnante':
        return Colors.teacher;
      case 'allievo':
        return Colors.student;
    }
  };

  const getRoleIcon = (role: SelectedRole): keyof typeof Ionicons.glyphMap => {
    switch (role) {
      case 'amministratore':
        return 'shield-checkmark';
      case 'insegnante':
        return 'school';
      case 'allievo':
        return 'musical-notes';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderSelectMode = () => (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header with Logo */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../assets/logo.png')} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.subtitle}>Seleziona il tuo ruolo per accedere</Text>
            </View>

            {/* Role Cards */}
            <View style={styles.rolesContainer}>
              {/* Admin */}
              <TouchableOpacity 
                style={styles.roleCard}
                onPress={() => selectRoleAndLogin('amministratore')}
                activeOpacity={0.8}
              >
                <View style={[styles.roleIconContainer, { backgroundColor: `${Colors.admin}20` }]}>
                  <Ionicons name="shield-checkmark" size={32} color={Colors.admin} />
                </View>
                <Text style={styles.roleTitle}>Amministratore</Text>
                <Text style={styles.roleDesc}>Gestione completa</Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} style={styles.roleArrow} />
              </TouchableOpacity>

              {/* Teacher */}
              <TouchableOpacity 
                style={styles.roleCard}
                onPress={() => selectRoleAndLogin('insegnante')}
                activeOpacity={0.8}
              >
                <View style={[styles.roleIconContainer, { backgroundColor: `${Colors.teacher}20` }]}>
                  <Ionicons name="school" size={32} color={Colors.teacher} />
                </View>
                <Text style={styles.roleTitle}>Insegnante</Text>
                <Text style={styles.roleDesc}>Lezioni e presenze</Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} style={styles.roleArrow} />
              </TouchableOpacity>

              {/* Student */}
              <TouchableOpacity 
                style={styles.roleCard}
                onPress={() => selectRoleAndLogin('allievo')}
                activeOpacity={0.8}
              >
                <View style={[styles.roleIconContainer, { backgroundColor: `${Colors.student}20` }]}>
                  <Ionicons name="musical-notes" size={32} color={Colors.student} />
                </View>
                <Text style={styles.roleTitle}>Allievo</Text>
                <Text style={styles.roleDesc}>Corsi e pagamenti</Text>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} style={styles.roleArrow} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </Animated.View>
  );

  const renderLoginForm = () => (
    <LinearGradient
      colors={[Colors.primary, Colors.primaryLight]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Back Button */}
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setLoginMode('select');
                setLoginError('');
                setEmail('');
                setPassword('');
              }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.surface} />
              <Text style={styles.backText}>Indietro</Text>
            </TouchableOpacity>

            {/* Login Card */}
            <View style={styles.loginCard}>
              <View style={[styles.loginIconContainer, { backgroundColor: `${getRoleColor(selectedRole)}20` }]}>
                <Ionicons name={getRoleIcon(selectedRole)} size={40} color={getRoleColor(selectedRole)} />
              </View>
              
              <Text style={styles.loginTitle}>
                {selectedRole === 'amministratore' ? 'Amministratore' : 
                 selectedRole === 'insegnante' ? 'Insegnante' : 'Allievo'}
              </Text>
              <Text style={styles.loginSubtitle}>Inserisci le tue credenziali</Text>

              {loginError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={20} color={Colors.error} />
                  <Text style={styles.errorText}>{loginError}</Text>
                </View>
              ) : null}

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={Colors.textTertiary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={Colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={Colors.textSecondary} 
                  />
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity 
                style={[
                  styles.loginButton,
                  { backgroundColor: getRoleColor(selectedRole) }
                ]}
                onPress={handleLogin}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={Colors.surface} />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Accedi</Text>
                    <Ionicons name="arrow-forward" size={20} color={Colors.surface} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );

  return loginMode === 'select' ? renderSelectMode() : renderLoginForm();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.xl,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  
  // Header
  header: {
    alignItems: 'center',
    marginTop: Spacing.huge,
    marginBottom: Spacing.xxxl,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.large,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.regular,
    color: Colors.surface,
    marginTop: Spacing.md,
  },
  titleHighlight: {
    fontSize: Typography.fontSize.h1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
    marginTop: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.fontSize.caption,
    color: 'rgba(255,255,255,0.8)',
    marginTop: Spacing.md,
  },

  // Role Cards
  rolesContainer: {
    gap: Spacing.lg,
  },
  roleCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadows.medium,
  },
  roleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  roleTitle: {
    flex: 1,
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  roleDesc: {
    position: 'absolute',
    left: 88,
    bottom: Spacing.lg,
    fontSize: Typography.fontSize.caption,
    color: Colors.textSecondary,
  },
  roleArrow: {
    marginLeft: Spacing.sm,
  },

  // Login Form
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  backText: {
    fontSize: Typography.fontSize.body,
    color: Colors.surface,
    marginLeft: Spacing.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  loginCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    ...Shadows.large,
    marginTop: Spacing.xl,
  },
  loginIconContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  loginTitle: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  loginSubtitle: {
    fontSize: Typography.fontSize.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  
  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.fontSize.caption,
    color: Colors.error,
    marginLeft: Spacing.sm,
  },

  // Inputs
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    height: Layout.inputHeight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.body,
    color: Colors.textPrimary,
  },
  eyeIcon: {
    padding: Spacing.sm,
  },

  // Button
  loginButton: {
    height: Layout.buttonHeight,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadows.medium,
  },
  loginButtonText: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.surface,
    marginRight: Spacing.sm,
  },
});
