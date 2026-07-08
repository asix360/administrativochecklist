import React, { useState, useEffect } from 'react';
import { User, AttendanceStatus } from '../types';
import { getStatistics, ATTENDANCE_STATUS_LABELS } from '../utils';
import { 
  Activity, 
  Users, 
  Calendar, 
  AlertCircle, 
  Percent,
  TrendingUp,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

interface IndicatorsDashboardProps {
  currentUser: User;
}

interface StatData {
  totalShiftsAnalyzed: number;
  statusCounts: Record<AttendanceStatus, number>;
  presenceRate: number;
  absenteeRate: number;
  sectorStats: Array<{
    sector: string;
    absences: number;
    total: number;
    rate: number;
  }>;
  topAbsentees: Array<{
    name: string;
    role: string;
    absences: number;
    medicalLeaves: number;
    totalShifts: number;
  }>;
  trends: Array<{
    date: string;
    period: 'DIURNO' | 'NOTURNO';
    absences: number;
    total: number;
    rate: number;
  }>;
}

export default function IndicatorsDashboard({ currentUser }: IndicatorsDashboardProps) {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<StatData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const stats = await getStatistics(currentUser, days);
      setData(stats);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao carregar indicadores estatísticos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [days]);

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center h-[60vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Compilando estatísticas da UPA...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center space-x-2">
          <AlertCircle className="h-5 w-5" />
          <span>{error || 'Não foi possível buscar os dados.'}</span>
        </div>
      </div>
    );
  }

  const totalAbsences = (data.statusCounts.AUSENTE || 0) + (data.statusCounts.ATESTADO || 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 font-sans max-w-7xl mx-auto text-[#1E293B]">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <span>Indicadores de Absenteísmo</span>
          </h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
            Monitoramento de presença, faltas e atestados administrativos da UPA.
          </p>
        </div>

        {/* Date Filter selector */}
        <div className="flex bg-slate-200/70 p-0.5 rounded-xl border border-slate-300/30 text-xs font-bold uppercase tracking-wider w-full sm:w-auto">
          {[
            { label: '7 Dias', value: 7 },
            { label: '30 Dias', value: 30 },
            { label: '90 Dias', value: 90 },
            { label: 'Tudo', value: 9999 }
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => setDays(item.value)}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg cursor-pointer transition ${
                days === item.value 
                  ? 'bg-white text-slate-800 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Presence Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Taxa de Presença</p>
            <p className="text-2xl font-black text-emerald-600 tracking-tight">{data.presenceRate}%</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase">Média Geral no Período</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
            <Percent className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Absentee Rate */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Taxa de Absenteísmo</p>
            <p className="text-2xl font-black text-rose-600 tracking-tight">{data.absenteeRate}%</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase">Faltas e Atestados</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        {/* Card 3: Total Absences */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total de Ausências</p>
            <p className="text-2xl font-black text-slate-800 tracking-tight">{totalAbsences}</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase font-mono">
              Faltas ({data.statusCounts.AUSENTE || 0}) • Atestados ({data.statusCounts.ATESTADO || 0})
            </p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-slate-50 text-slate-500 border border-slate-200 flex items-center justify-center">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>

        {/* Card 4: Shifts Checked */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Plantões Analisados</p>
            <p className="text-2xl font-black text-blue-600 tracking-tight">{data.totalShiftsAnalyzed}</p>
            <p className="text-[9px] text-slate-500 font-bold uppercase">Plantões Ativos Fechados</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
            <Calendar className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Row 2: Sector Absentees & Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sector Absentees Bar Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wide">Absenteísmo por Setor</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Porcentagem de faltas e atestados sobre a escala planejada</p>
          </div>

          <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1.5">
            {data.sectorStats.length === 0 ? (
              <div className="text-center text-slate-400 py-12 text-xs font-bold uppercase">Nenhum dado registrado neste período.</div>
            ) : (
              data.sectorStats.map((item) => (
                <div key={item.sector} className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold uppercase">
                    <span className="text-slate-700 tracking-tight">{item.sector}</span>
                    <span className="text-rose-600 font-mono">{item.rate}% ({item.absences} ausências)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 border border-slate-200/50 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.rate > 20 
                          ? 'bg-rose-500' 
                          : item.rate > 10 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(item.rate, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Global Attendance Distribution List */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wide">Detalhamento de Frequência</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Distribuição absoluta de todos os apontamentos de escala</p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {(['PRESENTE', 'AUSENTE', 'ATESTADO', 'EXTRA', 'TROCA', 'FAST_TRACK'] as AttendanceStatus[]).map((status) => {
                const labelInfo = ATTENDANCE_STATUS_LABELS[status];
                const count = data.statusCounts[status] || 0;
                
                return (
                  <div 
                    key={status} 
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <span className="block text-[10px] text-slate-400 font-black uppercase">{labelInfo?.label || status}</span>
                      <span className="text-lg font-black text-slate-800 font-mono mt-0.5 block">{count}</span>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${
                      status === 'PRESENTE' ? 'bg-emerald-500' :
                      status === 'AUSENTE' ? 'bg-rose-500' :
                      status === 'ATESTADO' ? 'bg-amber-500' :
                      status === 'EXTRA' ? 'bg-purple-500' :
                      status === 'TROCA' ? 'bg-blue-500' : 'bg-sky-500'
                    }`}></span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center space-x-2 text-[10px] text-slate-500 font-semibold uppercase bg-slate-50/50 p-2.5 rounded-lg border border-slate-200/50">
            <Users className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              Colaboradores Extras, Trocas de Turno e Fast Track são contabilizados positivamente na taxa de presença geral do plantão.
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Absentees Recurrence & Shift Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shift Absentees Trend Columns */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wide">Tendência Histórica de Ausência</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Evolução do absenteísmo (%) nos últimos 15 plantões finalizados</p>
          </div>

          {data.trends.length === 0 ? (
            <div className="text-center text-slate-400 py-16 text-xs font-bold uppercase">Nenhum plantão fechado para traçar tendências.</div>
          ) : (
            <div className="h-48 flex items-end justify-between gap-1.5 border-b border-slate-200 pb-2 pt-4 px-2">
              {data.trends.map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                  {/* Hover tooltip */}
                  <div className="absolute bottom-full mb-1 bg-slate-800 text-white text-[8px] font-black uppercase rounded py-1 px-1.5 opacity-0 group-hover:opacity-100 transition z-10 pointer-events-none text-center shadow whitespace-nowrap">
                    {item.date.split('-').reverse().slice(0, 2).join('/')} - {item.period === 'NOTURNO' ? 'NOT' : 'DIU'}
                    <br />
                    Absenteísmo: {item.rate}%
                  </div>
                  
                  {/* Column block */}
                  <div 
                    className="w-full rounded-t transition-all group-hover:opacity-80 bg-rose-500/80 hover:bg-rose-600"
                    style={{ height: `${Math.max(item.rate * 1.5, 6)}px`, minHeight: '6px' }}
                  ></div>

                  {/* Short Date Label */}
                  <span className="text-[8px] text-slate-400 font-black mt-2 select-none uppercase scale-90">
                    {item.date.split('-')[2]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Absentees Alert Table */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                <span>Alerta de Reincidência</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Profissionais com mais registros de faltas ou atestados</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-xs font-bold uppercase text-left">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="py-2.5 font-black text-[9px] tracking-wider">Colaborador</th>
                  <th className="py-2.5 font-black text-[9px] tracking-wider">Função</th>
                  <th className="py-2.5 font-black text-[9px] tracking-wider text-center">Faltas</th>
                  <th className="py-2.5 font-black text-[9px] tracking-wider text-center">Atestados</th>
                  <th className="py-2.5 font-black text-[9px] tracking-wider text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                {data.topAbsentees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs font-bold">
                      Nenhum colaborador com faltas registradas.
                    </td>
                  </tr>
                ) : (
                  data.topAbsentees.map((emp, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 pr-2 text-slate-800 font-black tracking-tight">{emp.name}</td>
                      <td className="py-3 text-[10px] text-slate-500">{emp.role}</td>
                      <td className="py-3 text-center text-rose-600 font-mono">{emp.absences}</td>
                      <td className="py-3 text-center text-amber-600 font-mono">{emp.medicalLeaves}</td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black uppercase bg-slate-100 border border-slate-200 text-slate-600">
                          Revisar
                          <ChevronRight className="h-3 w-3 ml-0.5" />
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
