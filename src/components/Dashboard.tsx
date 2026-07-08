/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Calendar, Clock, UserCheck, ShieldAlert, FileText, Download, Lock, Unlock, Plus, RefreshCw, Eye, Search, AlertCircle, Save, Check, CheckSquare, Trash2 } from 'lucide-react';
import { Shift, ChecklistItem, Employee, AttendanceStatus, User, UserRole, SectorPendingIssue } from '../types';
import { logAction, SECTORS, ATTENDANCE_STATUS_LABELS, getWeekdayName, getShifts, createShift, updateShift, getChecklistItems, addChecklistItem, updateChecklistItem, deleteChecklistItem, getEmployees, getIssues, getUsers, transferShiftOwnership } from '../utils';
import UpaLogo from './UpaLogo';
import { exportShiftPDF } from '../pdfExporter';

interface DashboardProps {
  currentUser: User;
  initialShiftId?: string;
  onClearInitialShiftId?: () => void;
}

function deduceDefaultShiftParams(now: Date = new Date()): { date: string; period: 'DIURNO' | 'NOTURNO' } {
  const hour = now.getHours();
  
  const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dateStr = getLocalDateStr(now);
  
  if (hour >= 7 && hour < 19) {
    return {
      date: dateStr,
      period: 'DIURNO'
    };
  } else if (hour >= 19) {
    return {
      date: dateStr,
      period: 'NOTURNO'
    };
  } else {
    // Before 7 AM, it is the night shift of the previous day
    const prevDay = new Date(now);
    prevDay.setDate(prevDay.getDate() - 1);
    return {
      date: getLocalDateStr(prevDay),
      period: 'NOTURNO'
    };
  }
}

function getTzDate(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23'
  });
  
  const parts = formatter.formatToParts(utcDate);
  const getVal = (type: string) => parseInt(parts.find(p => p.type === type)!.value, 10);
  
  const formattedYear = getVal('year');
  const formattedMonth = getVal('month') - 1;
  const formattedDay = getVal('day');
  const formattedHour = getVal('hour');
  const formattedMinute = getVal('minute');
  
  const targetUtc = Date.UTC(year, month, day, hour, minute, 0, 0);
  const formattedUtc = Date.UTC(formattedYear, formattedMonth, formattedDay, formattedHour, formattedMinute, 0, 0);
  
  const diff = targetUtc - formattedUtc;
  
  return new Date(utcDate.getTime() + diff);
}

export default function Dashboard({ currentUser, initialShiftId, onClearInitialShiftId }: DashboardProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [issues, setIssues] = useState<SectorPendingIssue[]>([]);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [isHistoricalView, setIsHistoricalView] = useState(false);
  
  // Create Shift States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const defaultShiftParams = deduceDefaultShiftParams();
  const [newDate, setNewDate] = useState(defaultShiftParams.date);
  const [newPeriod, setNewPeriod] = useState<'DIURNO' | 'NOTURNO'>(defaultShiftParams.period);
  const [newCoordName, setNewCoordName] = useState(currentUser.name);
  const [newCoordReg, setNewCoordReg] = useState(currentUser.registration || '');
  const [newNotes, setNewNotes] = useState('');

  // Selected item states for quick observation editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState('');

  const [msg, setMsg] = useState({ text: '', type: '' });
  const [isExporting, setIsExporting] = useState(false);
  const [masterEmployees, setMasterEmployees] = useState<Employee[]>([]);
  const [modalError, setModalError] = useState('');
  const [modalJustifyError, setModalJustifyError] = useState('');

  // Reopen shift validation states
  const [showJustificationModal, setShowJustificationModal] = useState(false);
  const [justificationText, setJustificationText] = useState('');

  // Transfer shift ownership states
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [newOwnerUsername, setNewOwnerUsername] = useState('');
  const [transferError, setTransferError] = useState('');

  // Print Ref for PDF capturing
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadShifts();
  }, []);

  useEffect(() => {
    getEmployees().then(setMasterEmployees).catch(console.error);
  }, [checklistItems]);

  const loadShifts = async () => {
    try {
      const storedShifts = await getShifts();
      setShifts(storedShifts);

      // Default to open shift or most recent
      if (storedShifts.length > 0) {
        if (initialShiftId) {
          const found = storedShifts.find((s) => s.id === initialShiftId);
          if (found) {
            setSelectedShift(found);
            setIsHistoricalView(true);
            if (onClearInitialShiftId) {
              onClearInitialShiftId();
            }
            return;
          }
        }
        
        setIsHistoricalView(false);
        const openShift = storedShifts.find((s) => s.status === 'ABERTO');
        if (openShift && (!isShiftOver(openShift) || openShift.reopenJustification)) {
          setSelectedShift(openShift);
        } else {
          // If no open shift, check if the most recent active shift is from today and not expired
          const mostRecent = storedShifts[0];
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const todayStr = `${year}-${month}-${day}`;
          
          if (mostRecent && mostRecent.date === todayStr && !isShiftOver(mostRecent)) {
            setSelectedShift(mostRecent);
          } else {
            setSelectedShift(null);
          }
        }
      } else {
        setIsHistoricalView(false);
        setSelectedShift(null);
      }
    } catch (err: any) {
      console.error(err);
      showMsg(err.message || 'Erro ao carregar plantões.', 'error');
    }
  };

  useEffect(() => {
    if (initialShiftId && shifts.length > 0) {
      const found = shifts.find((s) => s.id === initialShiftId);
      if (found) {
        setSelectedShift(found);
        setIsHistoricalView(true);
        if (onClearInitialShiftId) {
          onClearInitialShiftId();
        }
      }
    }
  }, [initialShiftId, shifts, onClearInitialShiftId]);

  useEffect(() => {
    if (selectedShift) {
      loadChecklistItems(selectedShift.id);
      loadIssues(selectedShift.id);
    } else {
      setChecklistItems([]);
      setIssues([]);
    }
  }, [selectedShift]);

  useEffect(() => {
    if (!selectedShift || isHistoricalView) return;
    
    const checkExpiryInterval = setInterval(() => {
      if (
        selectedShift.status === 'ABERTO' &&
        isShiftOver(selectedShift) &&
        !selectedShift.reopenJustification
      ) {
        setSelectedShift(null);
        showMsg('O plantão atual expirou e a página inicial foi redefinida.', 'info');
      }
    }, 10000);
    
    return () => clearInterval(checkExpiryInterval);
  }, [selectedShift, isHistoricalView]);

  const loadChecklistItems = async (shiftId: string) => {
    try {
      const filtered = await getChecklistItems(shiftId);
      setChecklistItems(filtered);
    } catch (err: any) {
      console.error(err);
      showMsg(err.message || 'Erro ao carregar checklist.', 'error');
    }
  };

  const loadIssues = async (shiftId: string) => {
    try {
      const storedIssues = await getIssues();
      setIssues(storedIssues.filter((i) => i.shiftId === shiftId));
    } catch (err: any) {
      console.error(err);
      showMsg(err.message || 'Erro ao carregar pendências.', 'error');
    }
  };

  const handleOpenCreateModal = () => {
    const params = deduceDefaultShiftParams();
    setNewDate(params.date);
    setNewPeriod(params.period);
    setNewCoordName(currentUser.name);
    setNewCoordReg(currentUser.registration || '');
    setModalError('');
    setShowCreateModal(true);
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    setModalError('');

    try {
      const newShift = await createShift(currentUser, {
        date: newDate,
        period: newPeriod,
        weekday: getWeekdayName(newDate),
        coordinatorsName: newCoordName.toUpperCase(),
        coordinatorsRegistration: newCoordReg,
        generalNotes: newNotes
      });

      await loadShifts();
      setSelectedShift(newShift);
      setShowCreateModal(false);
      showMsg('Plantão administrativo iniciado com sucesso!', 'success');
    } catch (err: any) {
      setModalError(err.message || 'Erro ao iniciar plantão.');
    }
  };

  const handleUpdateItemStatus = async (itemId: string, status: AttendanceStatus) => {
    if (!checkEditable(selectedShift)) return;

    try {
      await updateChecklistItem(currentUser, itemId, status, undefined);
      if (selectedShift) {
        await loadChecklistItems(selectedShift.id);
      }
    } catch (err: any) {
      showMsg(err.message || 'Erro ao registrar presença.', 'error');
    }
  };

  const handleSaveItemNotes = async (itemId: string) => {
    if (!checkEditable(selectedShift)) return;

    try {
      await updateChecklistItem(currentUser, itemId, undefined, editingNotes);
      if (selectedShift) {
        await loadChecklistItems(selectedShift.id);
      }
      setEditingItemId(null);
      setEditingNotes('');
      showMsg('Observação do funcionário salva.', 'success');
    } catch (err: any) {
      showMsg(err.message || 'Erro ao salvar observação.', 'error');
    }
  };

  const handleAddEmployeeToShift = async (employeeId: string, sector: string) => {
    if (!checkEditable(selectedShift)) return;

    try {
      await addChecklistItem(currentUser, selectedShift.id, employeeId, sector);
      await loadChecklistItems(selectedShift.id);
      showMsg('Colaborador adicionado ao setor com sucesso.', 'success');
    } catch (err: any) {
      // Exibe a mensagem de erro da API. Se for erro de duplicidade, exibe como um aviso (warning)
      const msgType = err.code === 'ERR_DUPLICATE_RECORD' ? 'warning' : 'error';
      showMsg(err.message || 'Erro ao alocar colaborador.', msgType);
    }
  };

  const handleRemoveEmployeeFromShift = async (itemId: string) => {
    if (!checkEditable(selectedShift)) return;

    try {
      await deleteChecklistItem(currentUser, itemId);
      await loadChecklistItems(selectedShift.id);
      showMsg('Colaborador removido do plantão com sucesso.', 'success');
    } catch (err: any) {
      showMsg(err.message || 'Erro ao remover colaborador.', 'error');
    }
  };

  const handleSaveGeneralShiftData = async (field: 'coordinatorsName' | 'coordinatorsRegistration' | 'generalNotes', value: string) => {
    if (!checkEditable(selectedShift)) return;

    try {
      const updated = await updateShift(currentUser, selectedShift.id, { [field]: value });
      setSelectedShift(updated);
      setShifts(shifts.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err: any) {
      showMsg(err.message || 'Erro ao atualizar dados do plantão.', 'error');
    }
  };

  const isShiftOver = (shift: Shift): boolean => {
    try {
      const [year, month, day] = shift.date.split('-').map(Number);
      
      let endHour = 18;
      let endMinute = 55;
      let endDayOffset = 0;
      
      if (shift.period === 'NOTURNO') {
        endHour = 6;
        endMinute = 55;
        endDayOffset = 1;
      }
      
      const targetDate = new Date(Date.UTC(year, month - 1, day + endDayOffset));
      const targetYear = targetDate.getUTCFullYear();
      const targetMonth = targetDate.getUTCMonth();
      const targetDay = targetDate.getUTCDate();
      
      const endShiftDate = getTzDate(targetYear, targetMonth, targetDay, endHour, endMinute, 'America/Sao_Paulo');
      return new Date() > endShiftDate;
    } catch (e) {
      console.error('Error parsing shift over status:', e);
      return false;
    }
  };

  const isReadOnly = (shift: Shift | null): boolean => {
    if (!shift) return true;
    if (shift.status === 'FECHADO') return true;
    if (isShiftOver(shift) && !shift.reopenJustification) return true;
    
    // Ownership check: only creator or ADMIN can edit
    if (currentUser.role !== 'ADMIN' && shift.createdBy !== currentUser.id) {
      return true;
    }
    
    return false;
  };

  const checkEditable = (shift: Shift | null): boolean => {
    if (!shift) return false;
    if (shift.status === 'FECHADO') {
      showMsg('Este plantão está fechado. Reabra-o para fazer modificações.', 'error');
      return false;
    }
    if (isShiftOver(shift) && !shift.reopenJustification) {
      showMsg('Este plantão está fora do horário e foi bloqueado. Solicite a reabertura a um Coordenador ou Administrador.', 'error');
      return false;
    }
    if (currentUser.role !== 'ADMIN' && shift.createdBy !== currentUser.id) {
      showMsg('Apenas o criador deste plantão (ou um Administrador) pode fazer modificações.', 'error');
      return false;
    }
    return true;
  };

  const handleConfirmReopenWithJustification = async () => {
    if (!selectedShift) return;
    if (!justificationText.trim()) {
      setModalJustifyError('Por favor, insira uma justificativa válida.');
      return;
    }
    setModalJustifyError('');

    try {
      const updated = await updateShift(currentUser, selectedShift.id, {
        status: 'ABERTO',
        reopenJustification: justificationText
      });
      setSelectedShift(updated);
      setShifts(shifts.map((s) => (s.id === updated.id ? updated : s)));
      showMsg('Plantão reaberto/desbloqueado com sucesso com justificativa registrada.', 'success');
      setShowJustificationModal(false);
    } catch (err: any) {
      setModalJustifyError(err.message || 'Erro ao reabrir plantão.');
    }
  };

  const handleOpenTransferModal = async () => {
    if (!selectedShift) return;
    setTransferError('');
    setNewOwnerUsername('');
    try {
      const activeUsers = await getUsers();
      // Filter active users and exclude the current owner to prevent redundant transfers
      const allowedUsers = activeUsers.filter(u => u.isActive && u.username !== selectedShift.createdBy);
      setSystemUsers(allowedUsers);
      setShowTransferModal(true);
    } catch (err: any) {
      showMsg(err.message || 'Erro ao buscar usuários do sistema.', 'error');
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedShift) return;
    if (!newOwnerUsername) {
      setTransferError('Por favor, selecione o novo coordenador.');
      return;
    }
    setTransferError('');

    try {
      const updated = await transferShiftOwnership(currentUser, selectedShift.id, newOwnerUsername);
      setSelectedShift(updated);
      setShifts(shifts.map((s) => (s.id === updated.id ? updated : s)));
      showMsg('Propriedade do plantão transferida com sucesso!', 'success');
      setShowTransferModal(false);
    } catch (err: any) {
      setTransferError(err.message || 'Erro ao transferir a propriedade do plantão.');
    }
  };

  const handleToggleShiftStatus = async () => {
    if (!selectedShift) return;
    const nextStatus = selectedShift.status === 'ABERTO' ? 'FECHADO' : 'ABERTO';

    // Business rule: after shift hours, can only reopen if Coordinator or Admin, and with a justification
    if (nextStatus === 'ABERTO') {
      const isOver = isShiftOver(selectedShift);
      if (isOver) {
        if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.COORDENADOR) {
          showMsg('Este plantão já encerrou seu horário de funcionamento. Apenas Coordenadores ou Administradores podem reabri-lo.', 'error');
          return;
        }
        setJustificationText('');
        setModalJustifyError('');
        setShowJustificationModal(true);
        return;
      }
    }

    try {
      const updated = await updateShift(currentUser, selectedShift.id, { status: nextStatus });
      setSelectedShift(updated);
      setShifts(shifts.map((s) => (s.id === updated.id ? updated : s)));

      showMsg(
        nextStatus === 'FECHADO'
          ? 'Plantão fechado e homologado com sucesso! Exportação de PDF iniciada.'
          : 'Plantão reaberto para edições.',
        'success'
      );

      // Auto export on close
      if (nextStatus === 'FECHADO') {
        setTimeout(() => {
          handleExportPDF();
        }, 500);
      }
    } catch (err: any) {
      showMsg(err.message || 'Erro ao alterar status do plantão.', 'error');
    }
  };

  const handleExportPDF = async () => {
    if (!selectedShift) return;
    setIsExporting(true);
    setMsg({ text: 'Gerando PDF administrativo de alta definição...', type: 'success' });

    try {
      exportShiftPDF(selectedShift, checklistItems);
      logAction(currentUser, 'EXPORTAÇÃO PDF', `Exportou relatório de escala do plantão de ${selectedShift.date} (${selectedShift.period}) em PDF.`);
      showMsg('PDF exportado com sucesso!', 'success');
    } catch (e: any) {
      console.error('Error generating PDF:', e);
      showMsg(e.message || 'Erro ao gerar o PDF.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const showMsg = (text: string, type: string) => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  // Group checklist items by sectors for visualization
  const groupedItems = SECTORS.reduce((acc, sector) => {
    acc[sector] = checklistItems.filter((item) => item.sector === sector);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  // Filter grouped items based on search/filters
  const filteredGroupedKeys = SECTORS.filter((sector) => {
    const itemsInSec = groupedItems[sector] || [];
    const matchesSector = sectorFilter === '' || sector === sectorFilter;

    const matchesSearch = itemsInSec.some(
      (item) =>
        item.employeeName.toLowerCase().includes(search.toLowerCase()) ||
        item.employeeRole.toLowerCase().includes(search.toLowerCase()) ||
        (item.notes && item.notes.toLowerCase().includes(search.toLowerCase()))
    );

    return matchesSector && (search === '' || matchesSearch);
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto font-sans text-[#1E293B] space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-slate-200 gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-5">
          <UpaLogo variant="compact" className="shrink-0 scale-95 origin-left" />
          <div className="md:border-l md:border-slate-200 md:pl-5">
            <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center uppercase">
              Checklist de Plantão Administrativo
            </h1>
            <p className="mt-0.5 text-slate-500 text-xs font-semibold">
              Crie novos plantões, gerencie frequências, adicione observações em tempo real e exporte relatórios em PDF.
            </p>
          </div>
        </div>

        {/* Shift selector & actions */}
        <div className="mt-3 lg:mt-0 flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Iniciar Novo Plantão</span>
          </button>
        </div>
      </div>

      {/* Modal warning/error alert in the center of the screen */}
      {msg.text && (msg.type === 'warning' || msg.type === 'error') && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full border ${
            msg.type === 'warning' ? 'border-amber-100' : 'border-rose-100'
          } p-6 transform scale-100 transition-all flex flex-col items-center text-center space-y-4 animate-scale-up`}>
            
            {/* Round Icon */}
            <div className={`p-4 rounded-full ${
              msg.type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
            }`}>
              <AlertCircle className="h-8 w-8" />
            </div>

            {/* Title */}
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              {msg.type === 'warning' ? 'Aviso de Alocação' : 'Erro no Sistema'}
            </h3>

            {/* Message */}
            <p className="text-xs font-semibold text-slate-600 leading-relaxed whitespace-pre-line">
              {msg.text}
            </p>

            {/* Dismiss Button */}
            <button
              onClick={() => setMsg({ text: '', type: '' })}
              className={`w-full mt-4 py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-lg transition shadow-xs cursor-pointer ${
                msg.type === 'warning' 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200 shadow-sm' 
                  : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200 shadow-sm'
              }`}
            >
              Entendido / Fechar
            </button>
          </div>
        </div>
      )}

      {/* Floating Success/Info Toast in the bottom-right */}
      {msg.text && (msg.type === 'success' || msg.type === 'info') && (
        <div className={`fixed bottom-6 right-6 bg-white border rounded-2xl p-4 shadow-xl z-50 flex items-center space-x-3 max-w-sm animate-slide-up ${
          msg.type === 'success' ? 'border-emerald-100' : 'border-blue-100'
        }`}>
          <div className={`p-1.5 text-white rounded-full shrink-0 ${
            msg.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
          }`}>
            {msg.type === 'success' ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-700 leading-tight">{msg.text}</p>
          </div>
          <button 
            onClick={() => setMsg({ text: '', type: '' })}
            className="text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer pl-2 shrink-0 transition"
          >
            ✕
          </button>
        </div>
      )}

      {selectedShift ? (
        <div className="space-y-6">
          {/* Expired and locked warning banner */}
          {selectedShift.status === 'ABERTO' && isShiftOver(selectedShift) && !selectedShift.reopenJustification && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-amber-800">
              <div className="flex items-center space-x-2 text-xs font-bold uppercase">
                <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                <span>Este plantão expirou e foi bloqueado por ultrapassar o horário limite de edição.</span>
              </div>
              {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.COORDENADOR) && (
                <button
                  onClick={() => {
                    setJustificationText('');
                    setShowJustificationModal(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg cursor-pointer transition text-center shadow-sm shrink-0"
                >
                  Desbloquear Plantão
                </button>
              )}
            </div>
          )}
          {/* Active Shift Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
            {/* Corner status light */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${
              selectedShift.status === 'ABERTO' ? 'bg-blue-500' : 'bg-slate-400'
            }`}></div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mt-1">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                {/* Date / Period */}
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-100 text-blue-600">
                    <Calendar className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Período / Data</p>
                    <p className="text-xs font-black text-slate-800 mt-0.5">
                      {selectedShift.date.split('-').reverse().join('/')} — {selectedShift.period}
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">{selectedShift.weekday}</span>
                  </div>
                </div>

                {/* Coordinator's name */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                      Coordenador do Plantão
                    </label>
                    {currentUser.role === 'ADMIN' && (
                      <button
                        onClick={handleOpenTransferModal}
                        className="text-[9px] text-blue-600 hover:text-blue-700 font-black uppercase tracking-wider underline cursor-pointer"
                      >
                        Transferir
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    disabled={true}
                    value={selectedShift.coordinatorsName}
                    onChange={(e) => handleSaveGeneralShiftData('coordinatorsName', e.target.value.toUpperCase())}
                    placeholder="NOME DO COORDENADOR"
                    className="block w-full py-1.5 px-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>

                {/* Coordinator's registration */}
                <div>
                  <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    Matrícula Coordenador
                  </label>
                  <input
                    type="text"
                    disabled={true}
                    value={selectedShift.coordinatorsRegistration}
                    onChange={(e) => handleSaveGeneralShiftData('coordinatorsRegistration', e.target.value)}
                    placeholder="MATRÍCULA"
                    className="block w-full py-1.5 px-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>

                {/* General notes / absent supervisor */}
                <div>
                  <label className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    Observações Administrativas
                  </label>
                  <input
                    type="text"
                    disabled={isReadOnly(selectedShift)}
                    value={selectedShift.generalNotes}
                    onChange={(e) => handleSaveGeneralShiftData('generalNotes', e.target.value)}
                    placeholder="Ex: ANA LAURENTINO DE SANTANA (AUSENTE)"
                    className="block w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-450 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-1.5 shrink-0 w-full lg:w-auto">
                <button
                  onClick={handleToggleShiftStatus}
                  className={`px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-1.5 w-full lg:w-auto ${
                    selectedShift.status === 'ABERTO'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {selectedShift.status === 'ABERTO' ? (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      <span>Fechar & Homologar</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="h-3.5 w-3.5" />
                      <span>Reabrir Plantão</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className="px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-1.5 w-full lg:w-auto"
                >
                  <Download className="h-3.5 w-3.5 text-blue-600" />
                  <span>Gerar checklist PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Checklist Area */}
          <div className="space-y-4">
            {/* Search/Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Pesquisar funcionário por nome, cargo ou observações..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="block w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold"
                />
              </div>

              <div className="w-full md:w-56">
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="block w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Filtrar por Setor (Todos)</option>
                  {SECTORS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Checklist Sectors Loop */}
            <div className="grid grid-cols-1 gap-4">
              {filteredGroupedKeys.map((sector) => {
                const secItems = groupedItems[sector] || [];

                return (
                  <div key={sector} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    {/* Sector Title Header */}
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center space-x-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                        <h3 className="font-black text-slate-800 uppercase tracking-wider text-[11px] font-mono">
                          {sector}
                        </h3>
                      </div>
                      <span className="text-slate-400 text-[10px] font-bold font-mono">
                        {secItems.length} {secItems.length === 1 ? 'colaborador' : 'colaboradores'}
                      </span>
                    </div>

                    {/* Sector Items Table */}
                    <div className="divide-y divide-slate-100">
                      {secItems.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-50/20">
                          Nenhum colaborador indicado para este setor.
                        </div>
                      ) : (
                        secItems.map((item, index) => {
                          const statusConfig = ATTENDANCE_STATUS_LABELS[item.status] || { label: item.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };
                          const isUserEditingNotes = editingItemId === item.id;

                          return (
                            <div key={item.id} className="p-3 flex flex-col md:flex-row md:items-center md:justify-between hover:bg-slate-50/40 transition gap-3">
                              {/* Employee Info */}
                              <div className="flex items-start space-x-2.5 min-w-[240px]">
                                <span className="text-slate-400 text-xs font-bold font-mono shrink-0 mt-0.5">
                                  {index + 1}.
                                </span>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800 tracking-tight uppercase">{item.employeeName}</h4>
                                  <span className="text-[10px] text-slate-500 font-bold uppercase">{item.employeeRole}</span>
                                  
                                  {/* Status badge and persistent observation view */}
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider border ${statusConfig.color}`}>
                                      {statusConfig.label}
                                    </span>
                                    {item.notes && (
                                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded font-bold uppercase">
                                        Obs: {item.notes}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Status and Notes Editing Form */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 justify-end">
                                {/* Notes Area */}
                                <div className="flex-1 max-w-xs">
                                  {isUserEditingNotes ? (
                                    <div className="flex items-center space-x-1">
                                      <input
                                        type="text"
                                        value={editingNotes}
                                        onChange={(e) => setEditingNotes(e.target.value)}
                                        placeholder="Escreva a observação (ex: ALA VERDE)"
                                        className="block w-full py-1 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSaveItemNotes(item.id)}
                                        className="p-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition cursor-pointer"
                                        title="Salvar"
                                      >
                                        <Save className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingItemId(item.id);
                                        setEditingNotes(item.notes || '');
                                      }}
                                      disabled={isReadOnly(selectedShift)}
                                      className="text-[10px] text-slate-400 hover:text-blue-600 font-bold uppercase tracking-wider underline cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                                    >
                                      {item.notes ? 'Editar Obs.' : '+ Adicionar Obs.'}
                                    </button>
                                  )}
                                </div>

                                {/* Status Selectors (Responsive) */}
                                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                                  {/* Mobile: Styled select dropdown (large tap targets) */}
                                  <div className="block sm:hidden w-full min-w-[130px]">
                                    <select
                                      disabled={isReadOnly(selectedShift)}
                                      value={item.status}
                                      onChange={(e) => handleUpdateItemStatus(item.id, e.target.value as AttendanceStatus)}
                                      className="block w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-45"
                                    >
                                      {(['PRESENTE', 'AUSENTE', 'ATESTADO', 'EXTRA', 'TROCA', 'FAST_TRACK'] as AttendanceStatus[]).map((status) => {
                                        const label = ATTENDANCE_STATUS_LABELS[status]?.label || status;
                                        return (
                                          <option key={status} value={status}>
                                            {label.replace('Plantão ', '').replace(' de Turno', '')}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>

                                  {/* Desktop: Button group */}
                                  <div className="hidden sm:flex flex-wrap gap-0.5">
                                    {(['PRESENTE', 'AUSENTE', 'ATESTADO', 'EXTRA', 'TROCA', 'FAST_TRACK'] as AttendanceStatus[]).map((status) => {
                                      const label = ATTENDANCE_STATUS_LABELS[status]?.label || status;
                                      const isActive = item.status === status;

                                      return (
                                        <button
                                          key={status}
                                          type="button"
                                          disabled={isReadOnly(selectedShift)}
                                          onClick={() => handleUpdateItemStatus(item.id, status)}
                                          className={`px-2 py-1 text-[9px] font-bold rounded cursor-pointer transition border uppercase tracking-wider ${
                                            isActive
                                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                              : 'bg-slate-50 text-slate-500 hover:text-slate-800 border-slate-200 hover:border-slate-300'
                                          } disabled:opacity-40 disabled:pointer-events-none`}
                                        >
                                          {label.replace('Plantão ', '').replace(' de Turno', '')}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {!isReadOnly(selectedShift) && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveEmployeeFromShift(item.id)}
                                      className="p-1 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-100 hover:border-rose-600 rounded-lg transition cursor-pointer shrink-0 ml-1.5"
                                      title="Remover do plantão"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Add Employee Row */}
                    {!isReadOnly(selectedShift) && (
                      <div className="p-2.5 bg-slate-50/50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          Vincular colaborador do cadastro a este setor:
                        </span>
                        <select
                          className="py-1 px-2 bg-white border border-slate-200 rounded-lg text-slate-700 text-[11px] font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[280px]"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddEmployeeToShift(e.target.value, sector);
                              e.target.value = ''; // reset dropdown selection
                            }
                          }}
                        >
                          <option value="">Indicar Colaborador...</option>
                          
                          {masterEmployees
                            .filter((emp) => (emp.sector === sector || emp.sectors?.includes(sector)) && emp.isActive && !secItems.some((item) => item.employeeId === emp.id))
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} ({emp.role})
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3 animate-pulse" />
          <h2 className="text-sm font-bold text-slate-700 uppercase">Nenhum Plantão Iniciado</h2>
          <p className="text-slate-400 text-xs mt-1.5 max-w-xs mx-auto font-medium">
            Não há relatórios de checklists de escalas ativos na base local. Clique em "Iniciar Novo Plantão" para começar.
          </p>
        </div>
      )}

      {/* Hidden high-fidelity UPA administrative sheet for screenshot/pdf capturing */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0', width: '210mm', height: 'auto', overflow: 'hidden', zIndex: -1000, pointerEvents: 'none' }}>
        <div
          ref={printAreaRef}
          className="bg-white p-10 font-sans text-black relative"
          style={{ width: '210mm', minHeight: '295mm', color: '#000000' }}
        >
          {/* Header row with logo boxes exactly like the screenshot */}
          <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
            {/* Left Box: João Pessoa */}
            <div className="border border-black px-4 py-2 text-center" style={{ width: '150px' }}>
              <p className="text-xs font-bold leading-none tracking-tighter" style={{ fontFamily: 'sans-serif' }}>PREFEITURA DE</p>
              <h2 className="text-lg font-black leading-none m-0" style={{ letterSpacing: '-0.5px' }}>JOÃO PESSOA</h2>
              <p className="text-[9px] font-semibold tracking-wide border-t border-black mt-1 pt-0.5">cidade em crescimento</p>
            </div>

            {/* Title Block */}
            <div className="text-center flex-1 px-4">
              <h1 className="text-xl font-extrabold leading-tight tracking-wider" style={{ fontFamily: 'sans-serif' }}>CHECKLIST ADMINISTRATIVO</h1>
              <p className="text-xs font-bold">Unidade de Pronto Atendimento Dr. Luiz Lindbergh Farias</p>
              <p className="text-xs font-black uppercase tracking-widest mt-1">UPA 24 HORAS BANCÁRIOS</p>
              
              {/* Shift Timestamp */}
              <div className="mt-2 text-sm font-bold uppercase tracking-wider font-mono">
                DATA {selectedShift ? selectedShift.date.split('-').reverse().join('/') : ''} - {selectedShift ? selectedShift.period : ''} - {selectedShift ? selectedShift.weekday : ''}
              </div>
            </div>

            {/* Right Box: UPA 24H */}
            <div className="border border-black px-2 py-1.5 flex flex-col items-center justify-center bg-white" style={{ width: '150px', minHeight: '62px' }}>
              <UpaLogo variant="compact" className="h-9 w-auto" />
              <p className="text-[6.5px] font-black border-t border-black mt-1 pt-0.5 text-black leading-tight uppercase">UNIDADE DE PRONTO ATENDIMENTO</p>
              <p className="text-[6.5px] text-slate-800 font-extrabold leading-none mt-0.5 uppercase">DR. LUIZ LINDBERGH FARIAS</p>
            </div>
          </div>

          {/* Core content: Grouped by Sectors, Left box layout exactly like screenshot */}
          <div className="space-y-5">
            {SECTORS.map((sector) => {
              const secItems = groupedItems[sector] || [];
              if (secItems.length === 0) return null;

              return (
                <div key={sector} className="flex items-start">
                  {/* Left Column Box for Sector title */}
                  <div
                    className="border border-black p-2 font-bold text-xs uppercase shrink-0 text-center mr-6"
                    style={{ width: '180px', minHeight: '30px' }}
                  >
                    {sector}
                  </div>

                  {/* Right Column: Numbered Employees list */}
                  <div className="flex-1 space-y-2.5">
                    {secItems.map((item, idx) => (
                      <div key={item.id} className="text-xs">
                        <div className="flex items-baseline">
                          <span className="font-bold mr-2 w-5 text-right font-mono shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="font-bold text-gray-500 uppercase mr-3 w-32 shrink-0">
                            {item.employeeRole}
                          </span>
                          <span className="font-bold text-black uppercase">
                            {item.employeeName}
                          </span>
                          {item.status !== 'PRESENTE' && (
                            <span className="ml-2 px-1 py-0.2 bg-neutral-100 border border-neutral-400 text-neutral-800 font-mono text-[8px] font-black uppercase rounded">
                              ({ATTENDANCE_STATUS_LABELS[item.status]?.label || item.status})
                            </span>
                          )}
                        </div>
                        {item.notes && (
                          <div className="pl-7 text-[10px] text-slate-700 italic font-mono font-medium">
                            Obs: {item.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom signature and observations block */}
          {selectedShift && (
            <div className="mt-12 grid grid-cols-2 gap-8 border-t border-black pt-6">
              {/* Left box: Signature box */}
              <div className="border border-black p-4 flex flex-col justify-between" style={{ minHeight: '100px' }}>
                <p className="text-sm font-bold uppercase font-mono tracking-tight text-center">
                  {selectedShift.coordinatorsName} {selectedShift.coordinatorsRegistration}
                </p>
                <p className="text-[10px] text-center border-t border-dashed border-gray-400 pt-1.5 font-semibold text-slate-500">
                  Assinatura do Profissional/Matrícula
                </p>
              </div>

              {/* Right box: Observations block */}
              <div className="border border-black p-4 flex flex-col justify-between" style={{ minHeight: '100px' }}>
                <p className="text-xs font-bold leading-relaxed">
                  {selectedShift.generalNotes || 'SEM OBSERVAÇÕES ADICIONAIS.'}
                </p>
                <p className="text-[10px] text-center border-t border-dashed border-gray-400 pt-1.5 font-semibold text-slate-500">
                  Observações
                </p>
              </div>
            </div>
          )}

          {/* Printable Footer Stamp */}
          <div className="mt-8 text-center text-[9px] text-gray-400 font-mono tracking-widest uppercase">
            DATA {selectedShift ? selectedShift.date.split('-').reverse().join('/') : ''} - {selectedShift ? selectedShift.period : ''} - {selectedShift ? selectedShift.weekday : ''}
          </div>
        </div>
      </div>

      {/* Create Shift Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 font-sans">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-lg overflow-hidden text-[#1E293B]">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Iniciar Novo Plantão</h3>
              <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider font-bold">
                Defina o dia, turno e o coordenador responsável por assinar.
              </p>
            </div>

            <form onSubmit={handleCreateShift} className="p-5 space-y-3.5">
              {modalError && (
                <div className="p-3 rounded-lg border text-xs font-bold bg-rose-50 border-rose-200 text-rose-700 uppercase">
                  {modalError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Data do Plantão
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="block w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Turno / Período
                  </label>
                  <select
                    value={newPeriod}
                    onChange={(e) => setNewPeriod(e.target.value as any)}
                    className="block w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="DIURNO">DIURNO (7h - 19h)</option>
                    <option value="NOTURNO">NOTURNO (19h - 7h)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Coordenador (Assinatura)
                </label>
                <input
                  type="text"
                  required
                  disabled={true}
                  value={newCoordName}
                  onChange={(e) => setNewCoordName(e.target.value)}
                  placeholder="Ex: SANDRIELE MARINHO"
                  className="block w-full py-1.5 px-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Matrícula do Coordenador
                </label>
                <input
                  type="text"
                  required
                  disabled={true}
                  value={newCoordReg}
                  onChange={(e) => setNewCoordReg(e.target.value)}
                  placeholder="Ex: 1045352"
                  className="block w-full py-1.5 px-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer transition shadow-sm"
                >
                  Iniciar Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Justification Modal */}
      {showJustificationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 font-sans">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-lg overflow-hidden text-[#1E293B]">
            <div className="px-5 py-4 border-b border-slate-100 bg-amber-50">
              <h3 className="text-sm font-black text-amber-800 uppercase tracking-wider flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span>Justificativa de Reabertura</span>
              </h3>
              <p className="text-[10px] text-amber-700 mt-0.5 uppercase tracking-wider font-bold">
                A hora regular deste plantão já encerrou. Justificativa obrigatória necessária.
              </p>
            </div>

            <div className="p-5 space-y-4">
              {modalJustifyError && (
                <div className="p-3 rounded-lg border text-xs font-bold bg-rose-50 border-rose-200 text-rose-700 uppercase">
                  {modalJustifyError}
                </div>
              )}
              <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg text-amber-900 text-xs leading-relaxed font-semibold">
                Este plantão Administrativo ({selectedShift?.date.split('-').reverse().join('/')} — {selectedShift?.period}) já ultrapassou o horário limite de funcionamento. Como Administrador, você pode reabri-lo, mas deve registrar a justificativa oficial.
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Justificativa / Motivo da Reabertura
                </label>
                <textarea
                  required
                  rows={3}
                  value={justificationText}
                  onChange={(e) => setJustificationText(e.target.value)}
                  placeholder="EX: CORREÇÃO DA ESCALA DE TÉCNICOS POR TROCA DE ÚLTIMA HORA SOLICITADA PELA COORDENAÇÃO."
                  className="block w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold uppercase focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none animate-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowJustificationModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReopenWithJustification}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer transition shadow-sm"
                >
                  Confirmar Reabertura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 font-sans">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-lg overflow-hidden text-[#1E293B]">
            <div className="px-5 py-4 border-b border-slate-100 bg-blue-50">
              <h3 className="text-sm font-black text-blue-800 uppercase tracking-wider flex items-center space-x-2">
                <RefreshCw className="h-4 w-4 text-blue-600 animate-spin-slow" />
                <span>Transferir Responsabilidade</span>
              </h3>
              <p className="text-[10px] text-blue-700 mt-0.5 uppercase tracking-wider font-bold">
                Alterar o coordenador responsável por este plantão.
              </p>
            </div>

            <div className="p-5 space-y-4">
              {transferError && (
                <div className="p-3 rounded-lg border text-xs font-bold bg-rose-50 border-rose-200 text-rose-700 uppercase">
                  {transferError}
                </div>
              )}

              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-blue-900 text-xs leading-relaxed font-semibold">
                Ao transferir este plantão, o novo proprietário será associado como o criador oficial e as assinaturas da folha de checklist serão associadas ao nome e matrícula dele.
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Novo Coordenador Responsável
                </label>
                <select
                  value={newOwnerUsername}
                  onChange={(e) => setNewOwnerUsername(e.target.value)}
                  className="block w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">SELECIONE UM COORDENADOR</option>
                  {systemUsers.map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleTransferOwnership}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer transition shadow-sm"
                >
                  Confirmar Transferência
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
