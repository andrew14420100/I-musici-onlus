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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Total Card */}
        <View style={styles.totalCard}>
          <View style={styles.totalIconContainer}>
            <Ionicons name="cash" size={28} color={Colors.surface} />
          </View>
          <View style={styles.totalInfo}>
            <Text style={styles.totalLabel}>Totale Pagamenti</Text>
            <Text style={styles.totalAmount}>€{stats.totale.toFixed(2)}</Text>
          </View>
        </View>

        {/* Filters - MIGLIORATI per mobile */}
        <View style={styles.filtersContainer}>
          <Text style={styles.filtersTitle}>Filtra per Stato</Text>
          <View style={styles.filtersGrid}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filter === 'tutti' && styles.filterButtonActive,
                { backgroundColor: filter === 'tutti' ? Colors.primary : Colors.surface }
              ]}
              onPress={() => setFilter('tutti')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="list" 
                size={20} 
                color={filter === 'tutti' ? Colors.surface : Colors.textPrimary} 
              />
              <Text style={[
                styles.filterButtonText,
                filter === 'tutti' && styles.filterButtonTextActive
              ]}>Tutti</Text>
              <View style={[
                styles.filterBadge,
                { backgroundColor: filter === 'tutti' ? 'rgba(255,255,255,0.3)' : Colors.background }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: filter === 'tutti' ? Colors.surface : Colors.textPrimary }
                ]}>{payments.length}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterButton,
                filter === 'pagato' && styles.filterButtonActive,
                { backgroundColor: filter === 'pagato' ? Colors.success : Colors.surface }
              ]}
              onPress={() => setFilter('pagato')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="checkmark-circle" 
                size={20} 
                color={filter === 'pagato' ? Colors.surface : Colors.success} 
              />
              <Text style={[
                styles.filterButtonText,
                filter === 'pagato' && styles.filterButtonTextActive
              ]}>Pagati</Text>
              <View style={[
                styles.filterBadge,
                { backgroundColor: filter === 'pagato' ? 'rgba(255,255,255,0.3)' : Colors.successLight }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: filter === 'pagato' ? Colors.surface : Colors.success }
                ]}>{stats.pagati}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterButton,
                filter === 'in_attesa' && styles.filterButtonActive,
                { backgroundColor: filter === 'in_attesa' ? Colors.warning : Colors.surface }
              ]}
              onPress={() => setFilter('in_attesa')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="time" 
                size={20} 
                color={filter === 'in_attesa' ? Colors.surface : Colors.warning} 
              />
              <Text style={[
                styles.filterButtonText,
                filter === 'in_attesa' && styles.filterButtonTextActive
              ]}>In Attesa</Text>
              <View style={[
                styles.filterBadge,
                { backgroundColor: filter === 'in_attesa' ? 'rgba(255,255,255,0.3)' : Colors.warningLight }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: filter === 'in_attesa' ? Colors.surface : Colors.warning }
                ]}>{stats.inAttesa}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterButton,
                filter === 'scaduto' && styles.filterButtonActive,
                { backgroundColor: filter === 'scaduto' ? Colors.error : Colors.surface }
              ]}
              onPress={() => setFilter('scaduto')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="alert-circle" 
                size={20} 
                color={filter === 'scaduto' ? Colors.surface : Colors.error} 
              />
              <Text style={[
                styles.filterButtonText,
                filter === 'scaduto' && styles.filterButtonTextActive
              ]}>Scaduti</Text>
              <View style={[
                styles.filterBadge,
                { backgroundColor: filter === 'scaduto' ? 'rgba(255,255,255,0.3)' : Colors.errorLight }
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  { color: filter === 'scaduto' ? Colors.surface : Colors.error }
                ]}>{stats.scaduti}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Payment List */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>
            {filter === 'tutti' ? 'Tutti i Pagamenti' : 
             filter === 'pagato' ? 'Pagamenti Completati' :
             filter === 'in_attesa' ? 'In Attesa di Pagamento' :
             'Pagamenti Scaduti'}
          </Text>
          
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
        </View>
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: Spacing.xxl,
  },
  
  // Total Card
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    margin: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  totalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  totalInfo: {
    flex: 1,
  },
  totalLabel: {
    fontSize: Typography.fontSize.caption,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: Spacing.xs,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
  },

  // Filters - MIGLIORATI
  filtersContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  filtersTitle: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  filtersGrid: {
    gap: Spacing.md,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    minHeight: 60,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  filterButtonActive: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  filterButtonText: {
    flex: 1,
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginLeft: Spacing.md,
  },
  filterButtonTextActive: {
    color: Colors.surface,
  },
  filterBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  filterBadgeText: {
    fontSize: Typography.fontSize.caption,
    fontWeight: Typography.fontWeight.bold,
  },

  // List Section
  listSection: {
    paddingHorizontal: Spacing.lg,
  },
  listTitle: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },

  // Payment Cards
  paymentCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  statusIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  paymentIconContainer: {
    width: 48,
    height: 48,
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
    marginBottom: Spacing.sm,
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
    marginBottom: Spacing.sm,
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