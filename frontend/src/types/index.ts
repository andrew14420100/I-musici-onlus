export enum UserRole {
  ADMIN = 'amministratore',
  TEACHER = 'insegnante',
  STUDENT = 'allievo'
}

export enum AttendanceStatus {
  PRESENT = 'presente',
  ABSENT = 'assente',
  JUSTIFIED = 'giustificato'
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

export const INSTRUMENTS = [
  { value: 'pianoforte', label: 'Pianoforte', icon: 'musical-notes' },
  { value: 'canto', label: 'Canto', icon: 'mic' },
  { value: 'percussioni', label: 'Percussioni', icon: 'disc' },
  { value: 'violino', label: 'Violino', icon: 'musical-note' },
  { value: 'chitarra', label: 'Chitarra', icon: 'musical-notes' },
  { value: 'chitarra_elettrica', label: 'Chitarra Elettrica', icon: 'flash' },
] as const;

export interface UserDetail {
  id: string;
  utente_id: string;
  // Student fields
  telefono?: string;
  data_nascita?: string;
  corso_principale?: string;
  // Teacher fields
  specializzazione?: string;
  compenso_orario?: number;
  note?: string;
}

export interface User {
  id: string;
  ruolo: UserRole;
  nome: string;
  cognome: string;
  email: string;
  attivo: boolean;
  data_creazione?: string;
  ultimo_accesso?: string;
  note_admin?: string;
  dettaglio?: UserDetail;
}

export interface Attendance {
  id: string;
  allievo_id: string;
  insegnante_id: string;
  data: string;
  stato: AttendanceStatus;
  note?: string;
  data_creazione: string;
}

export interface Assignment {
  id: string;
  insegnante_id: string;
  allievo_id: string;
  titolo: string;
  descrizione: string;
  data_scadenza: string;
  completato: boolean;
  data_creazione: string;
}

export interface Payment {
  id: string;
  utente_id: string;
  tipo: PaymentType;
  importo: number;
  descrizione: string;
  data_scadenza: string;
  stato: PaymentStatus;
  visibile_utente: boolean;
  data_creazione: string;
}

export interface Notification {
  id: string;
  titolo: string;
  messaggio: string;
  tipo: string;
  destinatari_ids: string[];
  attivo: boolean;
  data_creazione: string;
}

export interface AdminStats {
  allievi_attivi: number;
  insegnanti_attivi: number;
  pagamenti_non_pagati: number;
  notifiche_attive: number;
  presenze_oggi: number;
}
