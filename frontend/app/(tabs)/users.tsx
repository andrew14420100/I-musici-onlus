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
import { User, UserRole, UserStatus } from '../../src/types';
import { UserCard } from '../../src/components/UserCard';

export default function UsersScreen() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'studente' | 'insegnante'>('studente');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'studente' as string,
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
    fetchUsers();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, []);

  const filteredUsers = users.filter(u => {
    const matchesTab = u.role === activeTab;
    const matchesSearch = searchQuery === '' || 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const openCreateModal = (role: 'studente' | 'insegnante') => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: role,
    });
    setModalVisible(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      if (editingUser) {
        await usersApi.update(editingUser.user_id, {
          name: formData.name,
          phone: formData.phone || undefined,
        });
      } else {
        await usersApi.create({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || undefined,
          role: formData.role,
        });
      }
      setModalVisible(false);
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = user.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
      await usersApi.update(user.user_id, { status: newStatus });
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
    }
  };

  if (currentUser?.role !== UserRole.ADMIN) {
    return (
      <View style={styles.noAccessContainer}>
        <Ionicons name="lock-closed" size={64} color="#ccc" />
        <Text style={styles.noAccessText}>Accesso riservato agli amministratori</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  const studentsCount = users.filter(u => u.role === 'studente').length;
  const teachersCount = users.filter(u => u.role === 'insegnante').length;

  return (
    <View style={styles.container}>
      {/* Action Buttons */}
      <View style={styles.actionsBar}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => openCreateModal('studente')}
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
          style={[styles.tab, activeTab === 'studente' && styles.activeTab]}
          onPress={() => setActiveTab('studente')}
        >
          <Text style={[styles.tabText, activeTab === 'studente' && styles.activeTabText]}>
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
              {searchQuery ? 'Nessun risultato' : `Nessun ${activeTab === 'studente' ? 'allievo' : 'insegnante'}`}
            </Text>
          </View>
        ) : (
          filteredUsers.map(user => (
            <UserCard
              key={user.user_id}
              user={user}
              onEdit={() => openEditModal(user)}
              onToggleStatus={() => handleToggleStatus(user)}
            />
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Modal */}
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
                {editingUser ? 'Modifica Utente' : `Nuovo ${formData.role === 'studente' ? 'Allievo' : 'Insegnante'}`}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nome *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Nome completo"
              />
            </View>

            {!editingUser && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="email@esempio.it"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Telefono</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="+39 xxx xxx xxxx"
                keyboardType="phone-pad"
              />
            </View>

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
  noAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noAccessText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  actionsBar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 10,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
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
  saveButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
