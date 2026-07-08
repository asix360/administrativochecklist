import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Search, Trash2, Printer, ArrowRight, FileText, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Shift, ChecklistItem, User, UserRole, ShiftPeriod } from '../types';
import { logAction, SECTORS, ATTENDANCE_STATUS_LABELS, getShifts, getChecklistItems, deleteShift, getTrashShifts, restoreShift } from '../utils';
import UpaLogo from './UpaLogo';
import { exportShiftPDF } from '../pdfExporter';

interface ShiftHistoryProps {
  currentUser: User;
  onSelectShift: (shift: Shift) => void;
  onNavigateToView: (view: string) => void;
}

export default function ShiftHistory({ currentUser, onSelectShift, onNavigateToView }: ShiftHistoryProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ABERTO' | 'FECHADO'>('ALL');
  const [periodFilter, setPeriodFilter] = useState<'ALL' | ShiftPeriod>('ALL');
  const [msg, setMsg] = useState({ text: '', type: '' });
  
  // PDF Export state for history items
  const [isExporting, setIsExporting] = useState(false);
  const [exportingShift, setExportingShift] = useState<Shift | null>(null);
  const [exportingItems, setExportingItems] = useState<ChecklistItem[]>([]);
  const historyPrintAreaRef = useRef<HTMLDivElement>(null);

  const [showTrash, setShowTrash] = useState(false);
  const [trashShifts, setTrashShifts] = useState<Shift[]>([]);

  useEffect(() => {
    loadAllShifts();
    if (currentUser.role === UserRole.ADMIN) {
      loadTrashShifts();
    }
  }, []);

  const loadTrashShifts = async () => {
    try {
      const storedTrash = await getTrashShifts(currentUser);
      const sorted = storedTrash.sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return b.period.localeCompare(a.period);
      });
      setTrashShifts(sorted);
    } catch (err: any) {
      console.error(err);
      showMsg(err.message || 'Erro ao carregar lixeira.', 'error');
    }
  };

  const loadAllShifts = async () => {
    try {
      const storedShifts = await getShifts(currentUser);
      // Sort by date desc, then by period desc
      const sorted = storedShifts.sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return b.period.localeCompare(a.period);
      });
      setShifts(sorted);
    } catch (err: any) {
      console.error(err);
      showMsg(err.message || 'Erro ao carregar histórico.', 'error');
    }
  };

  const showMsg = (text: string, type: string) => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const handleOpenShiftInDashboard = (shift: Shift) => {
    onSelectShift(shift);
    onNavigateToView('checklist');
    logAction(currentUser, 'CONSULTA HISTÓRICO', `Abriu checklist de plantão do dia ${shift.date.split('-').reverse().join('/')} (${shift.period}) para visualização.`);
  };

  const handleDeleteShift = async (shiftId: string, shiftDate: string, shiftPeriod: string) => {
    if (currentUser.role !== UserRole.ADMIN) {
      showMsg('Apenas administradores podem excluir registros de plantão.', 'error');
      return;
    }

    const confirmed = window.confirm(`ATENÇÃO: Tem certeza que deseja enviar o plantão do dia ${shiftDate.split('-').reverse().join('/')} (${shiftPeriod}) para a lixeira? Ele poderá ser restaurado a qualquer momento.`);
    if (!confirmed) return;

    const result = await deleteShift(currentUser, shiftId);
    if (result.success) {
      showMsg(result.message, 'success');
      loadAllShifts();
      loadTrashShifts();
    } else {
      showMsg(result.message, 'error');
    }
  };

  const handleRestoreShift = async (shiftId: string, shiftDate: string, shiftPeriod: string) => {
    if (currentUser.role !== UserRole.ADMIN) {
      showMsg('Apenas administradores podem restaurar registros de plantão.', 'error');
      return;
    }

    const confirmed = window.confirm(`Deseja restaurar o plantão do dia ${shiftDate.split('-').reverse().join('/')} (${shiftPeriod}) de volta ao histórico ativo?`);
    if (!confirmed) return;

    const result = await restoreShift(currentUser, shiftId);
    if (result.success) {
      showMsg(result.message, 'success');
      loadAllShifts();
      loadTrashShifts();
    } else {
      showMsg(result.message, 'error');
    }
  };

  const handleExportHistoricalPDF = async (shift: Shift) => {
    setIsExporting(true);
    showMsg(`Iniciando geração de PDF para o plantão ${shift.date.split('-').reverse().join('/')}...`, 'success');

    try {
      const shiftItems = await getChecklistItems(shift.id);
      exportShiftPDF(shift, shiftItems);
      logAction(currentUser, 'EXPORTAÇÃO PDF HISTÓRICO', `Exportou relatório histórico do plantão de ${shift.date} (${shift.period}) em PDF.`);
      showMsg('PDF do histórico gerado e salvo com sucesso!', 'success');
    } catch (err: any) {
      console.error(err);
      showMsg(err.message || 'Erro ao gerar o PDF do histórico.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Group exporting items for the hidden PDF view
  const groupedExportItems = SECTORS.reduce((acc, sector) => {
    acc[sector] = exportingItems.filter((item) => item.sector === sector);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  // Filter shifts based on selections
  const currentShiftsList = showTrash ? trashShifts : shifts;
  const filteredShifts = currentShiftsList.filter((s) => {
    const matchesSearch = 
      s.coordinatorsName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.date.includes(searchQuery) ||
      (s.generalNotes && s.generalNotes.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    const matchesPeriod = periodFilter === 'ALL' || s.period === periodFilter;

    return matchesSearch && matchesStatus && matchesPeriod;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto font-sans text-[#1E293B] space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-4 border-b border-slate-200 gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-5">
          <UpaLogo variant="compact" className="shrink-0 scale-95 origin-left" />
          <div className="md:border-l md:border-slate-200 md:pl-5">
            <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center uppercase">
              Histórico de Plantões {showTrash && <span className="text-rose-600 font-extrabold text-xs ml-2 tracking-normal uppercase border border-rose-100 bg-rose-50 px-1.5 py-0.5 rounded">(Lixeira)</span>}
            </h1>
            <p className="mt-0.5 text-slate-500 text-xs font-semibold">
              {showTrash 
                ? 'Visualize e restaure checklists de plantão que foram enviados para a lixeira.' 
                : 'Consulte e exporte relatórios consolidados de todos os checklists de plantões anteriores.'}
            </p>
          </div>
        </div>

        {currentUser.role === UserRole.ADMIN && (
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 shrink-0">
            <button
              onClick={() => setShowTrash(false)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider cursor-pointer transition ${
                !showTrash 
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Histórico Ativo
            </button>
            <button
              onClick={() => {
                setShowTrash(true);
                loadTrashShifts();
              }}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider cursor-pointer transition flex items-center space-x-1 ${
                showTrash 
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Trash2 className="h-3 w-3 text-rose-500 shrink-0" />
              <span>Lixeira ({trashShifts.length})</span>
            </button>
          </div>
        )}
      </div>

      {msg.text && (
        <div className={`p-3 rounded-lg border text-xs font-bold ${
          msg.type === 'success' 
            ? 'bg-blue-50 border-blue-200 text-blue-700' 
            : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total de Checklists</p>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-slate-800">{shifts.length}</span>
            <span className="text-xs font-bold text-slate-400 uppercase">plantões salvos</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Plantões Fechados</p>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-emerald-600">
              {shifts.filter(s => s.status === 'FECHADO').length}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase">Homologados</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Plantões Ativos</p>
          <div className="flex items-baseline space-x-1.5 mt-1">
            <span className="text-2xl font-black text-blue-600">
              {shifts.filter(s => s.status === 'ABERTO').length}
            </span>
            <span className="text-xs font-bold text-slate-400 uppercase">Em andamento</span>
          </div>
        </div>
      </div>

      {/* Search and Filters bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por Coordenador, data (AAAA-MM-DD)..."
            className="pl-9 pr-4 py-2 block w-full bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">TODOS</option>
              <option value="ABERTO">ABERTO</option>
              <option value="FECHADO">FECHADO / HOMOLOGADO</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Turno:</span>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">TODOS</option>
              <option value="DIURNO">DIURNO</option>
              <option value="NOTURNO">NOTURNO</option>
            </select>
          </div>

          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              setPeriodFilter('ALL');
            }}
            className="text-[10px] text-slate-400 hover:text-blue-600 font-bold uppercase tracking-wider underline cursor-pointer"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* Shifts Table */}
      {filteredShifts.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-3.5 text-[9px] font-black uppercase text-slate-500 tracking-wider">Data do Plantão</th>
                  <th className="p-3.5 text-[9px] font-black uppercase text-slate-500 tracking-wider">Dia da Semana</th>
                  <th className="p-3.5 text-[9px] font-black uppercase text-slate-500 tracking-wider">Turno / Período</th>
                  <th className="p-3.5 text-[9px] font-black uppercase text-slate-500 tracking-wider">Coordenador Responsável</th>
                  <th className="p-3.5 text-[9px] font-black uppercase text-slate-500 tracking-wider">Status</th>
                  <th className="p-3.5 text-[9px] font-black uppercase text-slate-500 tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredShifts.map((s) => {
                  const isClosed = s.status === 'FECHADO';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3.5 text-xs font-bold text-slate-800">
                        {s.date.split('-').reverse().join('/')}
                      </td>
                      <td className="p-3.5 text-xs font-bold text-slate-500 uppercase font-mono">
                        {s.weekday}
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider ${
                          s.period === 'DIURNO' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}>
                          {s.period}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="text-xs font-black text-slate-800 uppercase tracking-tight">
                          {s.coordinatorsName}
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5">
                          Matrícula: {s.coordinatorsRegistration}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-wider ${
                          isClosed 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {isClosed ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          <span>{isClosed ? 'HOMOLOGADO' : 'ABERTO'}</span>
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {showTrash ? (
                            <button
                              onClick={() => handleRestoreShift(s.id, s.date, s.period)}
                              className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-100 hover:border-emerald-600 rounded-lg text-xs font-black transition flex items-center space-x-1 uppercase tracking-wider cursor-pointer"
                              title="Restaurar de volta ao histórico ativo"
                            >
                              <RefreshCw className="h-3 w-3" />
                              <span>Restaurar</span>
                            </button>
                          ) : (
                            <>
                              {/* Print PDF Action */}
                              <button
                                onClick={() => handleExportHistoricalPDF(s)}
                                disabled={isExporting}
                                className="p-1.5 text-slate-500 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition cursor-pointer disabled:opacity-40"
                                title="Exportar PDF de escala"
                              >
                                <Printer className="h-4 w-4" />
                              </button>

                              {/* View in Dashboard Action */}
                              <button
                                onClick={() => handleOpenShiftInDashboard(s)}
                                className="py-1.5 px-3 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-100 hover:border-blue-600 rounded-lg text-xs font-black transition flex items-center space-x-1 uppercase tracking-wider cursor-pointer"
                                title="Abrir no painel ativo"
                              >
                                <span>Trabalhar</span>
                                <ArrowRight className="h-3 w-3" />
                              </button>

                              {/* Delete Action */}
                              {currentUser.role === UserRole.ADMIN && (
                                <button
                                  onClick={() => handleDeleteShift(s.id, s.date, s.period)}
                                  className="p-1.5 text-rose-500 hover:text-white hover:bg-rose-600 border border-rose-100 hover:border-rose-600 rounded-lg transition cursor-pointer"
                                  title="Mover para a lixeira"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3 animate-pulse" />
          <h2 className="text-sm font-bold text-slate-700 uppercase">Nenhum Registro Localizado</h2>
          <p className="text-slate-400 text-xs mt-1.5 max-w-xs mx-auto font-medium">
            Não encontramos checklists que correspondam aos filtros de pesquisa aplicados.
          </p>
        </div>
      )}

      {/* Hidden high-fidelity UPA administrative sheet for generating PDF in the history panel */}
      {exportingShift && (
        <div style={{ position: 'absolute', left: '-9999px', top: '0', zIndex: -2000, pointerEvents: 'none' }}>
          <div
            ref={historyPrintAreaRef}
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
                  DATA {exportingShift.date.split('-').reverse().join('/')} - {exportingShift.period} - {exportingShift.weekday}
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
                const secItems = groupedExportItems[sector] || [];
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
            <div className="mt-12 grid grid-cols-2 gap-8 border-t border-black pt-6">
              {/* Left box: Signature box */}
              <div className="border border-black p-4 flex flex-col justify-between" style={{ minHeight: '100px' }}>
                <p className="text-sm font-bold uppercase font-mono tracking-tight text-center">
                  {exportingShift.coordinatorsName} {exportingShift.coordinatorsRegistration}
                </p>
                <p className="text-[10px] text-center border-t border-dashed border-gray-400 pt-1.5 font-semibold text-slate-500">
                  Assinatura do Profissional/Matrícula
                </p>
              </div>

              {/* Right box: Observations block */}
              <div className="border border-black p-4 flex flex-col justify-between" style={{ minHeight: '100px' }}>
                <p className="text-xs font-bold leading-relaxed">
                  {exportingShift.generalNotes || 'SEM OBSERVAÇÕES ADICIONAIS.'}
                </p>
                <p className="text-[10px] text-center border-t border-dashed border-gray-400 pt-1.5 font-semibold text-slate-500">
                  Observações
                </p>
              </div>
            </div>

            {/* Printable Footer Stamp */}
            <div className="mt-8 text-center text-[9px] text-gray-400 font-mono tracking-widest uppercase">
              DATA {exportingShift.date.split('-').reverse().join('/')} - {exportingShift.period} - {exportingShift.weekday}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
