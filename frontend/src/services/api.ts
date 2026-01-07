import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Course, Lesson, Payment, Notification, AdminStats } from '../types';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const authApi = {
  exchangeSession: async (sessionId: string) => {
    const response = await api.post('/auth/session', { session_id: sessionId });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data as User;
  },
  logout: async () => {
    await api.post('/auth/logout');
  },
};

// Users
export const usersApi = {
  getAll: async (role?: string, status?: string) => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (status) params.append('status', status);
    const response = await api.get(`/users?${params}`);
    return response.data as User[];
  },
  get: async (userId: string) => {
    const response = await api.get(`/users/${userId}`);
    return response.data as User;
  },
  create: async (data: { email: string; name: string; phone?: string; role: string }) => {
    const response = await api.post('/users', data);
    return response.data as User;
  },
  update: async (userId: string, data: Partial<User>) => {
    const response = await api.put(`/users/${userId}`, data);
    return response.data as User;
  },
  delete: async (userId: string) => {
    await api.delete(`/users/${userId}`);
  },
};

// Courses
export const coursesApi = {
  getAll: async (status?: string, instrument?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (instrument) params.append('instrument', instrument);
    const response = await api.get(`/courses?${params}`);
    return response.data as Course[];
  },
  get: async (courseId: string) => {
    const response = await api.get(`/courses/${courseId}`);
    return response.data as Course;
  },
  create: async (data: { name: string; instrument: string; description?: string }) => {
    const response = await api.post('/courses', data);
    return response.data as Course;
  },
  update: async (courseId: string, data: Partial<Course>) => {
    const response = await api.put(`/courses/${courseId}`, data);
    return response.data as Course;
  },
  delete: async (courseId: string) => {
    await api.delete(`/courses/${courseId}`);
  },
  assignTeacher: async (courseId: string, teacherId: string) => {
    const response = await api.post(`/courses/${courseId}/teachers/${teacherId}`);
    return response.data as Course;
  },
  removeTeacher: async (courseId: string, teacherId: string) => {
    const response = await api.delete(`/courses/${courseId}/teachers/${teacherId}`);
    return response.data as Course;
  },
  enrollStudent: async (courseId: string, studentId: string) => {
    const response = await api.post(`/courses/${courseId}/students/${studentId}`);
    return response.data as Course;
  },
  removeStudent: async (courseId: string, studentId: string) => {
    const response = await api.delete(`/courses/${courseId}/students/${studentId}`);
    return response.data as Course;
  },
};

// Lessons
export const lessonsApi = {
  getAll: async (filters?: {
    course_id?: string;
    teacher_id?: string;
    student_id?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const response = await api.get(`/lessons?${params}`);
    return response.data as Lesson[];
  },
  get: async (lessonId: string) => {
    const response = await api.get(`/lessons/${lessonId}`);
    return response.data as Lesson;
  },
  create: async (data: {
    course_id: string;
    teacher_id: string;
    student_id: string;
    date_time: string;
    duration_minutes?: number;
    notes?: string;
  }) => {
    const response = await api.post('/lessons', data);
    return response.data as Lesson;
  },
  update: async (lessonId: string, data: Partial<Lesson>) => {
    const response = await api.put(`/lessons/${lessonId}`, data);
    return response.data as Lesson;
  },
  delete: async (lessonId: string) => {
    await api.delete(`/lessons/${lessonId}`);
  },
};

// Payments
export const paymentsApi = {
  getAll: async (filters?: {
    user_id?: string;
    payment_type?: string;
    status?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const response = await api.get(`/payments?${params}`);
    return response.data as Payment[];
  },
  get: async (paymentId: string) => {
    const response = await api.get(`/payments/${paymentId}`);
    return response.data as Payment;
  },
  create: async (data: {
    user_id: string;
    payment_type: string;
    amount: number;
    description: string;
    due_date: string;
  }) => {
    const response = await api.post('/payments', data);
    return response.data as Payment;
  },
  update: async (paymentId: string, data: Partial<Payment>) => {
    const response = await api.put(`/payments/${paymentId}`, data);
    return response.data as Payment;
  },
  delete: async (paymentId: string) => {
    await api.delete(`/payments/${paymentId}`);
  },
};

// Notifications
export const notificationsApi = {
  getAll: async (activeOnly: boolean = true) => {
    const response = await api.get(`/notifications?active_only=${activeOnly}`);
    return response.data as Notification[];
  },
  create: async (data: {
    title: string;
    message: string;
    notification_type?: string;
    recipient_ids?: string[];
  }) => {
    const response = await api.post('/notifications', data);
    return response.data as Notification;
  },
  update: async (notificationId: string, data: Partial<Notification>) => {
    const response = await api.put(`/notifications/${notificationId}`, data);
    return response.data as Notification;
  },
  delete: async (notificationId: string) => {
    await api.delete(`/notifications/${notificationId}`);
  },
};

// Stats
export const statsApi = {
  getAdminStats: async () => {
    const response = await api.get('/stats/admin');
    return response.data as AdminStats;
  },
};

// Seed
export const seedApi = {
  seed: async () => {
    const response = await api.post('/seed');
    return response.data;
  },
};

export default api;
