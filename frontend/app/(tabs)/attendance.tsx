import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { attendanceApi } from '../../src/services/api';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Layout } from '../../src/theme';
import { formatDateForDisplay } from '../../src/utils/dateFormat';

interface Attendance {
  id: string;
  data_lezione: string;
  insegnante_id: string;
  allievo_id: string;
  corso: string;
  presente: boolean;
  giustificato?: boolean;
  note?: string;
}

export default function AttendanceScreen() {
  const { user } = useAuth();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAttendances = async () => {
    try {
      const data = await attendanceApi.getAll();
      setAttendances(data);
    } catch (error) {
      console.error('Error fetching attendances:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendances();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAttendances();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    return formatDateForDisplay(dateString);
  };

  const getStatusIcon = (presente: boolean, giustificato?: boolean): keyof typeof Ionicons.glyphMap => {
    if (presente) return 'checkmark-circle';
    if (giustificato) return 'help-circle';
    return 'close-circle';
  };

  const getStatusColor = (presente: boolean, giustificato?: boolean) => {
    if (presente) return Colors.success;
    if (giustificato) return Colors.warning;
    return Colors.error;
  };

  const getStatusLabel = (presente: boolean, giustificato?: boolean) => {
    if (presente) return 'Presente';
    if (giustificato) return 'Giustificato';
    return 'Assente';
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
      {/* Stats Header */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: Colors.successLight }]}>
          <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
          <Text style={[styles.statNumber, { color: Colors.success }]}>
            {attendances.filter(a => a.presente).length}
          </Text>
          <Text style={styles.statLabel}>Presenti</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.errorLight }]}>
          <Ionicons name="close-circle" size={24} color={Colors.error} />
          <Text style={[styles.statNumber, { color: Colors.error }]}>
            {attendances.filter(a => !a.presente && !a.giustificato).length}
          </Text>
          <Text style={styles.statLabel}>Assenti</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.warningLight }]}>
          <Ionicons name="help-circle" size={24} color={Colors.warning} />
          <Text style={[styles.statNumber, { color: Colors.warning }]}>
            {attendances.filter(a => a.giustificato).length}
          </Text>
          <Text style={styles.statLabel}>Giustificati</Text>
        </View>
      </View>

      {/* Attendance List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {attendances.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Nessuna presenza registrata</Text>
            <Text style={styles.emptyText}>Le presenze appariranno qui</Text>
          </View>
        ) : (
          attendances.map(attendance => (
            <TouchableOpacity
              key={attendance.id}
              style={styles.attendanceCard}
              activeOpacity={0.8}
            >
              <View style={[styles.statusIconContainer, { backgroundColor: `${getStatusColor(attendance.presente, attendance.giustificato)}15` }]}>
                <Ionicons 
                  name={getStatusIcon(attendance.presente, attendance.giustificato)} 
                  size={24} 
                  color={getStatusColor(attendance.presente, attendance.giustificato)} 
                />
              </View>
              
              <View style={styles.attendanceInfo}>
                <View style={styles.attendanceHeader}>
                  <Text style={styles.attendanceCourse}>{attendance.corso || 'Corso'}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(attendance.presente, attendance.giustificato)}20` }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(attendance.presente, attendance.giustificato) }]}>
                      {getStatusLabel(attendance.presente, attendance.giustificato)}
                    </Text>
                  </View>
                </View>
                <View style={styles.attendanceMeta}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.attendanceDate}>{formatDate(attendance.data_lezione)}</Text>
                </View>
                {attendance.note && (
                  <Text style={styles.attendanceNote} numberOfLines={2}>
                    {attendance.note}
                  </Text>
                )}
              </View>
              
              <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          ))
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
  
  // Stats
  statsContainer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: Typography.fontSize.h1,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.sm,
  },
  statLabel: {
    fontSize: Typography.fontSize.small,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },

  // List
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  attendanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  attendanceInfo: {
    flex: 1,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  attendanceCourse: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: Typography.fontSize.small,
    fontWeight: Typography.fontWeight.medium,
  },
  attendanceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  attendanceDate: {
    fontSize: Typography.fontSize.caption,
    color: Colors.textSecondary,
  },
  attendanceNote: {
    fontSize: Typography.fontSize.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.huge,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.lg,
  },
  emptyText: {
    fontSize: Typography.fontSize.body,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
});