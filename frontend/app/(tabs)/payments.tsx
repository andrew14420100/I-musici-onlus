import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { paymentsApi } from '../../src/services/api';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { formatDateForDisplay } from '../../src/utils/dateFormat';

interface Payment {
  id: string;
  utente_id: string;
  tipo: string;
  importo: number;
  descrizione: string;
  data_scadenza: string;
  stato: string;
  data_pagamento?: string;
  data_creazione: string;
}

export default function PaymentsScreen() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'tutti' | 'pagato' | 'in_attesa' | 'scaduto'>('tutti');

  const fetchPayments = async () => {
    try {
      const data = await paymentsApi.getAll();
      setPayments(data);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPayments();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    return formatDateForDisplay(dateString);
  };

  const getStatusColor = (stato: string) => {
    switch (stato) {
      case 'pagato':
        return Colors.success;
      case 'in_attesa':
        return Colors.warning;
      case 'scaduto':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusLabel = (stato: string) => {
    switch (stato) {
      case 'pagato':
        return 'Pagato';
      case 'in_attesa':
        return 'In Attesa';
      case 'scaduto':
        return 'Scaduto';
      default:
        return stato;
    }
  };

  const getStatusIcon = (stato: string): keyof typeof Ionicons.glyphMap => {
    switch (stato) {
      case 'pagato':
        return 'checkmark-circle';
      case 'in_attesa':
        return 'time';
      case 'scaduto':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  };

  const filteredPayments = payments.filter(payment => {
    if (filter === 'tutti') return true;
    return payment.stato === filter;
  });

  const stats = {
    totale: payments.reduce((sum, p) => sum + p.importo, 0),
    pagati: payments.filter(p => p.stato === 'pagato').length,
    inAttesa: payments.filter(p => p.stato === 'in_attesa').length,
    scaduti: payments.filter(p => p.stato === 'scaduto').length,
  };

  // Filter chip data
  const filterChips = [
    { key: 'tutti', label: 'Tutti', count: payments.length, color: Colors.primary, icon: 'list' },
    { key: 'pagato', label: 'Pagati', count: stats.pagati, color: Colors.success, icon: 'checkmark-circle' },
    { key: 'in_attesa', label: 'In Attesa', count: stats.inAttesa, color: Colors.warning, icon: 'time' },
    { key: 'scaduto', label: 'Scaduti', count: stats.scaduti, color: Colors.error, icon: 'alert-circle' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Total Card */}
      <View style={styles.totalCard}>
        <View style={styles.totalIconContainer}>
          <Ionicons name="cash" size={24} color={Colors.surface} />
        </View>
        <View style={styles.totalInfo}>
          <Text style={styles.totalLabel}>Totale</Text>
          <Text style={styles.totalAmount}>€{stats.totale.toFixed(2)}</Text>
        </View>
      </View>

      {/* Compact Filter Chips */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScrollContent}
        style={styles.filterScrollView}
      >
        {filterChips.map((chip) => {
          const isActive = filter === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.filterChip,
                isActive && { backgroundColor: chip.color }
              ]}
              onPress={() => setFilter(chip.key as any)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={chip.icon as any} 
                size={16} 
                color={isActive ? Colors.surface : chip.color} 
              />
              <Text style={[
                styles.filterChipText,
                isActive && styles.filterChipTextActive
              ]}>
                {chip.label}
              </Text>
              <View style={[
                styles.filterChipBadge,
                { backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : `${chip.color}20` }
              ]}>
                <Text style={[
                  styles.filterChipBadgeText,
                  { color: isActive ? Colors.surface : chip.color }
                ]}>
                  {chip.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Payment List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredPayments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Nessun pagamento</Text>
            <Text style={styles.emptyText}>Nessun pagamento trovato per questo filtro</Text>
          </View>
        ) : (
          filteredPayments.map(payment => (
            <TouchableOpacity
              key={payment.id}
              style={styles.paymentCard}
              activeOpacity={0.7}
            >
              <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(payment.stato) }]} />
              
              <View style={[styles.paymentIconContainer, { backgroundColor: getStatusColor(payment.stato) + '15' }]}>
                <Ionicons 
                  name={getStatusIcon(payment.stato)} 
                  size={24} 
                  color={getStatusColor(payment.stato)} 
                />
              </View>
              
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentDescription} numberOfLines={2}>{payment.descrizione}</Text>
                <View style={styles.paymentMeta}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.paymentDate}>Scadenza: {formatDate(payment.data_scadenza)}</Text>
                </View>
              </View>
              
              <View style={styles.paymentRight}>
                <Text style={[styles.paymentAmount, { color: payment.stato === 'pagato' ? Colors.success : Colors.textPrimary }]}>
                  €{payment.importo.toFixed(2)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.stato) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(payment.stato) }]}>
                    {getStatusLabel(payment.stato)}
                  </Text>
                </View>
              </View>
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
  
  // Total Card - Più compatto
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  totalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  totalInfo: {
    flex: 1,
  },
  totalLabel: {
    fontSize: Typography.fontSize.small,
    color: 'rgba(255,255,255,0.8)',
  },
  totalAmount: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
  },

  // Compact Filter Chips
  filterScrollView: {
    maxHeight: 52,
    marginTop: Spacing.md,
  },
  filterScrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  filterChipText: {
    fontSize: Typography.fontSize.small,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
  },
  filterChipTextActive: {
    color: Colors.surface,
  },
  filterChipBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  filterChipBadgeText: {
    fontSize: Typography.fontSize.tiny,
    fontWeight: Typography.fontWeight.bold,
  },

  // List
  scrollView: {
    flex: 1,
    marginTop: Spacing.md,
  },
  contentContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },

  // Payment Cards
  paymentCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  statusIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  paymentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  paymentInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  paymentDescription: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  paymentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  paymentDate: {
    fontSize: Typography.fontSize.caption,
    color: Colors.textSecondary,
  },
  paymentRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  paymentAmount: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: Typography.fontSize.tiny,
    fontWeight: Typography.fontWeight.bold,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.huge * 2,
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
