/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Employee, User, Shift, ChecklistItem, AuditLog, SectorPendingIssue, EmployeeRole } from './types';

// API Client helpers
const API_URL = ''; // Relative path leverages Vite's dev proxy

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export async function fetchApi(path: string, options: RequestInit = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (netErr: any) {
    const msg = `Erro de conexão com o servidor. [Código: ERR_NETWORK_FAILURE]`;
    throw new ApiError(msg, 'ERR_NETWORK_FAILURE');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.message || `Erro da API: ${res.statusText}`;
    const formattedMsg = errorData.code ? `${message} [Código: ${errorData.code}]` : message;
    throw new ApiError(formattedMsg, errorData.code);
  }
  return res.json();
}

// Master sector list in order for checklist display and export
export const SECTORS = [
  'MÉDICO CLÍNICO',
  'MÉDICO PEDIATRA',
  'CLASSIFICAÇÃO DE RISCO',
  'SALA VERDE',
  'SALA AMARELA',
  'SALA VERMELHA',
  'PEDIATRIA',
  'CME',
  'RAIO X',
  'AMBULÂNCIA',
  'NIR',
  'SERVIÇO SOCIAL',
  'FARMÁCIA',
  'LABORATÓRIO',
  'COPA',
  'HIGIENIZAÇÃO',
  'RECEPÇÃO',
  'VIGILANTE',
  'MANUTENÇÃO',
  'MAQUEIRO',
  'REEDUCANDO',
  'CARRO ADM',
  'ADMINISTRATIVO'
];

export const ATTENDANCE_STATUS_LABELS: Record<string, { label: string, color: string }> = {
  PRESENTE: { label: 'Presente', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  AUSENTE: { label: 'Ausente', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  ATESTADO: { label: 'Atestado', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  EXTRA: { label: 'Plantão Extra', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  TROCA: { label: 'Troca de Turno', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  FAST_TRACK: { label: 'Fast Track', color: 'bg-sky-100 text-sky-800 border-sky-200' }
};

export function getWeekdayName(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString + 'T12:00:00'); // avoid timezone shifts
  const days = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];
  return days[date.getDay()];
}

// Simple deterministic hash function for mock security (matching seed logic)
export function hashPassword(pwd: string): string {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    const char = pwd.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

// No-op for frontend initialization (handled by database containers)
export function initializeDatabase() {
  console.log('Database initialization is handled by the backend container.');
}

// API wrappers
export async function getLogs(): Promise<AuditLog[]> {
  return fetchApi('/api/logs');
}

export async function logAction(user: User, action: string, details: string) {
  try {
    await fetchApi('/api/logs', {
      method: 'POST',
      body: JSON.stringify({ user, action, details })
    });
  } catch (err) {
    console.error('Failed to log action on server:', err);
  }
}

export async function getEmployees(): Promise<Employee[]> {
  return fetchApi('/api/employees');
}

export async function getEmployeeRoles(): Promise<EmployeeRole[]> {
  return fetchApi('/api/roles');
}

export async function saveEmployeeRole(user: User, role: EmployeeRole): Promise<{ success: boolean, message: string }> {
  try {
    const res = await fetchApi('/api/roles', {
      method: 'POST',
      body: JSON.stringify({ ...role, user })
    });
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao salvar cargo.' };
  }
}

export async function deleteEmployeeRole(user: User, roleId: string): Promise<{ success: boolean, message: string }> {
  try {
    const res = await fetchApi(`/api/roles/${roleId}`, {
      method: 'DELETE',
      body: JSON.stringify({ user })
    });
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao excluir cargo.' };
  }
}

export async function saveEmployee(user: User, emp: Employee): Promise<{ success: boolean, message: string }> {
  try {
    const res = await fetchApi('/api/employees', {
      method: 'POST',
      body: JSON.stringify({ ...emp, user })
    });
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao salvar funcionário.' };
  }
}

export async function deleteEmployee(user: User, empId: string): Promise<{ success: boolean, message: string }> {
  try {
    const res = await fetchApi(`/api/employees/${empId}`, {
      method: 'DELETE',
      body: JSON.stringify({ user })
    });
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao excluir funcionário.' };
  }
}

export async function importEmployeesFromText(user: User, text: string): Promise<{ success: boolean, count: number, message: string }> {
  try {
    const res = await fetchApi('/api/employees/import', {
      method: 'POST',
      body: JSON.stringify({ text, user })
    });
    return res;
  } catch (err: any) {
    return { success: false, count: 0, message: err.message || 'Erro ao importar funcionários.' };
  }
}

// Shifts, items, and issues API methods
export async function getShifts(user?: User): Promise<Shift[]> {
  const query = user ? `?role=${user.role}&userId=${user.id}` : '';
  return fetchApi(`/api/shifts${query}`);
}

export async function createShift(user: User, shiftData: { date: string, period: 'DIURNO' | 'NOTURNO', weekday: string, coordinatorsName: string, coordinatorsRegistration: string, generalNotes: string }): Promise<Shift> {
  return fetchApi('/api/shifts', {
    method: 'POST',
    body: JSON.stringify({ ...shiftData, createdBy: user.id, user })
  });
}

export async function updateShift(user: User, shiftId: string, shiftData: Partial<Shift> & { reopenJustification?: string }): Promise<Shift> {
  return fetchApi(`/api/shifts/${shiftId}`, {
    method: 'PUT',
    body: JSON.stringify({ ...shiftData, user })
  });
}

export async function getChecklistItems(shiftId: string): Promise<ChecklistItem[]> {
  return fetchApi(`/api/shifts/${shiftId}/items`);
}

export async function addChecklistItem(user: User, shiftId: string, employeeId: string, sector: string): Promise<ChecklistItem> {
  return fetchApi('/api/checklist-items', {
    method: 'POST',
    body: JSON.stringify({ shiftId, employeeId, sector, user })
  });
}

export async function updateChecklistItem(user: User, itemId: string, status?: string, notes?: string): Promise<{ success: boolean }> {
  return fetchApi(`/api/checklist-items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ status, notes, user })
  });
}

export async function deleteChecklistItem(user: User, itemId: string): Promise<{ success: boolean }> {
  return fetchApi(`/api/checklist-items/${itemId}`, {
    method: 'DELETE',
    body: JSON.stringify({ user })
  });
}

export async function getIssues(): Promise<SectorPendingIssue[]> {
  return fetchApi('/api/issues');
}

export async function saveIssue(user: User, issueData: Partial<SectorPendingIssue>): Promise<{ success: boolean }> {
  return fetchApi('/api/issues', {
    method: 'POST',
    body: JSON.stringify({ ...issueData, user })
  });
}

export async function getUsers(): Promise<User[]> {
  return fetchApi('/api/users');
}

export async function saveUser(user: User, userData: any): Promise<{ success: boolean, message: string }> {
  try {
    const res = await fetchApi('/api/users', {
      method: 'POST',
      body: JSON.stringify({ ...userData, user })
    });
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao salvar usuário.' };
  }
}

export async function deleteUser(user: User, userId: string): Promise<{ success: boolean, message: string }> {
  try {
    const res = await fetchApi(`/api/users/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ user })
    });
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao excluir usuário.' };
  }
}

export async function deleteIssue(user: User, issueId: string): Promise<{ success: boolean }> {
  return fetchApi(`/api/issues/${issueId}`, {
    method: 'DELETE',
    body: JSON.stringify({ user })
  });
}

export async function deleteShift(user: User, shiftId: string): Promise<{ success: boolean, message: string }> {
  try {
    const res = await fetchApi(`/api/shifts/${shiftId}`, {
      method: 'DELETE',
      body: JSON.stringify({ user })
    });
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao excluir plantão.' };
  }
}

export async function getTrashShifts(user: User): Promise<Shift[]> {
  return fetchApi(`/api/shifts/trash?role=${user.role}`);
}

export async function restoreShift(user: User, shiftId: string): Promise<{ success: boolean, message: string }> {
  try {
    const res = await fetchApi(`/api/shifts/${shiftId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ user })
    });
    return res;
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro ao restaurar plantão.' };
  }
}

export async function getStatistics(user: User, days: number): Promise<any> {
  return fetchApi(`/api/statistics?role=${user.role}&days=${days}`);
}

export async function transferShiftOwnership(user: User, shiftId: string, newOwnerUsername: string): Promise<Shift> {
  return fetchApi(`/api/shifts/${shiftId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ user, newOwnerUsername })
  });
}
