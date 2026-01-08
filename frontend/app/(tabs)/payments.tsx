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
import { Payment, User, PaymentStatus } from '../../src/types';

export default function PaymentsScreen() {
  const { user: currentUser, isInitialized } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'quota_studente' | 'compenso_insegnante'>('quota_studente');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [formData, setFormData] = useState({
    utente_id: '',
    tipo: 'quota_studente' as string,
    importo: '',
    descrizione: '',
    data_scadenza: new Date().toISOString().split('T')[0],
  });

  const isAdmin = currentUser?.ruolo === 'amministratore';

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
    if (currentUser) {
      fetchData();
    }
  }, [currentUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.nome} ${user.cognome}` : 'Sconosciuto';
  };

  const students = users.filter(u => u.ruolo === 'allievo');
  const teachers = users.filter(u => u.ruolo === 'insegnante');

  const filteredPayments = payments.filter(p => {
    const matchesTab = p.tipo === activeTab;
    const matchesStatus = statusFilter === '' || p.stato === statusFilter;
    return matchesTab && matchesStatus;
  });

  const totalPending = filteredPayments
    .filter(p => p.stato !== PaymentStatus.PAID)
    .reduce((sum, p) => sum + p.importo, 0);
  const totalPaid = filteredPayments
    .filter(p => p.stato === PaymentStatus.PAID)
    .reduce((sum, p) => sum + p.importo, 0);

  const openModal = (payment?: Payment) => {
    if (payment) {
      setEditingPayment(payment);
      setFormData({
        utente_id: payment.utente_id,
        tipo: payment.tipo,
        importo: payment.importo.toString(),
        descrizione: payment.descrizione,
        data_scadenza: payment.data_scadenza.split('T')[0],
      });
    } else {
      setEditingPayment(null);
      const defaultUsers = activeTab === 'quota_studente' ? students : teachers;
      setFormData({
        utente_id: defaultUsers[0]?.id || '',
        tipo: activeTab,
        importo: '',
        descrizione: '',
        data_scadenza: new Date().toISOString().split('T')[0],
      });
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.utente_id || !formData.importo || !formData.descrizione) {
      Alert.alert('Errore', 'Tutti i campi sono obbligatori');
      return;
    }
    try {
      if (editingPayment) {
        await paymentsApi.update(editingPayment.id, {
          importo: parseFloat(formData.importo),
          descrizione: formData.descrizione,
          data_scadenza: formData.data_scadenza,
        });
        Alert.alert('Successo', 'Pagamento aggiornato');
      } else {
        await paymentsApi.create({
          utente_id: formData.utente_id,
          tipo: formData.tipo,
          importo: parseFloat(formData.importo),
          descrizione: formData.descrizione,
          data_scadenza: formData.data_scadenza,
        });
        Alert.alert('Successo', 'Pagamento creato');
      }
      setModalVisible(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
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
              await paymentsApi.update(paymentId, { stato: PaymentStatus.PAID });
              Alert.alert('Successo', 'Pagamento segnato come pagato');
              fetchData();
            } catch (error: any) {
              Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
            }
          }
        },
      ]
    );
  };

  const openDeleteModal = (payment: Payment) => {
    setPaymentToDelete(payment);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!paymentToDelete) return;
    try {
      await paymentsApi.delete(paymentToDelete.id);
      setDeleteModalVisible(false);
      setPaymentToDelete(null);
      Alert.alert('Eliminato!', 'Il pagamento è stato rimosso');
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
    }
  };

  const getStatusColor = (stato: string) => {
    switch (stato) {
      case 'pagato': return { bg: '#D1FAE5', text: '#065F46' };
      case 'in_attesa': return { bg: '#FEF3C7', text: '#92400E' };
      case 'scaduto': return { bg: '#FEE2E2', text: '#DC2626' };
      default: return { bg: '#E5E7EB', text: '#666' };
    }
  };

  const getStatusLabel = (stato: string) => {
    switch (stato) {
      case 'pagato': return 'Pagato';
      case 'in_attesa': return 'In Attesa';
      case 'scaduto': return 'Scaduto';
      default: return stato;
    }
  };

  if (!isInitialized || loading) {
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
            <Ionicons name="wallet-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nessun pagamento trovato</Text>
          </View>
        ) : (
          filteredPayments.map(payment => {
            const statusColors = getStatusColor(payment.stato);
            return (
              <View key={payment.id} style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentUser}>{getUserName(payment.utente_id)}</Text>
                    <Text style={styles.paymentDesc}>{payment.descrizione}</Text>
                    <Text style={styles.paymentDate}>
                      Scadenza: {new Date(payment.data_scadenza).toLocaleDateString('it-IT')}
                    </Text>
                  </View>
                  <View style={styles.paymentRight}>
                    <Text style={styles.paymentAmount}>€{payment.importo.toFixed(2)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                      <Text style={[styles.statusText, { color: statusColors.text }]}>
                        {getStatusLabel(payment.stato)}
                      </Text>
                    </View>
                  </View>
                </View>
                
                {isAdmin && (
                  <View style={styles.paymentActions}>
                    {payment.stato !== 'pagato' && (
                      <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: '#D1FAE5' }]}
                        onPress={() => handleMarkPaid(payment.id)}
                      >
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Pagato</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: '#EBF5FF' }]}
                      onPress={() => openModal(payment)}
                    >
                      <Ionicons name="pencil" size={16} color="#4A90D9" />
                      <Text style={[styles.actionBtnText, { color: '#4A90D9' }]}>Modifica</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
                      onPress={() => openDeleteModal(payment)}
                    >
                      <Ionicons name="trash" size={16} color="#EF4444" />
                      <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Elimina</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteIconContainer}>
              <Ionicons name="receipt" size={40} color="#EF4444" />
            </View>
            <Text style={styles.deleteModalTitle}>Eliminare pagamento?</Text>
            <Text style={styles.deleteModalAmount}>
              €{paymentToDelete?.importo.toFixed(2)}
            </Text>
            <Text style={styles.deleteModalDesc}>
              {paymentToDelete?.descrizione}
            </Text>
            <Text style={styles.deleteModalMessage}>
              Questa azione non può essere annullata.
            </Text>
            <View style={styles.deleteModalActions}>
              <TouchableOpacity 
                style={styles.deleteModalCancel}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.deleteModalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteModalConfirm}
                onPress={confirmDelete}
              >
                <Ionicons name="trash" size={18} color="#fff" />
                <Text style={styles.deleteModalConfirmText}>Elimina</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Create/Edit */}
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
                {editingPayment ? 'Modifica Pagamento' : 'Nuovo Pagamento'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              {!editingPayment && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Utente *</Text>
                  <View style={styles.pickerContainer}>
                    {(activeTab === 'quota_studente' ? students : teachers).map(user => (
                      <TouchableOpacity
                        key={user.id}
                        style={[
                          styles.pickerOption,
                          formData.utente_id === user.id && styles.pickerOptionSelected
                        ]}
                        onPress={() => setFormData({ ...formData, utente_id: user.id })}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          formData.utente_id === user.id && styles.pickerOptionTextSelected
                        ]}>
                          {user.nome} {user.cognome}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.label}>Importo (€) *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.importo}
                  onChangeText={(text) => setFormData({ ...formData, importo: text.replace(/[^0-9.]/g, '') })}
                  placeholder="150.00"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descrizione *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.descrizione}
                  onChangeText={(text) => setFormData({ ...formData, descrizione: text })}
                  placeholder="Es: Quota mensile Gennaio 2025"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Data Scadenza *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.data_scadenza}
                  onChangeText={(text) => setFormData({ ...formData, data_scadenza: text })}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              {editingPayment && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={18} color="#4A90D9" />
                  <Text style={styles.infoBoxText}>
                    Utente: {getUserName(editingPayment.utente_id)}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>
                  {editingPayment ? 'Salva' : 'Crea'}
                </Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#F8FAFC',
  },
  actionsBar: {
    padding: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90D9',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4A90D9',
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  filterContainer: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
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
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
    marginTop: 12,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentUser: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  paymentDesc: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  paymentDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  paymentRight: {
    alignItems: 'flex-end',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  paymentActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  deleteIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  deleteModalAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 4,
  },
  deleteModalDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalMessage: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  deleteModalCancelText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '600',
  },
  deleteModalConfirm: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteModalConfirmText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  formScroll: {
    padding: 16,
    maxHeight: 400,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerOptionSelected: {
    backgroundColor: '#4A90D9',
    borderColor: '#4A90D9',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#333',
  },
  pickerOptionTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FF',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#4A90D9',
    marginLeft: 8,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});
