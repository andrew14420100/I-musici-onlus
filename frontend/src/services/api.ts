import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Course, Lesson, Payment, Notification, AdminStats, Attendance, Assignment } from '../types';

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
  exchangeSession: async (sessionId: string, role?: string, instrument?: string) => {
    const response = await api.post('/auth/session', { 
      session_id: sessionId,
      role: role || 'studente',
      instrument: instrument
    });
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
  create: async (data: { email: string; name: string; phone?: string; role: string; instrument?: string }) => {
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

// Attendance
export const attendanceApi = {
  getAll: async (filters?: {
    student_id?: string;
    teacher_id?: string;
    instrument?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    const response = await api.get(`/attendance?${params}`);
    return response.data as Attendance[];
  },
  create: async (data: {
    student_id: string;
    date: string;
    status: string;
    notes?: string;
    lesson_id?: string;
  }) => {
    const response = await api.post('/attendance', data);
    return response.data as Attendance;
  },
  update: async (attendanceId: string, data: { status?: string; notes?: string }) => {
    const response = await api.put(`/attendance/${attendanceId}`, data);
    return response.data as Attendance;
  },
  delete: async (attendanceId: string) => {
    await api.delete(`/attendance/${attendanceId}`);
  },
};

// Assignments
export const assignmentsApi = {
  getAll: async (filters?: {
    student_id?: string;
    teacher_id?: string;
    completed?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, String(value));
      });
    }
    const response = await api.get(`/assignments?${params}`);
    return response.data as Assignment[];
  },
  create: async (data: {
    student_id: string;
    title: string;
    description: string;
    due_date: string;
  }) => {
    const response = await api.post('/assignments', data);
    return response.data as Assignment;
  },
  update: async (assignmentId: string, data: Partial<Assignment>) => {
    const response = await api.put(`/assignments/${assignmentId}`, data);
    return response.data as Assignment;
  },
  delete: async (assignmentId: string) => {
    await api.delete(`/assignments/${assignmentId}`);
  },
};

// Teacher specific
export const teacherApi = {
  getStudents: async () => {
    const response = await api.get('/teacher/students');
    return response.data as User[];
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
