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
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { notificationsApi, usersApi, paymentRequestsApi } from '../../src/services/api';
import { Notification, User, PaymentRequest, NotificationType, PaymentRequestStatus } from '../../src/types';
import { convertDisplayToAPI, getTodayForDisplay } from '../../src/utils/dateFormat';

export default function NotificationsScreen() {
  const { user: currentUser, isInitialized } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  
  // Modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPaymentDetailModal, setShowPaymentDetailModal] = useState(false);
  const [selectedPaymentRequest, setSelectedPaymentRequest] = useState<PaymentRequest | null>(null);
  
  // Form states
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    importo: '',
    causale: '',
    scadenza: '',
    note: ''
  });
  const [eventForm, setEventForm] = useState({
    titolo: '',
    messaggio: '',
  });
  const [confirmNote, setConfirmNote] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Success/Error modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Payment method selection
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'card' | 'paypal' | 'bank' | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  const isAdmin = currentUser?.ruolo === 'amministratore';
  const isStudent = currentUser?.ruolo === 'allievo';

  const fetchData = async () => {
    try {
      const notifData = await notificationsApi.getAll(!showInactive);
      setNotifications(notifData);
      
      // Carica richieste di pagamento
      if (isAdmin || isStudent) {
        const paymentReqData = await paymentRequestsApi.getAll();
        setPaymentRequests(paymentReqData);
      }
      
      // Carica studenti per admin
      if (isAdmin) {
        const studentsData = await usersApi.getAll('allievo', true);
        setStudents(studentsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      fetchData();
    }
  }, [showInactive, isInitialized]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [showInactive]);

  const getTitle = (n: Notification) => n.titolo || n.title || '';
  const getMessage = (n: Notification) => n.messaggio || n.message || '';
  const getType = (n: Notification) => n.tipo || n.notification_type || 'generale';
  const getId = (n: Notification) => n.id || n.notification_id || '';
  const isActive = (n: Notification) => n.attivo ?? n.is_active ?? true;
  const getCreatedAt = (n: Notification) => n.data_creazione || n.created_at || '';

  const getTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case NotificationType.PAYMENT_REQUEST:
      case 'pagamenti_da_effettuare':
        return 'cash';
      case NotificationType.EVENT:
      case 'eventi':
        return 'calendar';
      case 'pagamento':
        return 'card';
      case 'lezione':
        return 'book';
      default:
        return 'megaphone';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case NotificationType.PAYMENT_REQUEST:
      case 'pagamenti_da_effettuare':
        return '#F59E0B';
      case NotificationType.EVENT:
      case 'eventi':
        return '#8B5CF6';
      case 'pagamento':
        return '#10B981';
      case 'lezione':
        return '#3B82F6';
      default:
        return '#4A90D9';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case NotificationType.PAYMENT_REQUEST:
      case 'pagamenti_da_effettuare':
        return 'Pagamento da Effettuare';
      case NotificationType.EVENT:
      case 'eventi':
        return 'Evento';
      case 'pagamento':
        return 'Pagamento';
      case 'lezione':
        return 'Lezione';
      default:
        return 'Generale';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    setSelectedStudents(students.map(s => s.id));
  };

  const deselectAllStudents = () => {
    setSelectedStudents([]);
  };

  const handleCreatePaymentRequest = async () => {
    setErrorMessage('');
    
    if (selectedStudents.length === 0) {
      setErrorMessage('Seleziona almeno un allievo');
      return;
    }
    if (!paymentForm.importo || parseFloat(paymentForm.importo) <= 0) {
      setErrorMessage('Inserisci un importo valido');
      return;
    }
    if (!paymentForm.causale.trim()) {
      setErrorMessage('Inserisci la causale del pagamento');
      return;
    }
    if (!paymentForm.scadenza) {
      setErrorMessage('Inserisci la data di scadenza');
      return;
    }
    
    // Valida formato data DD-MM-YYYY
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (!dateRegex.test(paymentForm.scadenza)) {
      setErrorMessage('Formato data non valido. Usa GG-MM-AAAA (es: 15-02-2026)');
      return;
    }

    try {
      await paymentRequestsApi.create({
        destinatari_ids: selectedStudents,
        importo: parseFloat(paymentForm.importo),
        causale: paymentForm.causale,
        scadenza: convertDisplayToAPI(paymentForm.scadenza),
        note: paymentForm.note
      });
      
      Alert.alert('Successo', `Richiesta di pagamento inviata a ${selectedStudents.length} allievi`);
      setShowPaymentModal(false);
      setSelectedStudents([]);
      setPaymentForm({ importo: '', causale: '', scadenza: '', note: '' });
      fetchData();
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Si è verificato un errore';
      setErrorMessage(msg);
      Alert.alert('Errore', msg);
    }
  };

  const handleCreateEvent = async () => {
    setErrorMessage('');
    
    if (!eventForm.titolo.trim()) {
      setErrorMessage('Inserisci il titolo');
      return;
    }
    if (!eventForm.messaggio.trim()) {
      setErrorMessage('Inserisci il messaggio');
      return;
    }
    if (selectedStudents.length === 0) {
      setErrorMessage('Seleziona almeno un allievo');
      return;
    }

    try {
      await notificationsApi.create({
        titolo: eventForm.titolo,
        messaggio: eventForm.messaggio,
        tipo: NotificationType.EVENT,
        destinatari_ids: selectedStudents
      });
      
      Alert.alert('Successo', 'Evento creato');
      setShowEventModal(false);
      setSelectedStudents([]);
      setEventForm({ titolo: '', messaggio: '' });
      fetchData();
    } catch (error: any) {
      const msg = error.response?.data?.detail || 'Si è verificato un errore';
      setErrorMessage(msg);
      Alert.alert('Errore', msg);
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedPaymentRequest) {
      console.log('❌ Nessuna richiesta selezionata');
      return;
    }
    
    if (!selectedPaymentMethod) {
      setErrorMessage('Seleziona un metodo di pagamento');
      return;
    }
    
    console.log('📤 Metodo selezionato:', selectedPaymentMethod);
    
    // Simula il processo di pagamento in base al metodo
    try {
      let paymentNote = '';
      
      if (selectedPaymentMethod === 'card') {
        // Simula pagamento con carta (Stripe Test Mode)
        paymentNote = `Pagamento con carta - Test Mode\nSimulazione pagamento riuscito`;
        
      } else if (selectedPaymentMethod === 'paypal') {
        // Simula pagamento PayPal
        paymentNote = `Pagamento PayPal - Demo Mode\nTransaction ID: DEMO-${Date.now()}`;
        
      } else if (selectedPaymentMethod === 'bank') {
        // Per bonifico, l'utente dovrebbe caricare ricevuta
        paymentNote = `Bonifico bancario\nIn attesa di verifica documenti`;
      }
      
      // Invia conferma al backend
      const result = await paymentRequestsApi.confirm(selectedPaymentRequest.id, paymentNote);
      console.log('✅ Conferma riuscita:', result);
      
      setShowPaymentDetailModal(false);
      setSelectedPaymentRequest(null);
      setSelectedPaymentMethod(null);
      setConfirmNote('');
      
      setSuccessMessage(`Pagamento confermato tramite ${
        selectedPaymentMethod === 'card' ? 'carta' :
        selectedPaymentMethod === 'paypal' ? 'PayPal' : 'bonifico bancario'
      }! In attesa di approvazione dall'amministrazione.`);
      setShowSuccessModal(true);
      
      fetchData();
    } catch (error: any) {
      console.error('❌ Errore conferma pagamento:', error);
      const msg = error.response?.data?.detail || 'Si è verificato un errore';
      setErrorMessage(msg);
    }
  };

  const handleApprovePayment = async (requestId: string) => {
    try {
      await paymentRequestsApi.approve(requestId);
      Alert.alert('Successo', 'Pagamento approvato e registrato');
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
    }
  };

  const handleRejectPayment = async (requestId: string) => {
    Alert.prompt(
      'Rifiuta Pagamento',
      'Inserisci il motivo del rifiuto:',
      async (motivo) => {
        try {
          await paymentRequestsApi.reject(requestId, motivo);
          Alert.alert('Pagamento rifiutato');
          fetchData();
        } catch (error: any) {
          Alert.alert('Errore', error.response?.data?.detail || 'Si è verificato un errore');
        }
      }
    );
  };

  const openPaymentDetail = (request: PaymentRequest) => {
    setSelectedPaymentRequest(request);
    setShowPaymentDetailModal(true);
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
      {/* Admin Actions */}
      {isAdmin && (
        <View style={styles.actionsBar}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#F59E0B' }]} 
            onPress={() => setShowPaymentModal(true)}
          >
            <Ionicons name="cash" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Richiesta Pagamento</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]} 
            onPress={() => setShowEventModal(true)}
          >
            <Ionicons name="calendar" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Nuovo Evento</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Richieste in attesa (Solo Admin) */}
      {isAdmin && paymentRequests.filter(r => r.stato === PaymentRequestStatus.CONFIRMED).length > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.pendingSectionTitle}>
            <Ionicons name="time" size={18} color="#F59E0B" /> Richieste in Attesa di Approvazione
          </Text>
          {paymentRequests
            .filter(r => r.stato === PaymentRequestStatus.CONFIRMED)
            .map(request => (
              <View key={request.id} style={styles.pendingCard}>
                <View style={styles.pendingCardHeader}>
                  <Text style={styles.pendingCardStudent}>
                    {request.utente?.nome} {request.utente?.cognome}
                  </Text>
                  <Text style={styles.pendingCardAmount}>€{request.importo.toFixed(2)}</Text>
                </View>
                <Text style={styles.pendingCardCausale}>{request.causale}</Text>
                {request.note_allievo && (
                  <Text style={styles.pendingCardNote}>Note: {request.note_allievo}</Text>
                )}
                <View style={styles.pendingCardActions}>
                  <TouchableOpacity 
                    style={[styles.pendingActionButton, styles.approveButton]}
                    onPress={() => handleApprovePayment(request.id)}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.pendingActionButtonText}>Approva</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.pendingActionButton, styles.rejectButton]}
                    onPress={() => handleRejectPayment(request.id)}
                  >
                    <Ionicons name="close" size={18} color="#fff" />
                    <Text style={styles.pendingActionButtonText}>Rifiuta</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
        </View>
      )}

      {/* Notifications List */}
      <ScrollView 
        style={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Nessuna notifica</Text>
          </View>
        ) : (
          notifications.map(notification => (
            <TouchableOpacity
              key={getId(notification)}
              style={[
                styles.notificationCard,
                !isActive(notification) && styles.notificationCardInactive
              ]}
              onPress={() => {
                // Se è una richiesta di pagamento, trova e apri il dettaglio
                if (getType(notification) === NotificationType.PAYMENT_REQUEST && isStudent) {
                  const request = paymentRequests.find(r => r.notification_id === getId(notification));
                  if (request && request.stato === PaymentRequestStatus.PENDING) {
                    openPaymentDetail(request);
                  }
                }
              }}
            >
              <View style={[styles.notificationIconContainer, { backgroundColor: getTypeColor(getType(notification)) + '20' }]}>
                <Ionicons 
                  name={getTypeIcon(getType(notification))} 
                  size={24} 
                  color={getTypeColor(getType(notification))} 
                />
              </View>
              
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>{getTitle(notification)}</Text>
                  <Text style={[styles.notificationBadge, { backgroundColor: getTypeColor(getType(notification)) }]}>
                    {getTypeLabel(getType(notification))}
                  </Text>
                </View>
                <Text style={styles.notificationMessage}>{getMessage(notification)}</Text>
                <Text style={styles.notificationDate}>{formatDate(getCreatedAt(notification))}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal Richiesta Pagamento */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPaymentModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nuova Richiesta di Pagamento</Text>
                <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              <Text style={styles.inputLabel}>Seleziona Allievi</Text>
              <View style={styles.studentSelectActions}>
                <TouchableOpacity onPress={selectAllStudents} style={styles.selectAllButton}>
                  <Text style={styles.selectAllText}>Tutti</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={deselectAllStudents} style={styles.selectAllButton}>
                  <Text style={styles.selectAllText}>Nessuno</Text>
                </TouchableOpacity>
                <Text style={styles.selectedCount}>
                  {selectedStudents.length} di {students.length}
                </Text>
              </View>

              <ScrollView style={styles.studentList} nestedScrollEnabled>
                {students.map(student => (
                  <TouchableOpacity
                    key={student.id}
                    style={styles.studentItem}
                    onPress={() => toggleStudentSelection(student.id)}
                  >
                    <Ionicons 
                      name={selectedStudents.includes(student.id) ? 'checkbox' : 'square-outline'} 
                      size={24} 
                      color={selectedStudents.includes(student.id) ? '#4A90D9' : '#ccc'} 
                    />
                    <Text style={styles.studentName}>{student.nome} {student.cognome}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Importo (€)</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: 50.00"
                keyboardType="decimal-pad"
                value={paymentForm.importo}
                onChangeText={(text) => setPaymentForm({ ...paymentForm, importo: text })}
              />

              <Text style={styles.inputLabel}>Causale</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: Quota mensile gennaio"
                value={paymentForm.causale}
                onChangeText={(text) => setPaymentForm({ ...paymentForm, causale: text })}
              />

              <Text style={styles.inputLabel}>Scadenza</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD (es: 2026-02-15)"
                value={paymentForm.scadenza}
                onChangeText={(text) => setPaymentForm({ ...paymentForm, scadenza: text })}
              />
              <Text style={styles.helperText}>
                ℹ️ Formato richiesto: ANNO-MESE-GIORNO (es: 2026-02-15)
              </Text>

              <Text style={styles.inputLabel}>Note (opzionale)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Note aggiuntive..."
                multiline
                numberOfLines={3}
                value={paymentForm.note}
                onChangeText={(text) => setPaymentForm({ ...paymentForm, note: text })}
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleCreatePaymentRequest}>
                <Text style={styles.submitButtonText}>Invia Richiesta</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Evento */}
      <Modal
        visible={showEventModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEventModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowEventModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <ScrollView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nuovo Evento</Text>
                <TouchableOpacity onPress={() => setShowEventModal(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}

              <Text style={styles.inputLabel}>Seleziona Allievi</Text>
              <View style={styles.studentSelectActions}>
                <TouchableOpacity onPress={selectAllStudents} style={styles.selectAllButton}>
                  <Text style={styles.selectAllText}>Tutti</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={deselectAllStudents} style={styles.selectAllButton}>
                  <Text style={styles.selectAllText}>Nessuno</Text>
                </TouchableOpacity>
                <Text style={styles.selectedCount}>
                  {selectedStudents.length} di {students.length}
                </Text>
              </View>

              <ScrollView style={styles.studentList} nestedScrollEnabled>
                {students.map(student => (
                  <TouchableOpacity
                    key={student.id}
                    style={styles.studentItem}
                    onPress={() => toggleStudentSelection(student.id)}
                  >
                    <Ionicons 
                      name={selectedStudents.includes(student.id) ? 'checkbox' : 'square-outline'} 
                      size={24} 
                      color={selectedStudents.includes(student.id) ? '#4A90D9' : '#ccc'} 
                    />
                    <Text style={styles.studentName}>{student.nome} {student.cognome}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Titolo</Text>
              <TextInput
                style={styles.input}
                placeholder="Es: Saggio di fine anno"
                value={eventForm.titolo}
                onChangeText={(text) => setEventForm({ ...eventForm, titolo: text })}
              />

              <Text style={styles.inputLabel}>Messaggio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Dettagli dell'evento..."
                multiline
                numberOfLines={4}
                value={eventForm.messaggio}
                onChangeText={(text) => setEventForm({ ...eventForm, messaggio: text })}
              />

              <TouchableOpacity style={styles.submitButton} onPress={handleCreateEvent}>
                <Text style={styles.submitButtonText}>Crea Evento</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Dettaglio Pagamento (Allievo) */}
      <Modal
        visible={showPaymentDetailModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPaymentDetailModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPaymentDetailModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {selectedPaymentRequest && (
              <View>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Dettaglio Pagamento</Text>
                  <TouchableOpacity onPress={() => setShowPaymentDetailModal(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.paymentDetailCard}>
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Importo:</Text>
                    <Text style={styles.paymentDetailValue}>€{selectedPaymentRequest.importo.toFixed(2)}</Text>
                  </View>
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Causale:</Text>
                    <Text style={styles.paymentDetailValue}>{selectedPaymentRequest.causale}</Text>
                  </View>
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Scadenza:</Text>
                    <Text style={styles.paymentDetailValue}>{formatDate(selectedPaymentRequest.scadenza)}</Text>
                  </View>
                  {selectedPaymentRequest.note && (
                    <View style={styles.paymentDetailRow}>
                      <Text style={styles.paymentDetailLabel}>Note:</Text>
                      <Text style={styles.paymentDetailValue}>{selectedPaymentRequest.note}</Text>
                    </View>
                  )}
                  <View style={styles.paymentDetailRow}>
                    <Text style={styles.paymentDetailLabel}>Stato:</Text>
                    <Text style={[styles.paymentDetailValue, styles.statusBadge]}>
                      {selectedPaymentRequest.stato === PaymentRequestStatus.PENDING ? 'In Attesa' :
                       selectedPaymentRequest.stato === PaymentRequestStatus.CONFIRMED ? 'Confermato' :
                       selectedPaymentRequest.stato === PaymentRequestStatus.APPROVED ? 'Approvato' : 'Rifiutato'}
                    </Text>
                  </View>
                </View>

                {selectedPaymentRequest.stato === PaymentRequestStatus.PENDING && (
                  <View>
                    <Text style={styles.sectionTitle}>Seleziona Metodo di Pagamento</Text>
                    
                    <View style={styles.paymentMethodsContainer}>
                      {/* Carta di Credito/Debito */}
                      <TouchableOpacity
                        style={[
                          styles.paymentMethodCard,
                          selectedPaymentMethod === 'card' && styles.paymentMethodCardSelected
                        ]}
                        onPress={() => setSelectedPaymentMethod('card')}
                      >
                        <Ionicons 
                          name="card" 
                          size={32} 
                          color={selectedPaymentMethod === 'card' ? '#4A90D9' : '#666'} 
                        />
                        <Text style={styles.paymentMethodTitle}>Carta</Text>
                        <Text style={styles.paymentMethodSubtitle}>Credito/Debito</Text>
                      </TouchableOpacity>

                      {/* PayPal */}
                      <TouchableOpacity
                        style={[
                          styles.paymentMethodCard,
                          selectedPaymentMethod === 'paypal' && styles.paymentMethodCardSelected
                        ]}
                        onPress={() => setSelectedPaymentMethod('paypal')}
                      >
                        <Ionicons 
                          name="logo-paypal" 
                          size={32} 
                          color={selectedPaymentMethod === 'paypal' ? '#0070BA' : '#666'} 
                        />
                        <Text style={styles.paymentMethodTitle}>PayPal</Text>
                        <Text style={styles.paymentMethodSubtitle}>Account PayPal</Text>
                      </TouchableOpacity>

                      {/* Bonifico Bancario */}
                      <TouchableOpacity
                        style={[
                          styles.paymentMethodCard,
                          selectedPaymentMethod === 'bank' && styles.paymentMethodCardSelected
                        ]}
                        onPress={() => setSelectedPaymentMethod('bank')}
                      >
                        <Ionicons 
                          name="business" 
                          size={32} 
                          color={selectedPaymentMethod === 'bank' ? '#10B981' : '#666'} 
                        />
                        <Text style={styles.paymentMethodTitle}>Bonifico</Text>
                        <Text style={styles.paymentMethodSubtitle}>Bancario</Text>
                      </TouchableOpacity>
                    </View>

                    {selectedPaymentMethod && (
                      <TouchableOpacity 
                        style={[styles.submitButton, { backgroundColor: '#4A90D9', marginTop: 20 }]} 
                        onPress={handleConfirmPayment}
                      >
                        <Ionicons name="card" size={20} color="#fff" />
                        <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>Procedi al Pagamento</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {selectedPaymentRequest.stato === PaymentRequestStatus.APPROVED && (
                  <View style={styles.approvedBanner}>
                    <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                    <Text style={styles.approvedText}>Pagamento Approvato!</Text>
                  </View>
                )}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Successo */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSuccessModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.successModalContent}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={64} color="#10B981" />
              </View>
              <Text style={styles.successModalTitle}>Successo!</Text>
              <Text style={styles.successModalMessage}>{successMessage}</Text>
              <TouchableOpacity 
                style={[styles.submitButton, { backgroundColor: '#10B981', marginTop: 20 }]}
                onPress={() => setShowSuccessModal(false)}
              >
                <Text style={styles.submitButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
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
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A90D9',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  pendingSection: {
    backgroundColor: '#FFF7ED',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pendingSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  pendingCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  pendingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pendingCardStudent: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  pendingCardAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F59E0B',
  },
  pendingCardCausale: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  pendingCardNote: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  pendingCardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  pendingActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#DC2626',
  },
  pendingActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notificationCardInactive: {
    opacity: 0.5,
  },
  notificationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  notificationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  notificationDate: {
    fontSize: 12,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginBottom: 8,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  studentSelectActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  selectAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  selectedCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 'auto',
  },
  studentList: {
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 8,
  },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 12,
  },
  studentName: {
    fontSize: 14,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentDetailCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  paymentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  paymentDetailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  paymentDetailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: '#F59E0B',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  approvedBanner: {
    backgroundColor: '#ECFDF5',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  approvedText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
    marginTop: 8,
  },
  successModalContent: {
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  successModalMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  paymentMethodsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  paymentMethodCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  paymentMethodCardSelected: {
    borderColor: '#4A90D9',
    backgroundColor: '#EFF6FF',
  },
  paymentMethodTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  paymentMethodSubtitle: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});
