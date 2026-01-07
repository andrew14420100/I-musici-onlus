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
import { notificationsApi } from '../../src/services/api';
import { Notification, UserRole } from '../../src/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function NotificationsScreen() {
  const { user: currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    notification_type: 'generale',
  });

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const fetchData = async () => {
    try {
      const data = await notificationsApi.getAll(!showInactive);
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [showInactive]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [showInactive]);

  const getTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'promemoria_pagamento':
        return 'card';
      case 'promemoria_lezione':
        return 'calendar';
      default:
        return 'megaphone';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'promemoria_pagamento':
        return '#F59E0B';
      case 'promemoria_lezione':
        return '#10B981';
      default:
        return '#4A90D9';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'promemoria_pagamento':
        return 'Promemoria Pagamento';
      case 'promemoria_lezione':
        return 'Promemoria Lezione';
      default:
        return 'Generale';
    }
  };

  const openModal = (notification?: Notification) => {
    if (notification) {
      setEditingNotification(notification);
      setFormData({
        title: notification.title,
        message: notification.message,
        notification_type: notification.notification_type,
      });
    } else {
      setEditingNotification(null);
      setFormData({
        title: '',
        message: '',
        notification_type: 'generale',
      });
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.message) {
      Alert.alert('Errore', 'Titolo e messaggio sono obbligatori');
      return;
    }
    try {
      if (editingNotification) {
        await notificationsApi.update(editingNotification.notification_id, {
          title: formData.title,
          message: formData.message,
        });
      } else {
        await notificationsApi.create({
          title: formData.title,
          message: formData.message,
          notification_type: formData.notification_type,
          recipient_ids: [], // Send to all
        });
      }
      setModalVisible(false);
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si \u00e8 verificato un errore');
    }
  };

  const handleToggleActive = async (notification: Notification) => {
    try {
      await notificationsApi.update(notification.notification_id, {
        is_active: !notification.is_active,
      });
      fetchData();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Si \u00e8 verificato un errore');
    }
  };

  const handleDelete = async (notificationId: string) => {
    Alert.alert(
      'Conferma',
      'Vuoi eliminare questa notifica?',
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Elimina', 
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationsApi.delete(notificationId);
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
      {/* Admin Actions */}
      {isAdmin && (
        <View style={styles.actionsBar}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => openModal()}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Nuova Notifica</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Toggle inactive */}
      {isAdmin && (
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={styles.toggleButton}
            onPress={() => setShowInactive(!showInactive)}
          >
            <Ionicons 
              name={showInactive ? 'checkbox' : 'square-outline'} 
              size={20} 
              color="#4A90D9" 
            />
            <Text style={styles.toggleText}>Mostra anche disattivate</Text>
          </TouchableOpacity>
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
            <View 
              key={notification.notification_id} 
              style={[styles.notificationCard, !notification.is_active && styles.inactiveCard]}
            >
              <View style={[styles.iconContainer, { backgroundColor: getTypeColor(notification.notification_type) + '20' }]}>
                <Ionicons 
                  name={getTypeIcon(notification.notification_type)} 
                  size={22} 
                  color={getTypeColor(notification.notification_type)} 
                />
              </View>
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={[styles.notificationTitle, !notification.is_active && styles.inactiveText]}>
                    {notification.title}
                  </Text>
                  {!notification.is_active && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveBadgeText}>Disattivata</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.notificationMessage} numberOfLines={3}>
                  {notification.message}
                </Text>
                <View style={styles.notificationMeta}>
                  <View style={[styles.typeBadge, { backgroundColor: getTypeColor(notification.notification_type) + '20' }]}>
                    <Text style={[styles.typeBadgeText, { color: getTypeColor(notification.notification_type) }]}>
                      {getTypeLabel(notification.notification_type)}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>
                    {format(new Date(notification.created_at), 'd MMM yyyy', { locale: it })}
                  </Text>
                </View>
              </View>
              {isAdmin && (
                <View style={styles.notificationActions}>
                  <TouchableOpacity onPress={() => openModal(notification)} style={styles.actionIcon}>
                    <Ionicons name="pencil" size={18} color="#4A90D9" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleToggleActive(notification)} style={styles.actionIcon}>
                    <Ionicons 
                      name={notification.is_active ? 'eye-off' : 'eye'} 
                      size={18} 
                      color={notification.is_active ? '#F59E0B' : '#10B981'} 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(notification.notification_id)} style={styles.actionIcon}>
                    <Ionicons name="trash" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
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
                {editingNotification ? 'Modifica Notifica' : 'Nuova Notifica'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Titolo *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                  placeholder="Titolo della notifica"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Messaggio *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.message}
                  onChangeText={(text) => setFormData({ ...formData, message: text })}
                  placeholder="Scrivi il messaggio..."
                  multiline
                  numberOfLines={4}
                />
              </View>

              {!editingNotification && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Tipo</Text>
                  <View style={styles.typeSelector}>
                    {[
                      { value: 'generale', label: 'Generale', icon: 'megaphone' },
                      { value: 'promemoria_pagamento', label: 'Pagamento', icon: 'card' },
                      { value: 'promemoria_lezione', label: 'Lezione', icon: 'calendar' },
                    ].map(type => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.typeOption,
                          formData.notification_type === type.value && styles.typeOptionSelected
                        ]}
                        onPress={() => setFormData({ ...formData, notification_type: type.value })}
                      >
                        <Ionicons 
                          name={type.icon as any} 
                          size={20} 
                          color={formData.notification_type === type.value ? '#fff' : '#666'} 
                        />
                        <Text style={[
                          styles.typeOptionText,
                          formData.notification_type === type.value && styles.typeOptionTextSelected
                        ]}>{type.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>
                  {editingNotification ? 'Salva Modifiche' : 'Pubblica Notifica'}
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
  toggleContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
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
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inactiveCard: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  inactiveText: {
    color: '#999',
  },
  inactiveBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 10,
    color: '#999',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    lineHeight: 18,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 11,
    color: '#999',
  },
  notificationActions: {
    justifyContent: 'center',
    gap: 8,
  },
  actionIcon: {
    padding: 4,
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
    height: 100,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    gap: 4,
  },
  typeOptionSelected: {
    backgroundColor: '#4A90D9',
  },
  typeOptionText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  typeOptionTextSelected: {
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
