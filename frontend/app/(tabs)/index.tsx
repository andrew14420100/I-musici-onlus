import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { statsApi, seedApi } from '../../src/services/api';
import { AdminStats, UserRole, Lesson } from '../../src/types';
import { StatCard } from '../../src/components/StatCard';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function DashboardScreen() {
  const { user, isLoading: authLoading, isInitialized } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      // First seed the database
      try {
        await seedApi.seed();
      } catch (e) {
        // Ignore if already seeded
      }
      
      // Fetch stats (only for admin)
      if (user?.ruolo === 'amministratore') {
        const data = await statsApi.getAdminStats();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const getRoleLabel = () => {
    switch (user?.ruolo) {
      case 'amministratore':
        return 'Amministratore';
      case 'insegnante':
        return 'Insegnante';
      case 'studente':
        return 'Studente';
      default:
        return 'Utente';
    }
  };

  // Helper to get user initials safely
  const getUserInitials = () => {
    if (!user) return '?';
    const name = user.nome || user.name || '';
    const cognome = user.cognome || '';
    if (cognome) {
      return `${name.charAt(0)}${cognome.charAt(0)}`.toUpperCase();
    }
    return name.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  // Helper to get display name
  const getDisplayName = () => {
    if (!user) return 'Utente';
    if (user.nome && user.cognome) {
      return `${user.nome} ${user.cognome}`;
    }
    return user.nome || user.name || user.email || 'Utente';
  };

  // Show loading while auth is initializing or user not ready
  if (!isInitialized || authLoading || loading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Welcome Section */}
      <View style={styles.welcomeSection}>
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeText}>Benvenuto,</Text>
          <Text style={styles.userName}>{user?.name}</Text>
          <View style={styles.roleBadge}>
            <Ionicons 
              name={user?.role === UserRole.ADMIN ? 'shield-checkmark' : user?.role === UserRole.TEACHER ? 'school' : 'person'} 
              size={14} 
              color="#4A90D9" 
            />
            <Text style={styles.roleText}>{getRoleLabel()}</Text>
          </View>
        </View>
        {user?.picture ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Admin Stats */}
      {user?.role === UserRole.ADMIN && stats && (
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Riepilogo Generale</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <View style={styles.statHalf}>
                <StatCard 
                  title="Studenti Attivi" 
                  value={stats.studenti_attivi} 
                  icon="people" 
                  color="#4A90D9" 
                />
              </View>
              <View style={styles.statHalf}>
                <StatCard 
                  title="Insegnanti Attivi" 
                  value={stats.insegnanti_attivi} 
                  icon="school" 
                  color="#10B981" 
                />
              </View>
            </View>
            
            <View style={styles.statsRow}>
              <View style={styles.statHalf}>
                <StatCard 
                  title="Corsi Attivi" 
                  value={stats.corsi_attivi} 
                  icon="book" 
                  color="#8B5CF6" 
                />
              </View>
              <View style={styles.statHalf}>
                <StatCard 
                  title="Lezioni Settimana" 
                  value={stats.lezioni_settimana} 
                  icon="calendar" 
                  color="#F59E0B" 
                />
              </View>
            </View>
          </View>

          {/* Payments Summary */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Situazione Pagamenti</Text>
          
          <View style={styles.paymentsRow}>
            <View style={[styles.paymentCard, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="alert-circle" size={24} color="#EF4444" />
              <Text style={styles.paymentValue}>{stats.pagamenti_studenti_non_pagati}</Text>
              <Text style={styles.paymentLabel}>Quote Studenti{"\n"}Non Pagate</Text>
            </View>
            <View style={[styles.paymentCard, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time" size={24} color="#F59E0B" />
              <Text style={styles.paymentValue}>{stats.compensi_insegnanti_non_pagati}</Text>
              <Text style={styles.paymentLabel}>Compensi{"\n"}In Attesa</Text>
            </View>
            <View style={[styles.paymentCard, { backgroundColor: '#EBF5FF' }]}>
              <Ionicons name="notifications" size={24} color="#4A90D9" />
              <Text style={styles.paymentValue}>{stats.notifiche_attive}</Text>
              <Text style={styles.paymentLabel}>Notifiche{"\n"}Attive</Text>
            </View>
          </View>

          {/* Today's Lessons */}
          {stats.lezioni_oggi.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Lezioni di Oggi</Text>
              <View style={styles.todayLessons}>
                {stats.lezioni_oggi.slice(0, 5).map((lesson, index) => (
                  <View key={lesson.lesson_id} style={styles.lessonItem}>
                    <View style={styles.lessonTime}>
                      <Ionicons name="time" size={14} color="#4A90D9" />
                      <Text style={styles.lessonTimeText}>
                        {format(new Date(lesson.date_time), 'HH:mm')}
                      </Text>
                    </View>
                    <View style={styles.lessonInfo}>
                      <Text style={styles.lessonDuration}>
                        {lesson.duration_minutes} min
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* Non-Admin Welcome */}
      {user?.role !== UserRole.ADMIN && (
        <View style={styles.nonAdminSection}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={32} color="#4A90D9" />
            <Text style={styles.infoTitle}>Area Personale</Text>
            <Text style={styles.infoText}>
              Usa le tab in basso per navigare tra le diverse sezioni:{"\n\n"}
              • <Text style={styles.bold}>Corsi</Text> - I tuoi corsi e lezioni{"\n"}
              • <Text style={styles.bold}>Pagamenti</Text> - Le tue quote{"\n"}
              • <Text style={styles.bold}>Avvisi</Text> - Notifiche e comunicazioni
            </Text>
          </View>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  welcomeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  welcomeContent: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  roleText: {
    fontSize: 12,
    color: '#4A90D9',
    fontWeight: '500',
    marginLeft: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statsGrid: {
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statHalf: {
    flex: 1,
  },
  paymentsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  paymentValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  paymentLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  todayLessons: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  lessonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lessonTime: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  lessonTimeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginLeft: 6,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonDuration: {
    fontSize: 13,
    color: '#666',
  },
  nonAdminSection: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
    color: '#333',
  },
});
