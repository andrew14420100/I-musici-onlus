import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { statsApi, seedApi, adminActionsApi } from '../../src/services/api';
import { AdminStats } from '../../src/types';
import { StatCard } from '../../src/components/StatCard';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Layout } from '../../src/theme';
import { formatDateForDisplay } from '../../src/utils/dateFormat';
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

  const getUserDisplayName = () => {
    if (!user) return 'Utente';
    return `${user.nome} ${user.cognome}`;
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
      {/* Header with Gradient */}
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <Text style={styles.greeting}>{getUserGreeting()}</Text>
            <Text style={styles.userName}>{getUserDisplayName()}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {isAdmin ? '👑 Amministratore' : isTeacher ? '👨‍🏫 Insegnante' : '🎓 Allievo'}
              </Text>
            </View>
          </View>
          <View style={styles.avatarContainer}>
            <Image 
              source={require('../../assets/logo.png')} 
              style={styles.avatarImage}
              resizeMode="contain"
            />
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
            {/* Quick Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: `${Colors.admin}15` }]}>
                  <Ionicons name="people" size={24} color={Colors.admin} />
                </View>
                <Text style={styles.statValue}>{stats.totale_utenti}</Text>
                <Text style={styles.statLabel}>Utenti Totali</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: `${Colors.teacher}15` }]}>
                  <Ionicons name="school" size={24} color={Colors.teacher} />
                </View>
                <Text style={styles.statValue}>{stats.totale_insegnanti}</Text>
                <Text style={styles.statLabel}>Insegnanti</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: `${Colors.student}15` }]}>
                  <Ionicons name="musical-notes" size={24} color={Colors.student} />
                </View>
                <Text style={styles.statValue}>{stats.totale_allievi}</Text>
                <Text style={styles.statLabel}>Allievi</Text>
              </View>

              <View style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: `${Colors.success}15` }]}>
                  <Ionicons name="cash" size={24} color={Colors.success} />
                </View>
                <Text style={styles.statValue}>€{stats.totale_incassi?.toFixed(0) || 0}</Text>
                <Text style={styles.statLabel}>Incassi</Text>
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
                  <Ionicons name="person-add" size={28} color={Colors.primary} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Nuovo Utente</Text>
                  <Text style={styles.actionDesc}>Aggiungi allievo o insegnante</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionCard} 
                onPress={navigateToAttendance}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: `${Colors.accent}15` }]}>
                  <Ionicons name="calendar" size={28} color={Colors.accent} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Registro Presenze</Text>
                  <Text style={styles.actionDesc}>Gestisci lezioni e presenze</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionCard}
                onPress={handleGenerateMonthlyPayments}
                disabled={actionLoading === 'payments'}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: `${Colors.warning}15` }]}>
                  <Ionicons name="cash" size={28} color={Colors.warning} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Genera Pagamenti Mensili</Text>
                  <Text style={styles.actionDesc}>Crea pagamenti per tutti gli allievi</Text>
                </View>
                {actionLoading === 'payments' ? (
                  <ActivityIndicator color={Colors.warning} />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionCard}
                onPress={handleSendPaymentReminders}
                disabled={actionLoading === 'reminders'}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: `${Colors.error}15` }]}>
                  <Ionicons name="notifications" size={28} color={Colors.error} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Invia Promemoria Pagamenti</Text>
                  <Text style={styles.actionDesc}>Notifica allievi con pagamenti in sospeso</Text>
                </View>
                {actionLoading === 'reminders' ? (
                  <ActivityIndicator color={Colors.error} />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionCard, styles.seedCard]}
                onPress={handleSeedData}
                disabled={seeding}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: `${Colors.success}15` }]}>
                  <Ionicons name="refresh" size={28} color={Colors.success} />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Popola Database</Text>
                  <Text style={styles.actionDesc}>Genera dati di test</Text>
                </View>
                {seeding ? (
                  <ActivityIndicator color={Colors.success} />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
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
  
  // Header
  headerGradient: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    ...Shadows.medium,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: Typography.fontSize.caption,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: Typography.fontWeight.medium,
  },
  userName: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
    marginTop: Spacing.xs,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
  },
  roleText: {
    fontSize: Typography.fontSize.small,
    color: Colors.surface,
    fontWeight: Typography.fontWeight.medium,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.large,
  },
  avatarImage: {
    width: 64,
    height: 64,
  },

  // Content
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.xl,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    ...Shadows.medium,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statValue: {
    fontSize: Typography.fontSize.h1,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: Typography.fontSize.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Section
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },

  // Action Cards
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  seedCard: {
    borderWidth: 1,
    borderColor: Colors.success,
    borderStyle: 'dashed',
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
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