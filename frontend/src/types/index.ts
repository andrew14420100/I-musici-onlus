export enum UserRole {
  ADMIN = 'admin',
  STUDENT = 'studente',
  TEACHER = 'insegnante'
}

export enum UserStatus {
  ACTIVE = 'attivo',
  INACTIVE = 'inattivo'
}

export enum CourseStatus {
  ACTIVE = 'attivo',
  INACTIVE = 'inattivo'
}

export enum LessonStatus {
  SCHEDULED = 'programmata',
  COMPLETED = 'completata',
  CANCELLED = 'annullata'
}

export enum PaymentStatus {
  PENDING = 'in_attesa',
  PAID = 'pagato',
  OVERDUE = 'scaduto'
}

export enum PaymentType {
  STUDENT_FEE = 'quota_studente',
  TEACHER_COMPENSATION = 'compenso_insegnante'
}

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  created_at: string;
}

export interface Course {
  course_id: string;
  name: string;
  instrument: string;
  description?: string;
  status: CourseStatus;
  teacher_ids: string[];
  student_ids: string[];
  created_at: string;
}

export interface Lesson {
  lesson_id: string;
  course_id: string;
  teacher_id: string;
  student_id: string;
  date_time: string;
  duration_minutes: number;
  status: LessonStatus;
  notes?: string;
  created_at: string;
}

export interface Payment {
  payment_id: string;
  user_id: string;
  payment_type: PaymentType;
  amount: number;
  description: string;
  due_date: string;
  status: PaymentStatus;
  visible_to_user: boolean;
  created_at: string;
}

export interface Notification {
  notification_id: string;
  title: string;
  message: string;
  notification_type: string;
  recipient_ids: string[];
  is_active: boolean;
  created_at: string;
}

export interface AdminStats {
  studenti_attivi: number;
  insegnanti_attivi: number;
  corsi_attivi: number;
  lezioni_settimana: number;
  pagamenti_studenti_non_pagati: number;
  compensi_insegnanti_non_pagati: number;
  notifiche_attive: number;
  lezioni_oggi: Lesson[];
}
