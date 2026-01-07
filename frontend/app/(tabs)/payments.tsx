import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { paymentsApi, usersApi } from '../../src/services/api';
import { Payment, User, UserRole, PaymentStatus, PaymentType } from '../../src/types';
import { PaymentCard } from '../../src/components/PaymentCard';

export default function PaymentsScreen() {
  const { user: currentUser } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'quota_studente' | 'compenso_insegnante'>('quota_studente');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState({
    user_id: '',
    payment_type: 'quota_studente' as string,
    amount: '',
    description: '',
    due_date: new Date().toISOString().split('T')[0],
  });

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const fetchData = async () => {
    try {
      const [paymentsData, usersData] = await Promise.all([
        paymentsApi.getAll(),
        isAdmin ? usersApi.getAll() : Promise.resolve([]),
      ]);
      setPayments(paymentsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const getUserName = (userId: string) => {
    const user = users.find(u => u.user_id === userId);
    return user?.name || 'Sconosciuto';
  };

  const students = users.filter(u => u.role === UserRole.STUDENT);
  const teachers = users.filter(u => u.role === UserRole.TEACHER);

  // Filter payments
  const filteredPayments = payments.filter(p => {
    const matchesTab = p.payment_type === activeTab;
    const matchesStatus = statusFilter === '' || p.status === statusFilter;
    return matchesTab && matchesStatus;
  });

  // Stats
  const totalPending = filteredPayments
    .filter(p => p.status !== PaymentStatus.PAID)
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = filteredPayments
    .filter(p => p.status === PaymentStatus.PAID)
    .reduce((sum, p) => sum + p.amount, 0);

  const openModal = (payment?: Payment) => {
    if (payment) {
      setEditingPayment(payment);
      setFormData({
        user_id: payment.user_id,
        payment_type: payment.payment_type,
        amount: payment.amount.toString(),
        description: payment.description,
        due_date: payment.due_date.split('T')[0],
      });
    } else {
      setEditingPayment(null);
      const defaultUsers = activeTab === 'quota_studente' ? students : teachers;
      setFormData({
        user_id: defaultUsers[0]?.user_id || '',
        payment_type: activeTab,
        amount: '',
        description: '',
        due_date: new Date().toISOString().split('T')[0],
      });
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.user_id || !formData.amount || !formData.description) {
      Alert.alert('Errore', 'Tutti i campi sono obbligatori');
      return;
    }
    try {
      if (editingPayment) {
        await paymentsApi.update(editingPayment.payment_id, {
          amount: parseFloat(formData.amount),
          description: formData.description,
          due_date: new Date(formData.due_date).toISOString(),
        });
      } else {
        await paymentsApi.create({
          user_id: formData.user_id,
          payment_type: formData.payment_type,
          amount: parseFloat(formData.amount),
          description: formData.description,
          due_date: new Date(formData.due_date).toISOString(),
        });
      }
      setModalVisible(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si \u00e8 verificato un errore');
    }
  };

  const handleMarkPaid = async (paymentId: string) => {
    Alert.alert(
      'Conferma',
      'Vuoi segnare questo pagamento come pagato?',
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Conferma', 
          onPress: async () => {
            try {
              await paymentsApi.update(paymentId, { status: PaymentStatus.PAID });
              fetchData();
            } catch (error: any) {
              Alert.alert('Errore', error.response?.data?.detail || 'Si \u00e8 verificato un errore');
            }
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Admin only: Create button and tabs */}
      {isAdmin && (
        <>
          <View style={styles.actionsBar}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => openModal()}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>
                {activeTab === 'quota_studente' ? 'Nuova Quota' : 'Nuovo Compenso'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'quota_studente' && styles.activeTab]}
              onPress={() => setActiveTab('quota_studente')}
            >
              <Text style={[styles.tabText, activeTab === 'quota_studente' && styles.activeTabText]}>
                Quote Allievi
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'compenso_insegnante' && styles.activeTab]}
              onPress={() => setActiveTab('compenso_insegnante')}
            >
              <Text style={[styles.tabText, activeTab === 'compenso_insegnante' && styles.activeTabText]}>
                Compensi Insegnanti
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: '#FEF3C7' }]}>
          <Text style={styles.summaryLabel}>In Attesa</Text>
          <Text style={[styles.summaryValue, { color: '#F59E0B' }]}>
            €{totalPending.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#D1FAE5' }]}>
          <Text style={styles.summaryLabel}>Pagato</Text>
          <Text style={[styles.summaryValue, { color: '#10B981' }]}>
            €{totalPaid.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Status Filter */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filtra per stato:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === '' && styles.filterChipActive]}
            onPress={() => setStatusFilter('')}
          >
            <Text style={[styles.filterChipText, statusFilter === '' && styles.filterChipTextActive]}>Tutti</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'in_attesa' && styles.filterChipActive]}
            onPress={() => setStatusFilter('in_attesa')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'in_attesa' && styles.filterChipTextActive]}>In Attesa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'pagato' && styles.filterChipActive]}
            onPress={() => setStatusFilter('pagato')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'pagato' && styles.filterChipTextActive]}>Pagato</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'scaduto' && styles.filterChipActive]}
            onPress={() => setStatusFilter('scaduto')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'scaduto' && styles.filterChipTextActive]}>Scaduto</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Payments List */}
      <ScrollView 
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredPayments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="card-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nessun pagamento trovato</Text>
          </View>
        ) : (
          filteredPayments.map(payment => (
            <PaymentCard
              key={payment.payment_id}
              payment={payment}
              userName={isAdmin ? getUserName(payment.user_id) : undefined}
              onEdit={isAdmin ? () => openModal(payment) : undefined}
              onMarkPaid={isAdmin ? () => handleMarkPaid(payment.payment_id) : undefined}
            />
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingPayment ? 'Modifica Pagamento' : 
                  activeTab === 'quota_studente' ? 'Nuova Quota' : 'Nuovo Compenso'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {!editingPayment && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    {activeTab === 'quota_studente' ? 'Allievo *' : 'Insegnante *'}
                  </Text>
                  <View style={styles.pickerContainer}>
                    {(activeTab === 'quota_studente' ? students : teachers).map(user => (
                      <TouchableOpacity
                        key={user.user_id}
                        style={[
                          styles.pickerOption,
                          formData.user_id === user.user_id && styles.pickerOptionSelected
                        ]}
                        onPress={() => setFormData({ ...formData, user_id: user.user_id })}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          formData.user_id === user.user_id && styles.pickerOptionTextSelected
                        ]}>{user.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.label}>Importo (€) *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.amount}
                  onChangeText={(text) => setFormData({ ...formData, amount: text })}
                  placeholder="es. 150.00"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descrizione *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="es. Quota mensile Luglio 2025"
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Data Scadenza *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.due_date}
                  onChangeText={(text) => setFormData({ ...formData, due_date: text })}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>
                  {editingPayment ? 'Salva Modifiche' : 'Crea Pagamento'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
  },
  actionsBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90D9',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4A90D9',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#4A90D9',
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  filterContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  filterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#4A90D9',
  },
  filterChipText: {
    fontSize: 13,
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  pickerOptionSelected: {
    backgroundColor: '#4A90D9',
  },
  pickerOptionText: {
    fontSize: 13,
    color: '#333',
  },
  pickerOptionTextSelected: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
