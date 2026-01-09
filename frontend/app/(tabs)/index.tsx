import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { statsApi, seedApi, adminActionsApi } from '../../src/services/api';
import { AdminStats } from '../../src/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/theme';
import { ErrorMessage } from '../../src/components/ErrorMessage';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string>('');

  const isAdmin = user?.ruolo === 'amministratore';
  const isTeacher = user?.ruolo === 'insegnante';
  const isStudent = user?.ruolo === 'allievo';

  const fetchStats = async () => {
    if (isAdmin) {
      try {
        const data = await statsApi.getAdminStats();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, []);

  const handleSeedData = async () => {
    setSeeding(true);
    setError('');
    try {
      await seedApi.seedDatabase();
      await fetchStats();
    } catch (error: any) {
      console.error('Error seeding:', error);
      setError(error.response?.data?.detail || 'Errore durante il popolamento del database');
    } finally {
      setSeeding(false);
    }
  };

  const handleGenerateMonthlyPayments = async () => {
    setActionLoading('payments');
    setError('');
    try {
      const result = await adminActionsApi.generateMonthlyPayments();
      alert(`Successo: ${result.message || 'Pagamenti generati'}`);
      await fetchStats();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Errore durante la generazione dei pagamenti';
      setError(errorMsg);
    } finally {
      setActionLoading('');
    }
  };

  const handleSendPaymentReminders = async () => {
    setActionLoading('reminders');
    setError('');
    try {
      const result = await adminActionsApi.sendPaymentReminders();
      alert(`Successo: ${result.message || 'Promemoria inviati'}`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Errore durante invio promemoria';
      setError(errorMsg);
    } finally {
      setActionLoading('');
    }
  };

  const navigateToUsers = () => {
    router.push('/(tabs)/users');
  };

  const navigateToAttendance = () => {
    router.push('/(tabs)/attendance');
  };

  const getUserGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buongiorno';
    if (hour < 18) return 'Buon pomeriggio';
    return 'Buonasera';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Compact Header */}
      <LinearGradient
        colors={[Colors.primary, '#1a4fa0']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Accademia de "I Musici"</Text>
            <Text style={styles.headerSubtitle}>
              {getUserGreeting()}, {user?.nome || 'Admin'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {isAdmin && stats && (
          <>
            {/* Stats Section Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Panoramica</Text>
              <View style={styles.roleBadgeInline}>
                <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
                <Text style={styles.roleBadgeText}>Admin</Text>
              </View>
            </View>

            {/* Improved Stats Grid - 2x2 */}
            <View style={styles.statsContainer}>
              <View style={styles.statsRow}>
                <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={navigateToUsers}>
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.statGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.statIconBg}>
                      <Ionicons name="people" size={22} color="#fff" />
                    </View>
                    <Text style={styles.statValue}>{stats.totale_utenti}</Text>
                    <Text style={styles.statLabel}>Utenti Totali</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={navigateToUsers}>
                  <LinearGradient
                    colors={['#f093fb', '#f5576c']}
                    style={styles.statGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.statIconBg}>
                      <Ionicons name="school" size={22} color="#fff" />
                    </View>
                    <Text style={styles.statValue}>{stats.totale_insegnanti}</Text>
                    <Text style={styles.statLabel}>Insegnanti</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={styles.statsRow}>
                <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={navigateToUsers}>
                  <LinearGradient
                    colors={['#4facfe', '#00f2fe']}
                    style={styles.statGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.statIconBg}>
                      <Ionicons name="musical-notes" size={22} color="#fff" />
                    </View>
                    <Text style={styles.statValue}>{stats.totale_allievi}</Text>
                    <Text style={styles.statLabel}>Allievi</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.statCard} activeOpacity={0.8}>
                  <LinearGradient
                    colors={['#11998e', '#38ef7d']}
                    style={styles.statGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.statIconBg}>
                      <Ionicons name="cash" size={22} color="#fff" />
                    </View>
                    <Text style={styles.statValue}>€{stats.totale_incassi?.toFixed(0) || 0}</Text>
                    <Text style={styles.statLabel}>Incassi</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Cards */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Azioni Rapide</Text>
              
              <TouchableOpacity 
                style={styles.actionCard} 
                onPress={navigateToUsers}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: `${Colors.primary}15` }]}>
                  <Ionicons name="person-add" size={24} color={Colors.primary} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Nuovo Utente</Text>
                  <Text style={styles.actionDesc}>Aggiungi allievo o insegnante</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionCard} 
                onPress={navigateToAttendance}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: `${Colors.accent}15` }]}>
                  <Ionicons name="calendar" size={24} color={Colors.accent} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Registro Presenze</Text>
                  <Text style={styles.actionDesc}>Gestisci lezioni e presenze</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionCard}
                onPress={handleGenerateMonthlyPayments}
                disabled={actionLoading === 'payments'}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: `${Colors.warning}15` }]}>
                  <Ionicons name="wallet" size={24} color={Colors.warning} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Genera Pagamenti</Text>
                  <Text style={styles.actionDesc}>Crea pagamenti mensili</Text>
                </View>
                {actionLoading === 'payments' ? (
                  <ActivityIndicator color={Colors.warning} size="small" />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionCard}
                onPress={handleSendPaymentReminders}
                disabled={actionLoading === 'reminders'}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: `${Colors.error}15` }]}>
                  <Ionicons name="notifications" size={24} color={Colors.error} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Invia Promemoria</Text>
                  <Text style={styles.actionDesc}>Notifica pagamenti in sospeso</Text>
                </View>
                {actionLoading === 'reminders' ? (
                  <ActivityIndicator color={Colors.error} size="small" />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionCard, styles.seedCard]}
                onPress={handleSeedData}
                disabled={seeding}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: `${Colors.success}15` }]}>
                  <Ionicons name="refresh" size={24} color={Colors.success} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Popola Database</Text>
                  <Text style={styles.actionDesc}>Genera dati di test</Text>
                </View>
                {seeding ? (
                  <ActivityIndicator color={Colors.success} size="small" />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={Colors.textTertiary} />
                )}
              </TouchableOpacity>

              {error && <ErrorMessage message={error} />}
            </View>
          </>
        )}

        {(isTeacher || isStudent) && (
          <View style={styles.welcomeCard}>
            <Ionicons name="musical-notes" size={48} color={Colors.primary} />
            <Text style={styles.welcomeTitle}>Benvenuto!</Text>
            <Text style={styles.welcomeText}>
              {isTeacher 
                ? 'Usa le tab in basso per gestire le tue lezioni e presenze.'
                : 'Qui puoi visualizzare i tuoi corsi, presenze e pagamenti.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  
  // Compact Header
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    color: '#fff',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: Typography.fontSize.small,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  roleBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}15`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  roleBadgeText: {
    fontSize: Typography.fontSize.tiny,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
  },

  // Improved Stats Grid
  statsContainer: {
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  statGradient: {
    padding: Spacing.md,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Section
  section: {
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  // Action Cards
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  seedCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: Typography.fontSize.caption,
    color: Colors.textSecondary,
  },

  // Welcome Card
  welcomeCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    ...Shadows.large,
  },
  welcomeTitle: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  welcomeText: {
    fontSize: Typography.fontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSize.body * 1.5,
  },
});
