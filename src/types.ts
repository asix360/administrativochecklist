/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  COORDENADOR = 'COORDENADOR',
  OPERADOR = 'OPERADOR'
}

export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  registration?: string;
  isActive: boolean;
  createdAt: string;
}

export interface EmployeeRole {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Employee {
  id: string;
  name: string;
  role: string; // e.g. Enfermeiro, Médico, Tec Enfermagem, etc.
  roleId?: string; // Reference to EmployeeRole
  sector: string; // First/principal sector for legacy support
  sectors?: string[]; // Multiple sectors assigned
  registration: string; // matrícula (optional)
  isActive: boolean;
}

export type AttendanceStatus = 'PRESENTE' | 'AUSENTE' | 'ATESTADO' | 'EXTRA' | 'TROCA' | 'FAST_TRACK';

export interface ChecklistItem {
  id: string;
  shiftId: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  status: AttendanceStatus;
  notes: string; // e.g. "ALA VERDE", "TROCA PARA TATIANA FONSECA"
  sector: string;
  orderIndex: number;
}

export type ShiftPeriod = 'DIURNO' | 'NOTURNO';

export interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  period: ShiftPeriod;
  weekday: string; // e.g. SÁBADO, SEGUNDA-FEIRA
  coordinatorsName: string; // e.g. "SANDRIELE MARINHO"
  coordinatorsRegistration: string; // e.g. "1045352"
  generalNotes: string; // e.g. "ANA LAURENTINO DE SANTANA- ALA AMARELA (AUSENTE)"
  status: 'ABERTO' | 'FECHADO';
  createdAt: string;
  createdBy: string;
  closedAt?: string;
  closedBy?: string;
  reopenJustification?: string;
  reopenedAt?: string;
  reopenedBy?: string;
}

export interface SectorPendingIssue {
  id: string;
  shiftId: string;
  sector: string;
  description: string;
  status: 'PENDENTE' | 'RESOLVIDO';
  createdAt: string;
  createdBy: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  userRole: UserRole;
  action: string;
  details: string;
  ipAddress?: string;
}
