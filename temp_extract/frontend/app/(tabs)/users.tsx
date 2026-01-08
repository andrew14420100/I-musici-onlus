import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { usersApi } from '../../src/services/api';
import { User } from '../../src/types';

export default function UsersScreen() {
  const { user: currentUser, isInitialized } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'allievo' | 'insegnante'>('allievo');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    password: '',
    ruolo: 'allievo' as string,
    note_admin: '',
  });

  const fetchUsers = async () => {
    try {
      const data = await usersApi.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.ruolo === 'amministratore') {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, []);

  const filteredUsers = users.filter(u => {
    const matchesTab = u.ruolo === activeTab;
    const fullName = `${u.nome} ${u.cognome}`.toLowerCase();
    const matchesSearch = searchQuery === '' || 
      fullName.includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const openCreateModal = (ruolo: 'allievo' | 'insegnante') => {
    setEditingUser(null);
    setFormData({
      nome: '',
      cognome: '',
      email: '',
      password: '',
      ruolo: ruolo,
      note_admin: '',
    });
    setModalVisible(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      nome: user.nome,
      cognome: user.cognome,
      email: user.email,
      password: '', // Password non mostrata in modifica
      ruolo: user.ruolo,
      note_admin: user.note_admin || '',
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    // Validazione
    if (!formData.nome.trim() || !formData.cognome.trim()) {
      Alert.alert('Errore', 'Nome e cognome sono obbligatori');
      return;
    }
    if (!editingUser && !formData.email.trim()) {
      Alert.alert('Errore', 'Email è obbligatoria');
      return;
    }
    if (!editingUser && !formData.password.trim()) {
      Alert.alert('Errore', 'Password è obbligatoria per i nuovi utenti');
      return;
    }
    if (!editingUser && formData.password.length < 6) {
      Alert.alert('Errore', 'La password deve essere di almeno 6 caratteri');
      return;
    }

    try {
      if (editingUser) {
        // Modifica utente esistente
        const updateData: any = {
          nome: formData.nome,
          cognome: formData.cognome,
          note_admin: formData.note_admin || undefined,
        };
        // Aggiungi password solo se inserita
        if (formData.password.trim()) {
          updateData.password = formData.password;
        }
        await usersApi.update(editingUser.id, updateData);
        Alert.alert('Successo', 'Utente modificato con successo');
      } else {
        // Crea nuovo utente
        await usersApi.create({
          ruolo: formData.ruolo,
          nome: formData.nome,
          cognome: formData.cognome,
          email: formData.email,
          password: formData.password,
          note_admin: formData.note_admin || undefined,
        });
        Alert.alert('Successo', `${formData.ruolo === 'allievo' ? 'Allievo' : 'Insegnante'} creato con successo`);
      }
      setModalVisible(false);
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = !user.attivo;
      await usersApi.update(user.id, { attivo: newStatus });
      Alert.alert('Successo', `Utente ${newStatus ? 'attivato' : 'disattivato'}`);
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
    }
  };

  const handleDelete = async (user: User) => {
    Alert.alert(
      'Conferma eliminazione',
      `Sei sicuro di voler eliminare ${user.nome} ${user.cognome}?`,
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Elimina', 
          style: 'destructive',
          onPress: async () => {
            try {
              await usersApi.delete(user.id);
              Alert.alert('Successo', 'Utente eliminato');
              fetchUsers();
            } catch (error: any) {
              Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
            }
          }
        },
      ]
    );
  };

  // Loading state
  if (!isInitialized || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  // Access control
  if (currentUser?.ruolo !== 'amministratore') {
    return (
      <View style={styles.noAccessContainer}>
        <Ionicons name="lock-closed" size={64} color="#ccc" />
        <Text style={styles.noAccessText}>Accesso riservato agli amministratori</Text>
      </View>
    );
  }

  const studentsCount = users.filter(u => u.ruolo === 'allievo').length;
  const teachersCount = users.filter(u => u.ruolo === 'insegnante').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestione Utenti</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsBar}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => openCreateModal('allievo')}
        >
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Nuovo Allievo</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#10B981' }]} 
          onPress={() => openCreateModal('insegnante')}
        >
          <Ionicons name="school" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Nuovo Insegnante</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'allievo' && styles.activeTab]}
          onPress={() => setActiveTab('allievo')}
        >
          <Text style={[styles.tabText, activeTab === 'allievo' && styles.activeTabText]}>
            Allievi ({studentsCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'insegnante' && styles.activeTab]}
          onPress={() => setActiveTab('insegnante')}
        >
          <Text style={[styles.tabText, activeTab === 'insegnante' && styles.activeTabText]}>
            Insegnanti ({teachersCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca per nome o email..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Users List */}
      <ScrollView 
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'Nessun risultato' : `Nessun ${activeTab === 'allievo' ? 'allievo' : 'insegnante'}`}
            </Text>
          </View>
        ) : (
          filteredUsers.map(user => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {user.nome.charAt(0)}{user.cognome.charAt(0)}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.nome} {user.cognome}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                <View style={[styles.statusBadge, { backgroundColor: user.attivo ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={[styles.statusText, { color: user.attivo ? '#065F46' : '#DC2626' }]}>
                    {user.attivo ? 'Attivo' : 'Disattivato'}
                  </Text>
                </View>
              </View>
              <View style={styles.userActions}>
                <TouchableOpacity 
                  style={styles.userActionBtn}
                  onPress={() => openEditModal(user)}
                >
                  <Ionicons name="pencil" size={18} color="#4A90D9" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.userActionBtn}
                  onPress={() => handleToggleStatus(user)}
                >
                  <Ionicons 
                    name={user.attivo ? 'pause-circle' : 'play-circle'} 
                    size={18} 
                    color={user.attivo ? '#F59E0B' : '#10B981'} 
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.userActionBtn}
                  onPress={() => handleDelete(user)}
                >
                  <Ionicons name="trash" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

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
                {editingUser ? 'Modifica Utente' : `Nuovo ${formData.ruolo === 'allievo' ? 'Allievo' : 'Insegnante'}`}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Nome *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.nome}
                  onChangeText={(text) => setFormData({ ...formData, nome: text })}
                  placeholder="Mario"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Cognome *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.cognome}
                  onChangeText={(text) => setFormData({ ...formData, cognome: text })}
                  placeholder="Rossi"
                />
              </View>

              {!editingUser && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Email *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                    placeholder="mario.rossi@email.it"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              )}

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Password {editingUser ? '(lascia vuoto per non modificare)' : '*'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  placeholder={editingUser ? '••••••••' : 'Minimo 6 caratteri'}
                  secureTextEntry
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Note amministratore</Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                  value={formData.note_admin}
                  onChangeText={(text) => setFormData({ ...formData, note_admin: text })}
                  placeholder="Note interne (opzionale)"
                  multiline
                />
              </View>

              {editingUser && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={18} color="#4A90D9" />
                  <Text style={styles.infoBoxText}>
                    Email: {editingUser.email}
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
                  {editingUser ? 'Salva Modifiche' : 'Crea Utente'}
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
  noAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 20,
  },
  noAccessText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#4A90D9',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  actionsBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
  },
  actionButton: {
    flex: 1,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 15,
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4A90D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  userActionBtn: {
    padding: 8,
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
