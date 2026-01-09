import React, { useEffect, useState } from 'react';
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
  Pressable,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { usersApi } from '../../src/services/api';
import { User, UserRole } from '../../src/types';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Layout } from '../../src/theme';

interface UserFormData {
  nome: string;
  cognome: string;
  email: string;
  password: string;
  ruolo: UserRole;
  note_admin?: string;
}

const initialFormData: UserFormData = {
  nome: '',
  cognome: '',
  email: '',
  password: '',
  ruolo: UserRole.STUDENT,
  note_admin: '',
};

export default function UsersScreen() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'tutti' | UserRole>('tutti');
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // CRUD States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<UserFormData>>({});
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = currentUser?.ruolo === UserRole.ADMIN;

  const fetchUsers = async () => {
    try {
      const allUsers = await usersApi.getAll();
      setUsers(allUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  // CRUD Functions
  const validateForm = (): boolean => {
    const errors: Partial<UserFormData> = {};
    
    if (!formData.nome.trim()) errors.nome = 'Nome richiesto';
    if (!formData.cognome.trim()) errors.cognome = 'Cognome richiesto';
    if (!formData.email.trim()) {
      errors.email = 'Email richiesta';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email non valida';
    }
    if (!showEditModal && !formData.password.trim()) {
      errors.password = 'Password richiesta';
    } else if (!showEditModal && formData.password.length < 6) {
      errors.password = 'Min. 6 caratteri';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenAddModal = () => {
    setFormData(initialFormData);
    setFormErrors({});
    setShowAddModal(true);
  };

  const handleOpenEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      nome: user.nome,
      cognome: user.cognome,
      email: user.email,
      password: '',
      ruolo: user.ruolo as UserRole,
      note_admin: user.note_admin || '',
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleOpenDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleCreateUser = async () => {
    if (!validateForm()) return;
    
    setSubmitting(true);
    try {
      await usersApi.create({
        nome: formData.nome.trim(),
        cognome: formData.cognome.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        ruolo: formData.ruolo,
        note_admin: formData.note_admin?.trim(),
      });
      setShowAddModal(false);
      await fetchUsers();
      Alert.alert('Successo', 'Utente creato con successo');
    } catch (error: any) {
      console.error('Error creating user:', error);
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile creare utente');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!validateForm() || !selectedUser) return;
    
    setSubmitting(true);
    try {
      const updateData: any = {
        nome: formData.nome.trim(),
        cognome: formData.cognome.trim(),
        email: formData.email.trim().toLowerCase(),
        ruolo: formData.ruolo,
        note_admin: formData.note_admin?.trim(),
      };
      if (formData.password.trim()) {
        updateData.password = formData.password;
      }
      await usersApi.update(selectedUser.id, updateData);
      setShowEditModal(false);
      setSelectedUser(null);
      await fetchUsers();
      Alert.alert('Successo', 'Utente aggiornato con successo');
    } catch (error: any) {
      console.error('Error updating user:', error);
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile aggiornare utente');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    setSubmitting(true);
    try {
      await usersApi.delete(selectedUser.id);
      setShowDeleteModal(false);
      setSelectedUser(null);
      await fetchUsers();
      Alert.alert('Successo', 'Utente eliminato con successo');
    } catch (error: any) {
      console.error('Error deleting user:', error);
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile eliminare utente');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case UserRole.ADMIN:
        return Colors.admin;
      case UserRole.TEACHER:
        return Colors.teacher;
      case UserRole.STUDENT:
        return Colors.student;
      default:
        return Colors.textSecondary;
    }
  };

  const getRoleIcon = (role: string): keyof typeof Ionicons.glyphMap => {
    switch (role) {
      case UserRole.ADMIN:
        return 'shield-checkmark';
      case UserRole.TEACHER:
        return 'school';
      case UserRole.STUDENT:
        return 'musical-notes';
      default:
        return 'person';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'Admin';
      case UserRole.TEACHER:
        return 'Insegnante';
      case UserRole.STUDENT:
        return 'Allievo';
      default:
        return role;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.cognome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = selectedRole === 'tutti' || user.ruolo === selectedRole;
    
    return matchesSearch && matchesRole;
  });

  const roleStats = {
    admin: users.filter(u => u.ruolo === UserRole.ADMIN).length,
    teachers: users.filter(u => u.ruolo === UserRole.TEACHER).length,
    students: users.filter(u => u.ruolo === UserRole.STUDENT).length,
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
        <View style={[styles.statCard, { backgroundColor: Colors.admin + '15' }]}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.admin} />
          <Text style={[styles.statNumber, { color: Colors.admin }]}>{roleStats.admin}</Text>
          <Text style={styles.statLabel}>Admin</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.teacher + '15' }]}>
          <Ionicons name="school" size={20} color={Colors.teacher} />
          <Text style={[styles.statNumber, { color: Colors.teacher }]}>{roleStats.teachers}</Text>
          <Text style={styles.statLabel}>Insegnanti</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.student + '15' }]}>
          <Ionicons name="musical-notes" size={20} color={Colors.student} />
          <Text style={[styles.statNumber, { color: Colors.student }]}>{roleStats.students}</Text>
          <Text style={styles.statLabel}>Allievi</Text>
        </View>
      </View>

      {/* Search & Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca utente..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="options" size={20} color={Colors.surface} />
        </TouchableOpacity>
      </View>

      {/* User List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>Nessun utente</Text>
            <Text style={styles.emptyText}>Nessun utente trovato</Text>
          </View>
        ) : (
          filteredUsers.map(user => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userCardContent}>
                <View style={[styles.userIconContainer, { backgroundColor: getRoleColor(user.ruolo) + '15' }]}>
                  <Ionicons name={getRoleIcon(user.ruolo)} size={24} color={getRoleColor(user.ruolo)} />
                </View>
                
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>{user.nome} {user.cognome}</Text>
                  <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleColor(user.ruolo) + '20' }]}>
                    <Text style={[styles.roleText, { color: getRoleColor(user.ruolo) }]}>
                      {getRoleLabel(user.ruolo)}
                    </Text>
                  </View>
                </View>
              </View>
              
              {/* Action Buttons - Only for Admin */}
              {isAdmin && (
                <View style={styles.userActions}>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => handleOpenEditModal(user)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="create-outline" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleOpenDeleteModal(user)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtra per Ruolo</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.filterOption, selectedRole === 'tutti' && styles.filterOptionActive]}
              onPress={() => { setSelectedRole('tutti'); setShowFilterModal(false); }}
              activeOpacity={0.7}
            >
              <Ionicons name="people" size={24} color={selectedRole === 'tutti' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.filterOptionText, selectedRole === 'tutti' && styles.filterOptionTextActive]}>Tutti</Text>
              {selectedRole === 'tutti' && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterOption, selectedRole === UserRole.ADMIN && styles.filterOptionActive]}
              onPress={() => { setSelectedRole(UserRole.ADMIN); setShowFilterModal(false); }}
              activeOpacity={0.7}
            >
              <Ionicons name="shield-checkmark" size={24} color={selectedRole === UserRole.ADMIN ? Colors.admin : Colors.textSecondary} />
              <Text style={[styles.filterOptionText, selectedRole === UserRole.ADMIN && styles.filterOptionTextActive]}>Amministratori</Text>
              {selectedRole === UserRole.ADMIN && <Ionicons name="checkmark" size={20} color={Colors.admin} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterOption, selectedRole === UserRole.TEACHER && styles.filterOptionActive]}
              onPress={() => { setSelectedRole(UserRole.TEACHER); setShowFilterModal(false); }}
              activeOpacity={0.7}
            >
              <Ionicons name="school" size={24} color={selectedRole === UserRole.TEACHER ? Colors.teacher : Colors.textSecondary} />
              <Text style={[styles.filterOptionText, selectedRole === UserRole.TEACHER && styles.filterOptionTextActive]}>Insegnanti</Text>
              {selectedRole === UserRole.TEACHER && <Ionicons name="checkmark" size={20} color={Colors.teacher} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterOption, selectedRole === UserRole.STUDENT && styles.filterOptionActive]}
              onPress={() => { setSelectedRole(UserRole.STUDENT); setShowFilterModal(false); }}
              activeOpacity={0.7}
            >
              <Ionicons name="musical-notes" size={24} color={selectedRole === UserRole.STUDENT ? Colors.student : Colors.textSecondary} />
              <Text style={[styles.filterOptionText, selectedRole === UserRole.STUDENT && styles.filterOptionTextActive]}>Allievi</Text>
              {selectedRole === UserRole.STUDENT && <Ionicons name="checkmark" size={20} color={Colors.student} />}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add User Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
            <Pressable style={styles.formModalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nuovo Utente</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.formScrollView} showsVerticalScrollIndicator={false}>
                {/* Role Selection */}
                <Text style={styles.inputLabel}>Ruolo *</Text>
                <View style={styles.roleSelector}>
                  {[UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN].map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleSelectorOption,
                        formData.ruolo === role && styles.roleSelectorOptionActive,
                        formData.ruolo === role && { borderColor: getRoleColor(role) }
                      ]}
                      onPress={() => setFormData({ ...formData, ruolo: role })}
                    >
                      <Ionicons 
                        name={getRoleIcon(role)} 
                        size={20} 
                        color={formData.ruolo === role ? getRoleColor(role) : Colors.textSecondary} 
                      />
                      <Text style={[
                        styles.roleSelectorText,
                        formData.ruolo === role && { color: getRoleColor(role), fontWeight: Typography.fontWeight.semibold }
                      ]}>
                        {getRoleLabel(role)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Name */}
                <Text style={styles.inputLabel}>Nome *</Text>
                <TextInput
                  style={[styles.formInput, formErrors.nome && styles.inputError]}
                  placeholder="Nome"
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.nome}
                  onChangeText={(text) => setFormData({ ...formData, nome: text })}
                />
                {formErrors.nome && <Text style={styles.errorText}>{formErrors.nome}</Text>}

                {/* Surname */}
                <Text style={styles.inputLabel}>Cognome *</Text>
                <TextInput
                  style={[styles.formInput, formErrors.cognome && styles.inputError]}
                  placeholder="Cognome"
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.cognome}
                  onChangeText={(text) => setFormData({ ...formData, cognome: text })}
                />
                {formErrors.cognome && <Text style={styles.errorText}>{formErrors.cognome}</Text>}

                {/* Email */}
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={[styles.formInput, formErrors.email && styles.inputError]}
                  placeholder="email@esempio.it"
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {formErrors.email && <Text style={styles.errorText}>{formErrors.email}</Text>}

                {/* Password */}
                <Text style={styles.inputLabel}>Password *</Text>
                <TextInput
                  style={[styles.formInput, formErrors.password && styles.inputError]}
                  placeholder="Minimo 6 caratteri"
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  secureTextEntry
                />
                {formErrors.password && <Text style={styles.errorText}>{formErrors.password}</Text>}

                {/* Notes */}
                <Text style={styles.inputLabel}>Note Admin</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Note opzionali..."
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.note_admin}
                  onChangeText={(text) => setFormData({ ...formData, note_admin: text })}
                  multiline
                  numberOfLines={3}
                />

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.buttonDisabled]}
                  onPress={handleCreateUser}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={Colors.surface} />
                  ) : (
                    <>
                      <Ionicons name="person-add" size={20} color={Colors.surface} />
                      <Text style={styles.submitButtonText}>Crea Utente</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowEditModal(false)}>
            <Pressable style={styles.formModalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Modifica Utente</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.formScrollView} showsVerticalScrollIndicator={false}>
                {/* Role Selection */}
                <Text style={styles.inputLabel}>Ruolo *</Text>
                <View style={styles.roleSelector}>
                  {[UserRole.STUDENT, UserRole.TEACHER, UserRole.ADMIN].map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleSelectorOption,
                        formData.ruolo === role && styles.roleSelectorOptionActive,
                        formData.ruolo === role && { borderColor: getRoleColor(role) }
                      ]}
                      onPress={() => setFormData({ ...formData, ruolo: role })}
                    >
                      <Ionicons 
                        name={getRoleIcon(role)} 
                        size={20} 
                        color={formData.ruolo === role ? getRoleColor(role) : Colors.textSecondary} 
                      />
                      <Text style={[
                        styles.roleSelectorText,
                        formData.ruolo === role && { color: getRoleColor(role), fontWeight: Typography.fontWeight.semibold }
                      ]}>
                        {getRoleLabel(role)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Name */}
                <Text style={styles.inputLabel}>Nome *</Text>
                <TextInput
                  style={[styles.formInput, formErrors.nome && styles.inputError]}
                  placeholder="Nome"
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.nome}
                  onChangeText={(text) => setFormData({ ...formData, nome: text })}
                />
                {formErrors.nome && <Text style={styles.errorText}>{formErrors.nome}</Text>}

                {/* Surname */}
                <Text style={styles.inputLabel}>Cognome *</Text>
                <TextInput
                  style={[styles.formInput, formErrors.cognome && styles.inputError]}
                  placeholder="Cognome"
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.cognome}
                  onChangeText={(text) => setFormData({ ...formData, cognome: text })}
                />
                {formErrors.cognome && <Text style={styles.errorText}>{formErrors.cognome}</Text>}

                {/* Email */}
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={[styles.formInput, formErrors.email && styles.inputError]}
                  placeholder="email@esempio.it"
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {formErrors.email && <Text style={styles.errorText}>{formErrors.email}</Text>}

                {/* Password */}
                <Text style={styles.inputLabel}>Nuova Password (opzionale)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Lascia vuoto per non modificare"
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  secureTextEntry
                />

                {/* Notes */}
                <Text style={styles.inputLabel}>Note Admin</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Note opzionali..."
                  placeholderTextColor={Colors.textTertiary}
                  value={formData.note_admin}
                  onChangeText={(text) => setFormData({ ...formData, note_admin: text })}
                  multiline
                  numberOfLines={3}
                />

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.buttonDisabled]}
                  onPress={handleUpdateUser}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={Colors.surface} />
                  ) : (
                    <>
                      <Ionicons name="save" size={20} color={Colors.surface} />
                      <Text style={styles.submitButtonText}>Salva Modifiche</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDeleteModal(false)}>
          <Pressable style={styles.deleteModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.deleteIconContainer}>
              <Ionicons name="warning" size={48} color={Colors.error} />
            </View>
            
            <Text style={styles.deleteModalTitle}>Elimina Utente</Text>
            <Text style={styles.deleteModalText}>
              Sei sicuro di voler eliminare{'\n'}
              <Text style={styles.deleteModalUserName}>
                {selectedUser?.nome} {selectedUser?.cognome}
              </Text>?
            </Text>
            <Text style={styles.deleteModalWarning}>
              Questa azione non può essere annullata.
            </Text>

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDeleteModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.confirmDeleteButton, submitting && styles.buttonDisabled]}
                onPress={handleDeleteUser}
                disabled={submitting}
                activeOpacity={0.7}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={Colors.surface} />
                ) : (
                  <>
                    <Ionicons name="trash" size={18} color={Colors.surface} />
                    <Text style={styles.confirmDeleteButtonText}>Elimina</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Floating Action Button - Only for Admin */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleOpenAddModal}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color={Colors.surface} />
        </TouchableOpacity>
      )}
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
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.xs,
  },
  statLabel: {
    fontSize: Typography.fontSize.tiny,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.body,
    color: Colors.textPrimary,
  },
  filterButton: {
    width: 44,
    height: 44,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  // List
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    minHeight: 88,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  userIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  userName: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  userEmail: {
    fontSize: Typography.fontSize.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: Typography.fontSize.small,
    fontWeight: Typography.fontWeight.medium,
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
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? Spacing.huge : Spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: Spacing.sm,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.background,
    minHeight: 60,
  },
  filterOptionActive: {
    backgroundColor: Colors.primary + '10',
  },
  filterOptionText: {
    flex: 1,
    fontSize: Typography.fontSize.body,
    color: Colors.textPrimary,
    marginLeft: Spacing.lg,
  },
  filterOptionTextActive: {
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary,
  },

  // User Card with Actions
  userCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: Colors.primary + '15',
  },
  deleteButton: {
    backgroundColor: Colors.error + '15',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  // Form Modal
  formModalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? Spacing.huge : Spacing.xl,
    maxHeight: '90%',
  },
  formScrollView: {
    flexGrow: 0,
  },
  inputLabel: {
    fontSize: Typography.fontSize.caption,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  formInput: {
    height: Layout.inputHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.fontSize.body,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
  },
  inputError: {
    borderColor: Colors.error,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: Spacing.md,
  },
  errorText: {
    fontSize: Typography.fontSize.small,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  roleSelectorOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    minHeight: 70,
  },
  roleSelectorOptionActive: {
    backgroundColor: Colors.surface,
    borderWidth: 2,
  },
  roleSelectorText: {
    fontSize: Typography.fontSize.small,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    height: Layout.buttonHeight,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  submitButtonText: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.surface,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Delete Modal
  deleteModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    margin: Spacing.xl,
    alignItems: 'center',
  },
  deleteIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  deleteModalTitle: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  deleteModalText: {
    fontSize: Typography.fontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  deleteModalUserName: {
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
  },
  deleteModalWarning: {
    fontSize: Typography.fontSize.caption,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    height: Layout.buttonHeight,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
  },
  confirmDeleteButton: {
    flex: 1,
    flexDirection: 'row',
    height: Layout.buttonHeight,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.error,
    gap: Spacing.sm,
  },
  confirmDeleteButtonText: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.surface,
  },
});