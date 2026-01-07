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
import { attendanceApi, assignmentsApi, teacherApi, usersApi } from '../../src/services/api';
import { Attendance, Assignment, User, UserRole, AttendanceStatus, INSTRUMENTS } from '../../src/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function AttendanceScreen() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'presenze' | 'compiti'>('presenze');
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modals
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [assignmentModalVisible, setAssignmentModalVisible] = useState(false);
  
  // Form data
  const [attendanceForm, setAttendanceForm] = useState({
    student_id: '',
    date: new Date().toISOString().split('T')[0],
    status: 'presente' as string,
    notes: '',
  });
  const [assignmentForm, setAssignmentForm] = useState({
    student_id: '',
    title: '',
    description: '',
    due_date: new Date().toISOString().split('T')[0],
  });

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isTeacher = currentUser?.role === UserRole.TEACHER;
  const isStudent = currentUser?.role === UserRole.STUDENT;

  const fetchData = async () => {
    try {
      const [attendanceData, assignmentsData] = await Promise.all([
        attendanceApi.getAll(),
        assignmentsApi.getAll(),
      ]);
      setAttendance(attendanceData);
      setAssignments(assignmentsData);
      
      // Fetch students for teachers/admins
      if (isTeacher) {
        const studentsData = await teacherApi.getStudents();
        setStudents(studentsData);
      } else if (isAdmin) {
        const studentsData = await usersApi.getAll('studente');
        setStudents(studentsData);
      }
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

  const getStudentName = (studentId: string) => {
    const student = students.find(s => s.user_id === studentId);
    return student?.name || 'Studente';
  };

  const getInstrumentLabel = (value: string) => {
    const inst = INSTRUMENTS.find(i => i.value === value);
    return inst?.label || value;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'presente':
        return '#10B981';
      case 'assente':
        return '#EF4444';
      case 'giustificato':
        return '#F59E0B';
      default:
        return '#666';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'presente':
        return 'Presente';
      case 'assente':
        return 'Assente';
      case 'giustificato':
        return 'Giustificato';
      default:
        return status;
    }
  };

  // Attendance handlers
  const openAttendanceModal = () => {
    setAttendanceForm({
      student_id: students[0]?.user_id || '',
      date: new Date().toISOString().split('T')[0],
      status: 'presente',
      notes: '',
    });
    setAttendanceModalVisible(true);
  };

  const handleSaveAttendance = async () => {
    if (!attendanceForm.student_id || !attendanceForm.date) {
      Alert.alert('Errore', 'Seleziona uno studente e una data');
      return;
    }
    try {
      await attendanceApi.create({
        student_id: attendanceForm.student_id,
        date: attendanceForm.date,
        status: attendanceForm.status,
        notes: attendanceForm.notes || undefined,
      });
      setAttendanceModalVisible(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
    }
  };

  // Assignment handlers
  const openAssignmentModal = () => {
    setAssignmentForm({
      student_id: students[0]?.user_id || '',
      title: '',
      description: '',
      due_date: new Date().toISOString().split('T')[0],
    });
    setAssignmentModalVisible(true);
  };

  const handleSaveAssignment = async () => {
    if (!assignmentForm.student_id || !assignmentForm.title || !assignmentForm.description) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori');
      return;
    }
    try {
      await assignmentsApi.create({
        student_id: assignmentForm.student_id,
        title: assignmentForm.title,
        description: assignmentForm.description,
        due_date: assignmentForm.due_date,
      });
      setAssignmentModalVisible(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
    }
  };

  const handleToggleAssignmentComplete = async (assignment: Assignment) => {
    try {
      await assignmentsApi.update(assignment.assignment_id, {
        completed: !assignment.completed,
      });
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    Alert.alert(
      'Conferma',
      'Vuoi eliminare questo compito?',
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Elimina', 
          style: 'destructive',
          onPress: async () => {
            try {
              await assignmentsApi.delete(assignmentId);
              fetchData();
            } catch (error: any) {
              Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
            }
          }
        },
      ]
    );
  };

  // Group attendance by student for table view
  const attendanceByStudent = students.reduce((acc, student) => {
    acc[student.user_id] = attendance.filter(a => a.student_id === student.user_id);
    return acc;
  }, {} as Record<string, Attendance[]>);

  // Calculate stats
  const totalPresent = attendance.filter(a => a.status === 'presente').length;
  const totalAbsent = attendance.filter(a => a.status === 'assente').length;
  const totalJustified = attendance.filter(a => a.status === 'giustificato').length;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Action Buttons for Teacher/Admin */}
      {(isTeacher || isAdmin) && (
        <View style={styles.actionsBar}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={openAttendanceModal}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Registra Presenza</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]} 
            onPress={openAssignmentModal}
          >
            <Ionicons name="document-text" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Assegna Compito</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'presenze' && styles.activeTab]}
          onPress={() => setActiveTab('presenze')}
        >
          <Text style={[styles.tabText, activeTab === 'presenze' && styles.activeTabText]}>
            Registro Presenze
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'compiti' && styles.activeTab]}
          onPress={() => setActiveTab('compiti')}
        >
          <Text style={[styles.tabText, activeTab === 'compiti' && styles.activeTabText]}>
            Compiti ({assignments.filter(a => !a.completed).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'presenze' ? (
          <>
            {/* Stats Summary */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={[styles.statValue, { color: '#10B981' }]}>{totalPresent}</Text>
                <Text style={styles.statLabel}>Presenti</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="close-circle" size={24} color="#EF4444" />
                <Text style={[styles.statValue, { color: '#EF4444' }]}>{totalAbsent}</Text>
                <Text style={styles.statLabel}>Assenti</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="alert-circle" size={24} color="#F59E0B" />
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>{totalJustified}</Text>
                <Text style={styles.statLabel}>Giustificati</Text>
              </View>
            </View>

            {/* Attendance Table */}
            {isStudent ? (
              // Student view - their own attendance
              attendance.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>Nessuna presenza registrata</Text>
                </View>
              ) : (
                <View style={styles.tableContainer}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Data</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Stato</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Note</Text>
                  </View>
                  {attendance.map((record) => (
                    <View key={record.attendance_id} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { flex: 2 }]}>
                        {format(new Date(record.date), 'd MMM yyyy', { locale: it })}
                      </Text>
                      <View style={[styles.tableCell, { flex: 1.5 }]}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(record.status) + '20' }]}>
                          <Text style={[styles.statusText, { color: getStatusColor(record.status) }]}>
                            {getStatusLabel(record.status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.tableCell, styles.notesCell, { flex: 2 }]} numberOfLines={1}>
                        {record.notes || '-'}
                      </Text>
                    </View>
                  ))}
                </View>
              )
            ) : (
              // Teacher/Admin view - all students
              students.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>Nessuno studente nel tuo corso</Text>
                </View>
              ) : (
                <View style={styles.tableContainer}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Studente</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>P</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>A</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>G</Text>
                  </View>
                  {students.map((student) => {
                    const studentAttendance = attendanceByStudent[student.user_id] || [];
                    const present = studentAttendance.filter(a => a.status === 'presente').length;
                    const absent = studentAttendance.filter(a => a.status === 'assente').length;
                    const justified = studentAttendance.filter(a => a.status === 'giustificato').length;
                    
                    return (
                      <View key={student.user_id} style={styles.tableRow}>
                        <View style={[styles.tableCell, { flex: 2.5 }]}>
                          <Text style={styles.studentName}>{student.name}</Text>
                          <Text style={styles.instrumentText}>
                            {student.instrument ? getInstrumentLabel(student.instrument) : '-'}
                          </Text>
                        </View>
                        <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                          <View style={[styles.countBadge, { backgroundColor: '#D1FAE5' }]}>
                            <Text style={[styles.countText, { color: '#10B981' }]}>{present}</Text>
                          </View>
                        </View>
                        <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                          <View style={[styles.countBadge, { backgroundColor: '#FEE2E2' }]}>
                            <Text style={[styles.countText, { color: '#EF4444' }]}>{absent}</Text>
                          </View>
                        </View>
                        <View style={[styles.tableCell, { flex: 1, alignItems: 'center' }]}>
                          <View style={[styles.countBadge, { backgroundColor: '#FEF3C7' }]}>
                            <Text style={[styles.countText, { color: '#F59E0B' }]}>{justified}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )
            )}
          </>
        ) : (
          // Assignments Tab
          assignments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>Nessun compito assegnato</Text>
            </View>
          ) : (
            assignments.map((assignment) => (
              <View 
                key={assignment.assignment_id} 
                style={[styles.assignmentCard, assignment.completed && styles.completedCard]}
              >
                <View style={styles.assignmentHeader}>
                  <TouchableOpacity 
                    style={styles.checkboxContainer}
                    onPress={() => handleToggleAssignmentComplete(assignment)}
                  >
                    <Ionicons 
                      name={assignment.completed ? 'checkbox' : 'square-outline'} 
                      size={24} 
                      color={assignment.completed ? '#10B981' : '#999'} 
                    />
                  </TouchableOpacity>
                  <View style={styles.assignmentInfo}>
                    <Text style={[styles.assignmentTitle, assignment.completed && styles.completedText]}>
                      {assignment.title}
                    </Text>
                    {!isStudent && (
                      <Text style={styles.assignmentStudent}>
                        {students.find(s => s.user_id === assignment.student_id)?.name || 'Studente'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.assignmentMeta}>
                    <View style={[
                      styles.dueBadge, 
                      { backgroundColor: assignment.completed ? '#D1FAE5' : 
                        new Date(assignment.due_date) < new Date() ? '#FEE2E2' : '#FEF3C7' }
                    ]}>
                      <Text style={[
                        styles.dueText,
                        { color: assignment.completed ? '#10B981' : 
                          new Date(assignment.due_date) < new Date() ? '#EF4444' : '#F59E0B' }
                      ]}>
                        {format(new Date(assignment.due_date), 'd MMM', { locale: it })}
                      </Text>
                    </View>
                    {(isTeacher || isAdmin) && (
                      <TouchableOpacity 
                        onPress={() => handleDeleteAssignment(assignment.assignment_id)}
                        style={styles.deleteBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={[styles.assignmentDesc, assignment.completed && styles.completedText]} numberOfLines={2}>
                  {assignment.description}
                </Text>
              </View>
            ))
          )
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Attendance Modal */}
      <Modal
        visible={attendanceModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAttendanceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Registra Presenza</Text>
              <TouchableOpacity onPress={() => setAttendanceModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Studente *</Text>
                <View style={styles.pickerContainer}>
                  {students.map(student => (
                    <TouchableOpacity
                      key={student.user_id}
                      style={[
                        styles.pickerOption,
                        attendanceForm.student_id === student.user_id && styles.pickerOptionSelected
                      ]}
                      onPress={() => setAttendanceForm({ ...attendanceForm, student_id: student.user_id })}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        attendanceForm.student_id === student.user_id && styles.pickerOptionTextSelected
                      ]}>{student.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Data *</Text>
                <TextInput
                  style={styles.input}
                  value={attendanceForm.date}
                  onChangeText={(text) => setAttendanceForm({ ...attendanceForm, date: text })}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Stato *</Text>
                <View style={styles.statusPicker}>
                  {['presente', 'assente', 'giustificato'].map(status => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusOption,
                        { backgroundColor: getStatusColor(status) + '20' },
                        attendanceForm.status === status && { borderColor: getStatusColor(status), borderWidth: 2 }
                      ]}
                      onPress={() => setAttendanceForm({ ...attendanceForm, status })}
                    >
                      <Ionicons 
                        name={status === 'presente' ? 'checkmark-circle' : status === 'assente' ? 'close-circle' : 'alert-circle'} 
                        size={20} 
                        color={getStatusColor(status)} 
                      />
                      <Text style={[styles.statusOptionText, { color: getStatusColor(status) }]}>
                        {getStatusLabel(status)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Note</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={attendanceForm.notes}
                  onChangeText={(text) => setAttendanceForm({ ...attendanceForm, notes: text })}
                  placeholder="Note aggiuntive..."
                  multiline
                  numberOfLines={2}
                />
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveAttendance}>
                <Text style={styles.saveButtonText}>Salva Presenza</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Assignment Modal */}
      <Modal
        visible={assignmentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAssignmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assegna Compito</Text>
              <TouchableOpacity onPress={() => setAssignmentModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Studente *</Text>
                <View style={styles.pickerContainer}>
                  {students.map(student => (
                    <TouchableOpacity
                      key={student.user_id}
                      style={[
                        styles.pickerOption,
                        assignmentForm.student_id === student.user_id && styles.pickerOptionSelected
                      ]}
                      onPress={() => setAssignmentForm({ ...assignmentForm, student_id: student.user_id })}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        assignmentForm.student_id === student.user_id && styles.pickerOptionTextSelected
                      ]}>{student.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Titolo *</Text>
                <TextInput
                  style={styles.input}
                  value={assignmentForm.title}
                  onChangeText={(text) => setAssignmentForm({ ...assignmentForm, title: text })}
                  placeholder="es. Esercizio scale"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Descrizione *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={assignmentForm.description}
                  onChangeText={(text) => setAssignmentForm({ ...assignmentForm, description: text })}
                  placeholder="Descrivi il compito da svolgere..."
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Scadenza *</Text>
                <TextInput
                  style={styles.input}
                  value={assignmentForm.due_date}
                  onChangeText={(text) => setAssignmentForm({ ...assignmentForm, due_date: text })}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#8B5CF6' }]} onPress={handleSaveAssignment}>
                <Text style={styles.saveButtonText}>Assegna Compito</Text>
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
  listContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
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
  tableContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4A90D9',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableHeaderCell: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 13,
    color: '#333',
  },
  notesCell: {
    color: '#888',
    fontStyle: 'italic',
  },
  studentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  instrumentText: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  countBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  assignmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  completedCard: {
    opacity: 0.7,
  },
  assignmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    marginRight: 10,
    marginTop: 2,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  assignmentStudent: {
    fontSize: 12,
    color: '#4A90D9',
    marginTop: 2,
  },
  assignmentMeta: {
    alignItems: 'flex-end',
  },
  dueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dueText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    marginTop: 8,
    padding: 4,
  },
  assignmentDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    marginLeft: 34,
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
    maxHeight: '85%',
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
    height: 80,
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
  statusPicker: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 4,
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
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
