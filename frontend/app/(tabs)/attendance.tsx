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
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { attendanceApi, usersApi } from '../../src/services/api';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../src/theme';
import { formatDateForDisplay, getTodayForDisplay, convertDisplayToAPI, convertAPIToDisplay } from '../../src/utils/dateFormat';
import { UserRole, AttendanceStatus, User, Attendance } from '../../src/types';

// Status options for the dropdown
const ATTENDANCE_STATUS_OPTIONS = [
  { value: AttendanceStatus.PRESENT, label: 'Presente', icon: 'checkmark-circle', color: Colors.success },
  { value: AttendanceStatus.ABSENT_JUSTIFIED, label: 'Assente con giustificazione', icon: 'document-text', color: Colors.warning },
  { value: AttendanceStatus.ABSENT_UNJUSTIFIED, label: 'Assente senza giustificazione', icon: 'close-circle', color: Colors.error },
  { value: AttendanceStatus.MAKEUP, label: 'Recupero', icon: 'refresh-circle', color: Colors.info },
];

export default function AttendanceScreen() {
  const { user } = useAuth();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
  
  // Form states
  const [formData, setFormData] = useState({
    allievo_id: '',
    data: getTodayForDisplay(),
    stato: AttendanceStatus.PRESENT as string,
    recupero_data: '',
    note: '',
  });
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.ruolo === UserRole.ADMIN;
  const isTeacher = user?.ruolo === UserRole.TEACHER;
  const isStudent = user?.ruolo === UserRole.STUDENT;
  const canAdd = isAdmin || isTeacher;
  const canEdit = isAdmin; // Solo admin può modificare
  const canDelete = isAdmin; // Solo admin può eliminare

  const fetchAttendances = useCallback(async () => {
    try {
      const data = await attendanceApi.getAll();
      setAttendances(data);
    } catch (error) {
      console.error('Error fetching attendances:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStudents = useCallback(async () => {
    if (!canAdd) return;
    try {
      const data = await usersApi.getAll(UserRole.STUDENT);
      setStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  }, [canAdd]);

  useEffect(() => {
    fetchAttendances();
    fetchStudents();
  }, [fetchAttendances, fetchStudents]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAttendances();
    setRefreshing(false);
  };

  const resetForm = () => {
    setFormData({
      allievo_id: '',
      data: new Date().toISOString().split('T')[0],
      stato: AttendanceStatus.PRESENT,
      recupero_data: '',
      note: '',
    });
    setEditingAttendance(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (attendance: Attendance) => {
    if (!canEdit) {
      Alert.alert(
        'Modifica non consentita',
        'Solo l\'amministratore può modificare le presenze. Contattare la segreteria per eventuali modifiche.',
        [{ text: 'OK' }]
      );
      return;
    }
    setEditingAttendance(attendance);
    setFormData({
      allievo_id: attendance.allievo_id,
      data: attendance.data?.split('T')[0] || '',
      stato: attendance.stato,
      recupero_data: attendance.recupero_data?.split('T')[0] || '',
      note: attendance.note || '',
    });
    setModalVisible(true);
  };

  const openDeleteModal = (attendance: Attendance) => {
    if (!canDelete) {
      Alert.alert(
        'Eliminazione non consentita',
        'Solo l\'amministratore può eliminare le presenze. Contattare la segreteria.',
        [{ text: 'OK' }]
      );
      return;
    }
    setSelectedAttendance(attendance);
    setDeleteModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!formData.allievo_id) {
      Alert.alert('Errore', 'Seleziona un allievo');
      return;
    }
    if (!formData.data) {
      Alert.alert('Errore', 'Inserisci la data');
      return;
    }

    setSubmitting(true);
    try {
      if (editingAttendance) {
        // Update
        await attendanceApi.update(editingAttendance.id, {
          stato: formData.stato,
          note: formData.note,
          recupero_data: formData.recupero_data || undefined,
        });
        Alert.alert('Successo', 'Presenza aggiornata con successo');
      } else {
        // Create
        await attendanceApi.create({
          allievo_id: formData.allievo_id,
          data: formData.data,
          stato: formData.stato,
          note: formData.note || undefined,
        });
        Alert.alert('Successo', 'Presenza registrata con successo');
      }
      setModalVisible(false);
      resetForm();
      fetchAttendances();
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante il salvataggio');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAttendance) return;

    setSubmitting(true);
    try {
      await attendanceApi.delete(selectedAttendance.id);
      Alert.alert('Successo', 'Presenza eliminata');
      setDeleteModalVisible(false);
      setSelectedAttendance(null);
      fetchAttendances();
    } catch (error: any) {
      console.error('Error deleting attendance:', error);
      Alert.alert('Errore', error.response?.data?.detail || 'Errore durante l\'eliminazione');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusInfo = (stato: string) => {
    const option = ATTENDANCE_STATUS_OPTIONS.find(o => o.value === stato);
    return option || { label: stato, icon: 'help-circle', color: Colors.textSecondary };
  };

  const getStudentName = (allievoId: string) => {
    const student = students.find(s => s.id === allievoId);
    return student ? `${student.nome} ${student.cognome}` : 'Allievo';
  };

  // Count stats
  const stats = {
    presenti: attendances.filter(a => a.stato === AttendanceStatus.PRESENT).length,
    assentiGiustificati: attendances.filter(a => a.stato === AttendanceStatus.ABSENT_JUSTIFIED).length,
    assentiNonGiustificati: attendances.filter(a => a.stato === AttendanceStatus.ABSENT_UNJUSTIFIED).length,
    recuperi: attendances.filter(a => a.stato === AttendanceStatus.MAKEUP).length,
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
          <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
          <Text style={[styles.statNumber, { color: Colors.success }]}>{stats.presenti}</Text>
          <Text style={styles.statLabel}>Presenti</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.warningLight }]}>
          <Ionicons name="document-text" size={20} color={Colors.warning} />
          <Text style={[styles.statNumber, { color: Colors.warning }]}>{stats.assentiGiustificati}</Text>
          <Text style={styles.statLabel}>Giustificati</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.errorLight }]}>
          <Ionicons name="close-circle" size={20} color={Colors.error} />
          <Text style={[styles.statNumber, { color: Colors.error }]}>{stats.assentiNonGiustificati}</Text>
          <Text style={styles.statLabel}>Non giust.</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.infoLight || '#E3F2FD' }]}>
          <Ionicons name="refresh-circle" size={20} color={Colors.info || '#2196F3'} />
          <Text style={[styles.statNumber, { color: Colors.info || '#2196F3' }]}>{stats.recuperi}</Text>
          <Text style={styles.statLabel}>Recuperi</Text>
        </View>
      </View>

      {/* Info banner for teachers */}
      {isTeacher && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={Colors.info || '#2196F3'} />
          <Text style={styles.infoBannerText}>
            Puoi aggiungere presenze ma non modificarle. Per modifiche, contatta la segreteria.
          </Text>
        </View>
      )}

      {/* Add Button */}
      {canAdd && (
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add-circle" size={24} color={Colors.white} />
          <Text style={styles.addButtonText}>Registra Presenza</Text>
        </TouchableOpacity>
      )}

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
            <Text style={styles.emptyText}>
              {canAdd ? 'Premi il pulsante per registrare una presenza' : 'Le presenze appariranno qui'}
            </Text>
          </View>
        ) : (
          attendances.map(attendance => {
            const statusInfo = getStatusInfo(attendance.stato);
            return (
              <TouchableOpacity
                key={attendance.id}
                style={styles.attendanceCard}
                activeOpacity={0.8}
                onPress={() => canEdit && openEditModal(attendance)}
                onLongPress={() => canDelete && openDeleteModal(attendance)}
              >
                <View style={[styles.statusIconContainer, { backgroundColor: `${statusInfo.color}15` }]}>
                  <Ionicons 
                    name={statusInfo.icon as any} 
                    size={24} 
                    color={statusInfo.color} 
                  />
                </View>
                
                <View style={styles.attendanceInfo}>
                  <View style={styles.attendanceHeader}>
                    <Text style={styles.attendanceStudent}>
                      {getStudentName(attendance.allievo_id)}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}20` }]}>
                      <Text style={[styles.statusText, { color: statusInfo.color }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.attendanceMeta}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.attendanceDate}>
                      {formatDateForDisplay(attendance.data)}
                    </Text>
                  </View>
                  {attendance.recupero_data && (
                    <View style={styles.attendanceMeta}>
                      <Ionicons name="refresh" size={14} color={Colors.info || '#2196F3'} />
                      <Text style={[styles.attendanceDate, { color: Colors.info || '#2196F3' }]}>
                        Recupero: {formatDateForDisplay(attendance.recupero_data)}
                      </Text>
                    </View>
                  )}
                  {attendance.note && (
                    <Text style={styles.attendanceNote} numberOfLines={2}>
                      {attendance.note}
                    </Text>
                  )}
                </View>
                
                {(canEdit || canDelete) && (
                  <View style={styles.actionsContainer}>
                    {canEdit && (
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => openEditModal(attendance)}
                      >
                        <Ionicons name="pencil" size={18} color={Colors.primary} />
                      </TouchableOpacity>
                    )}
                    {canDelete && (
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => openDeleteModal(attendance)}
                      >
                        <Ionicons name="trash" size={18} color={Colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAttendance ? 'Modifica Presenza' : 'Registra Presenza'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Student Picker */}
              {!editingAttendance && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Allievo *</Text>
                  <TouchableOpacity 
                    style={styles.pickerButton}
                    onPress={() => setShowStudentPicker(true)}
                  >
                    <Text style={formData.allievo_id ? styles.pickerText : styles.pickerPlaceholder}>
                      {formData.allievo_id ? getStudentName(formData.allievo_id) : 'Seleziona allievo'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Date Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Data *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.data}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, data: text }))}
                  placeholder="AAAA-MM-GG"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>

              {/* Status Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Stato *</Text>
                <TouchableOpacity 
                  style={styles.pickerButton}
                  onPress={() => setShowStatusPicker(true)}
                >
                  <View style={styles.pickerContent}>
                    <Ionicons 
                      name={getStatusInfo(formData.stato).icon as any} 
                      size={20} 
                      color={getStatusInfo(formData.stato).color} 
                    />
                    <Text style={styles.pickerText}>
                      {getStatusInfo(formData.stato).label}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Recovery Date (only for MAKEUP status) */}
              {formData.stato === AttendanceStatus.MAKEUP && (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Data Recupero</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.recupero_data}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, recupero_data: text }))}
                    placeholder="AAAA-MM-GG"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
              )}

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Note</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.note}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, note: text }))}
                  placeholder="Note aggiuntive..."
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingAttendance ? 'Salva' : 'Registra'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Student Picker Modal */}
      <Modal
        visible={showStudentPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStudentPicker(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Seleziona Allievo</Text>
              <TouchableOpacity onPress={() => setShowStudentPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {students.map(student => (
                <TouchableOpacity
                  key={student.id}
                  style={[
                    styles.pickerItem,
                    formData.allievo_id === student.id && styles.pickerItemSelected
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, allievo_id: student.id }));
                    setShowStudentPicker(false);
                  }}
                >
                  <View style={styles.pickerItemContent}>
                    <View style={styles.pickerItemAvatar}>
                      <Text style={styles.pickerItemAvatarText}>
                        {student.nome[0]}{student.cognome[0]}
                      </Text>
                    </View>
                    <Text style={styles.pickerItemText}>
                      {student.nome} {student.cognome}
                    </Text>
                  </View>
                  {formData.allievo_id === student.id && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Status Picker Modal */}
      <Modal
        visible={showStatusPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Seleziona Stato</Text>
              <TouchableOpacity onPress={() => setShowStatusPicker(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {ATTENDANCE_STATUS_OPTIONS.map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.pickerItem,
                    formData.stato === option.value && styles.pickerItemSelected
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, stato: option.value }));
                    setShowStatusPicker(false);
                  }}
                >
                  <View style={styles.pickerItemContent}>
                    <View style={[styles.statusIcon, { backgroundColor: `${option.color}20` }]}>
                      <Ionicons name={option.icon as any} size={20} color={option.color} />
                    </View>
                    <Text style={styles.pickerItemText}>{option.label}</Text>
                  </View>
                  {formData.stato === option.value && (
                    <Ionicons name="checkmark" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
              <Ionicons name="warning" size={48} color={Colors.error} />
            </View>
            <Text style={styles.deleteModalTitle}>Elimina Presenza</Text>
            <Text style={styles.deleteModalText}>
              Sei sicuro di voler eliminare questa presenza? L'azione non può essere annullata.
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.deleteModalCancelButton]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.deleteModalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteModalButton, styles.deleteModalConfirmButton]}
                onPress={handleDelete}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>Elimina</Text>
                )}
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
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    marginTop: Spacing.xs,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },

  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: Typography.fontSize.small,
    color: '#1565C0',
  },

  // Add Button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
  },

  // List
  scrollView: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.huge,
  },
  attendanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  statusIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  attendanceInfo: {
    flex: 1,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  attendanceStudent: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.medium,
  },
  attendanceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  attendanceDate: {
    fontSize: Typography.fontSize.caption,
    color: Colors.textSecondary,
  },
  attendanceNote: {
    fontSize: Typography.fontSize.caption,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: Spacing.lg,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.background,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.semibold,
  },
  submitButton: {
    backgroundColor: Colors.primary,
  },
  submitButtonText: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },

  // Form
  formGroup: {
    marginBottom: Spacing.lg,
  },
  formLabel: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.body,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pickerText: {
    fontSize: Typography.fontSize.body,
    color: Colors.textPrimary,
  },
  pickerPlaceholder: {
    fontSize: Typography.fontSize.body,
    color: Colors.textTertiary,
  },

  // Picker Modal
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '70%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerModalTitle: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  pickerList: {
    padding: Spacing.md,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  pickerItemSelected: {
    backgroundColor: `${Colors.primary}10`,
  },
  pickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  pickerItemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemAvatarText: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
    fontSize: Typography.fontSize.body,
  },
  pickerItemText: {
    fontSize: Typography.fontSize.body,
    color: Colors.textPrimary,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Delete Modal
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  deleteModalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  deleteIconContainer: {
    marginBottom: Spacing.lg,
  },
  deleteModalTitle: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  deleteModalText: {
    fontSize: Typography.fontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  deleteModalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  deleteModalCancelButton: {
    backgroundColor: Colors.background,
  },
  deleteModalCancelText: {
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeight.semibold,
  },
  deleteModalConfirmButton: {
    backgroundColor: Colors.error,
  },
  deleteModalConfirmText: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },
});
