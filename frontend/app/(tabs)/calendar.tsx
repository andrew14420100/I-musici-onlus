import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, RefreshControl, Modal, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { lessonSlotsApi, usersApi } from '../../src/services/api';
import { User, LessonSlot } from '../../src/types';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/theme';
import { formatDateForDisplay, getTodayForDisplay, convertDisplayToAPI } from '../../src/utils/dateFormat';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { ErrorMessage } from '../../src/components/ErrorMessage';

const INSTRUMENTS = ['pianoforte', 'violino', 'chitarra', 'canto', 'batteria'];

export default function CalendarScreen() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<LessonSlot[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<LessonSlot | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    insegnante_id: '',
    allievo_id: '',
    strumento: 'pianoforte',
    data: '',
    ora: '',
    durata: 60
  });

  const isAdmin = user?.ruolo === 'amministratore';
  const isTeacher = user?.ruolo === 'insegnante';
  const isStudent = user?.ruolo === 'allievo';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [slotsData, teachersData, studentsData] = await Promise.all([
        lessonSlotsApi.getAll(),
        isAdmin ? usersApi.getByRole('insegnante') : Promise.resolve([]),
        isAdmin ? usersApi.getByRole('allievo') : Promise.resolve([])
      ]);
      
      console.log('📚 Slot caricati:', slotsData.length);
      setSlots(slotsData);
      setTeachers(teachersData);
      setStudents(studentsData);
    } catch (err: any) {
      console.error('Errore caricamento:', err);
      setError(err.response?.data?.detail || 'Errore nel caricamento');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // FILTRO SLOT PER RUOLO
  const getVisibleSlots = (): LessonSlot[] => {
    console.log('🔍 Filtraggio slot per ruolo:', user?.ruolo, '- Totale slot:', slots.length);
    
    if (isAdmin) {
      console.log('👤 Admin: mostra tutti gli slot');
      return slots;
    }
    
    if (isTeacher) {
      const filtered = slots.filter(s => s.insegnante_id === user?.id);
      console.log('👨‍🏫 Insegnante: slot filtrati:', filtered.length);
      return filtered;
    }
    
    if (isStudent) {
      const filtered = slots.filter(s => 
        s.stato === 'prenotato' && 
        s.allievo_id === user?.id
      );
      console.log('🎓 Allievo: slot prenotati:', filtered.length);
      return filtered;
    }
    
    return [];
  };

  const handleCreateSlot = async () => {
    try {
      if (!formData.insegnante_id || !formData.data || !formData.ora) {
        setError('Compila tutti i campi obbligatori');
        return;
      }

      setError('');
      
      // Crea slot - converti data dal formato DD-MM-YYYY a YYYY-MM-DD per l'API
      const newSlot = await lessonSlotsApi.create({
        insegnante_id: formData.insegnante_id,
        strumento: formData.strumento,
        data: convertDisplayToAPI(formData.data),
        ora: formData.ora,
        durata: formData.durata
      });

      // Se allievo selezionato, prenota subito
      if (formData.allievo_id && newSlot.id) {
        await lessonSlotsApi.book(newSlot.id, formData.allievo_id);
      }

      setShowCreateModal(false);
      setFormData({
        insegnante_id: '',
        allievo_id: '',
        strumento: 'pianoforte',
        data: '',
        ora: '',
        durata: 60
      });
      
      await loadData();
      alert(formData.allievo_id ? '✅ Lezione creata e prenotata!' : '✅ Slot creato!');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Errore creazione slot');
    }
  };

  const handleDeleteSlot = (slot: LessonSlot) => {
    setSlotToDelete(slot);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!slotToDelete) return;
    
    try {
      await lessonSlotsApi.delete(slotToDelete.id);
      setShowDeleteConfirm(false);
      setSlotToDelete(null);
      await loadData();
      alert('✅ Slot eliminato');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Errore eliminazione');
    }
  };

  const handleCancelBooking = async (slot: LessonSlot) => {
    Alert.alert(
      'Annulla Prenotazione',
      'Sei sicuro di voler annullare questa prenotazione?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sì',
          onPress: async () => {
            try {
              await lessonSlotsApi.cancelBooking(slot.id);
              await loadData();
              alert('✅ Prenotazione annullata');
            } catch (err: any) {
              setError(err.response?.data?.detail || 'Errore');
            }
          }
        }
      ]
    );
  };

  const handleSendNotification = async (slot: LessonSlot) => {
    try {
      await lessonSlotsApi.sendNotification(slot.id, ['entrambi']);
      alert('✅ Notifica inviata');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Errore invio notifica');
    }
  };

  const visibleSlots = getVisibleSlots();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📅 Calendario Lezioni</Text>
        {isAdmin && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color={Colors.surface} />
          </TouchableOpacity>
        )}
      </View>

      {error && <ErrorMessage message={error} />}

      {/* Lista Slot */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {visibleSlots.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>Nessuna lezione programmata</Text>
            {isAdmin && (
              <Text style={styles.emptyHint}>Clicca + per creare una lezione</Text>
            )}
          </View>
        ) : (
          visibleSlots.map(slot => (
            <View key={slot.id} style={styles.slotCard}>
              {/* Intestazione */}
              <View style={styles.slotHeader}>
                <View>
                  <Text style={styles.slotInstrument}>🎵 {slot.strumento}</Text>
                  <Text style={styles.slotDateTime}>
                    {formatDateForDisplay(slot.data)} • {slot.ora}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: slot.stato === 'prenotato' ? '#10b98120' : '#3b82f620' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: slot.stato === 'prenotato' ? '#10b981' : '#3b82f6' }
                  ]}>
                    {slot.stato === 'prenotato' ? 'Prenotato' : 'Disponibile'}
                  </Text>
                </View>
              </View>

              {/* Dettagli */}
              <View style={styles.slotDetails}>
                {slot.insegnante && (
                  <Text style={styles.slotPerson}>
                    👨‍🏫 Prof. {slot.insegnante.nome} {slot.insegnante.cognome}
                  </Text>
                )}
                {slot.allievo && (
                  <Text style={styles.slotPerson}>
                    🎓 {slot.allievo.nome} {slot.allievo.cognome}
                  </Text>
                )}
                <Text style={styles.slotDuration}>⏱️ {slot.durata} min</Text>
              </View>

              {/* Azioni Admin */}
              {isAdmin && (
                <View style={styles.slotActions}>
                  {slot.stato === 'prenotato' && (
                    <>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleSendNotification(slot)}
                      >
                        <Ionicons name="notifications" size={20} color={Colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleCancelBooking(slot)}
                      >
                        <Ionicons name="close-circle" size={20} color={Colors.warning} />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteSlot(slot)}
                  >
                    <Ionicons name="trash" size={20} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal Creazione */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuova Lezione</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {error && <ErrorMessage message={error} />}

            {/* Insegnante */}
            <Text style={styles.label}>Insegnante *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
              {teachers.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.chip,
                    formData.insegnante_id === t.id && styles.chipActive
                  ]}
                  onPress={() => setFormData({...formData, insegnante_id: t.id})}
                >
                  <Text style={[
                    styles.chipText,
                    formData.insegnante_id === t.id && styles.chipTextActive
                  ]}>
                    {t.nome} {t.cognome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Allievo */}
            <Text style={styles.label}>Allievo (opzionale)</Text>
            <Text style={styles.hint}>Se selezioni un allievo, la lezione sarà prenotata per lui</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
              <TouchableOpacity
                style={[styles.chip, !formData.allievo_id && styles.chipActive]}
                onPress={() => setFormData({...formData, allievo_id: ''})}
              >
                <Text style={[styles.chipText, !formData.allievo_id && styles.chipTextActive]}>
                  Nessuno
                </Text>
              </TouchableOpacity>
              {students.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.chip,
                    formData.allievo_id === s.id && styles.chipActive
                  ]}
                  onPress={() => setFormData({...formData, allievo_id: s.id})}
                >
                  <Text style={[
                    styles.chipText,
                    formData.allievo_id === s.id && styles.chipTextActive
                  ]}>
                    {s.nome} {s.cognome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Strumento */}
            <Text style={styles.label}>Strumento *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
              {INSTRUMENTS.map(inst => (
                <TouchableOpacity
                  key={inst}
                  style={[
                    styles.chip,
                    formData.strumento === inst && styles.chipActive
                  ]}
                  onPress={() => setFormData({...formData, strumento: inst})}
                >
                  <Text style={[
                    styles.chipText,
                    formData.strumento === inst && styles.chipTextActive
                  ]}>
                    {inst}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Data */}
            <Text style={styles.label}>Data * (formato: YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2026-01-09"
              value={formData.data}
              onChangeText={(text) => setFormData({...formData, data: text})}
            />

            {/* Ora */}
            <Text style={styles.label}>Ora * (formato: HH:MM)</Text>
            <TextInput
              style={styles.input}
              placeholder="14:00"
              value={formData.ora}
              onChangeText={(text) => setFormData({...formData, ora: text})}
            />

            {/* Durata */}
            <Text style={styles.label}>Durata (minuti)</Text>
            <TextInput
              style={styles.input}
              placeholder="60"
              keyboardType="numeric"
              value={String(formData.durata)}
              onChangeText={(text) => setFormData({...formData, durata: parseInt(text) || 60})}
            />

            {/* Pulsante Crea */}
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateSlot}
            >
              <Text style={styles.createButtonText}>Crea Lezione</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Dialog Conferma Eliminazione */}
      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Elimina Lezione"
        message={`Sei sicuro di voler eliminare questa lezione di ${slotToDelete?.strumento}?`}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSlotToDelete(null);
        }}
        confirmText="Elimina"
        cancelText="Annulla"
        danger={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  addButton: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    padding: Spacing.md,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: Typography.fontSize.h3,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: Typography.fontSize.h3,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyHint: {
    fontSize: Typography.fontSize.body,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
  },
  slotCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  slotInstrument: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  slotDateTime: {
    fontSize: Typography.fontSize.body,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: Typography.fontSize.small,
    fontWeight: Typography.fontWeight.medium,
  },
  slotDetails: {
    marginBottom: Spacing.sm,
  },
  slotPerson: {
    fontSize: Typography.fontSize.body,
    color: Colors.text,
    marginBottom: 4,
  },
  slotDuration: {
    fontSize: Typography.fontSize.body,
    color: Colors.textSecondary,
  },
  slotActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  actionButton: {
    padding: Spacing.sm,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.fontSize.h2,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text,
  },
  modalContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.body,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  hint: {
    fontSize: Typography.fontSize.small,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  chipContainer: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: Typography.fontSize.body,
    color: Colors.text,
  },
  chipTextActive: {
    color: Colors.surface,
    fontWeight: Typography.fontWeight.medium,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.body,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  createButton: {
    backgroundColor: Colors.primary,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  createButtonText: {
    fontSize: Typography.fontSize.h3,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
  },
});
