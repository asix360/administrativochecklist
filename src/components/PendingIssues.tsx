/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, Clock, AlertTriangle, UserMinus, PlusCircle, Trash2, Hospital } from 'lucide-react';
import { User, SectorPendingIssue, Shift, ChecklistItem, AttendanceStatus } from '../types';
import { logAction, SECTORS, getShifts, getIssues, getChecklistItems, saveIssue, deleteIssue } from '../utils';

interface PendingIssuesProps {
  currentUser: User;
}

export default function PendingIssues({ currentUser }: PendingIssuesProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [issues, setIssues] = useState<SectorPendingIssue[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newIssueSector, setNewIssueSector] = useState(SECTORS[0]);
  const [newIssueDesc, setNewIssueDesc] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const storedShifts = await getShifts();
      setShifts(storedShifts);

      // Find active (ABERTO) shift first, or most recent closed shift
      const openShift = storedShifts.find(s => s.status === 'ABERTO') || storedShifts[0];
      setActiveShift(openShift || null);

      const storedIssues = await getIssues();
      setIssues(storedIssues);

      if (openShift) {
        const shiftItems = await getChecklistItems(openShift.id);
        setChecklistItems(shiftItems);
      } else {
        setChecklistItems([]);
      }
    } catch (err: any) {
      console.error(err);
      showMsg(err.message || 'Erro ao carregar dados.', 'error');
    }
  };

  const handleResolveIssue = async (issueId: string) => {
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;

    try {
      await saveIssue(currentUser, {
        ...issue,
        status: 'RESOLVIDO'
      });
      showMsg('Pendência marcada como resolvida com sucesso!', 'success');
      loadData();
    } catch (err: any) {
      showMsg(err.message || 'Erro ao resolver pendência.', 'error');
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    const confirm = window.confirm('Deseja realmente remover esta pendência?');
    if (!confirm) return;

    try {
      await deleteIssue(currentUser, issueId);
      showMsg('Pendência excluída!', 'success');
      loadData();
    } catch (err: any) {
      showMsg(err.message || 'Erro ao excluir pendência.', 'error');
    }
  };

  const handleAddIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) {
      showMsg('Não há nenhum plantão ativo selecionado para registrar pendências.', 'error');
      return;
    }
    if (!newIssueDesc.trim()) {
      showMsg('Descreva a pendência antes de salvar.', 'error');
      return;
    }

    try {
      await saveIssue(currentUser, {
        shiftId: activeShift.id,
        sector: newIssueSector,
        description: newIssueDesc.trim()
      });
      setNewIssueDesc('');
      showMsg('Pendência do setor adicionada com sucesso!', 'success');
      loadData();
    } catch (err: any) {
      showMsg(err.message || 'Erro ao adicionar pendência.', 'error');
    }
  };

  const showMsg = (text: string, type: string) => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  // Compute stats
  const pendingSectorIssues = issues.filter(i => i.status === 'PENDENTE');
  const absentEmployees = checklistItems.filter(item => item.status === 'AUSENTE' || item.status === 'ATESTADO');
  const totalEmployeesInShift = checklistItems.length;
  const presenceCount = checklistItems.filter(item => item.status === 'PRESENTE' || item.status === 'EXTRA' || item.status === 'TROCA' || item.status === 'FAST_TRACK').length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto font-sans text-[#1E293B] space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center uppercase">
            <ShieldAlert className="mr-2.5 h-5 w-5 text-rose-600 shrink-0" />
            Visão Geral de Pendências & Alertas
          </h1>
          <p className="mt-1 text-slate-500 text-xs font-semibold">
            Monitoramento em tempo real de atestados, faltas e intercorrências administrativas nos setores.
          </p>
        </div>
        
        {activeShift && (
          <div className="mt-3 md:mt-0 flex items-center space-x-2.5 bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm">
            <Hospital className="h-4.5 w-4.5 text-blue-600" />
            <div>
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Plantão Atual Analisado</p>
              <p className="text-xs font-black text-slate-800 uppercase">
                {activeShift.date.split('-').reverse().join('/')} — {activeShift.period} ({activeShift.weekday})
              </p>
            </div>
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

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
            <UserMinus className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ausências / Atestados</p>
            <h3 className="text-xl font-black text-slate-800 mt-0.5">{absentEmployees.length}</h3>
            <p className="text-[10px] text-slate-500 font-medium">Colaboradores fora de escala hoje</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Alertas de Setores Ativos</p>
            <h3 className="text-xl font-black text-slate-800 mt-0.5">{pendingSectorIssues.length}</h3>
            <p className="text-[10px] text-slate-500 font-medium">Pendências administrativas pendentes</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center space-x-3.5">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Presenças Registradas</p>
            <h3 className="text-xl font-black text-slate-800 mt-0.5">
              {totalEmployeesInShift > 0 ? `${presenceCount} / ${totalEmployeesInShift}` : '0 / 0'}
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold">
              {totalEmployeesInShift > 0 
                ? `${Math.round((presenceCount / totalEmployeesInShift) * 100)}% de preenchimento` 
                : 'Escala vazia'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sector Alerts */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-800 uppercase flex items-center">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-500 mr-2 shrink-0" />
                Intercorrências & Ocorrências dos Setores
              </h2>
              <span className="bg-slate-200 text-slate-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full font-mono">
                {pendingSectorIssues.length} pendentes
              </span>
            </div>

            <div className="p-4">
              {issues.length === 0 ? (
                <div className="text-center py-10 text-slate-450">
                  <CheckCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-500 uppercase">Nenhuma intercorrência registrada no sistema.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {issues.map((issue) => (
                    <div
                      key={issue.id}
                      className={`p-3 rounded-lg border transition duration-150 ${
                        issue.status === 'PENDENTE'
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-slate-50/50 border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-mono">
                              {issue.sector}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider border ${
                                issue.status === 'PENDENTE'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {issue.status === 'PENDENTE' ? 'Pendente' : 'Resolvido'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-bold uppercase mt-1.5">{issue.description}</p>
                        </div>
                        
                        <div className="flex items-center space-x-1.5 ml-4">
                          {issue.status === 'PENDENTE' ? (
                            <button
                              onClick={() => handleResolveIssue(issue.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition flex items-center space-x-1"
                            >
                              <CheckCircle className="h-3 w-3" />
                              <span>Resolver</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeleteIssue(issue.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer transition"
                              title="Excluir intercorrência"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400 font-mono font-bold">
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          Registrado em {new Date(issue.createdAt).toLocaleString('pt-BR')}
                        </span>
                        {issue.status === 'RESOLVIDO' && issue.resolvedAt && (
                          <span className="text-emerald-600">
                            Resolvido em {new Date(issue.resolvedAt).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Register Issue */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <h3 className="text-xs font-black text-slate-800 uppercase flex items-center">
                <PlusCircle className="h-4.5 w-4.5 text-blue-600 mr-2 shrink-0" />
                Registrar Nova Intercorrência Administrativa
              </h3>
            </div>
            <form onSubmit={handleAddIssue} className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-4">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Setor Afetado</label>
                  <select
                    value={newIssueSector}
                    onChange={(e) => setNewIssueSector(e.target.value)}
                    className="block w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {SECTORS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-8">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descrição do Problema / Pendência</label>
                  <input
                    type="text"
                    value={newIssueDesc}
                    onChange={(e) => setNewIssueDesc(e.target.value)}
                    placeholder="ex: Ar-condicionado quebrado na recepção"
                    className="block w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg cursor-pointer transition flex items-center space-x-1.5 shadow-sm"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>Adicionar Pendência</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Absent Personnel List */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="text-xs font-black text-slate-800 uppercase flex items-center">
                <UserMinus className="h-4.5 w-4.5 text-rose-600 mr-2 shrink-0" />
                Ausentes do Plantão Ativo
              </h2>
              <span className="bg-slate-200 text-slate-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full font-mono">
                {absentEmployees.length} ausências
              </span>
            </div>

            <div className="p-4 flex-1 overflow-y-auto max-h-[560px]">
              {absentEmployees.length === 0 ? (
                <div className="text-center py-12 text-slate-450 h-full flex flex-col justify-center items-center">
                  <CheckCircle className="h-10 w-10 text-blue-600 mb-2" />
                  <p className="text-xs font-semibold text-slate-500 uppercase">Todos os colaboradores estão presentes!</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Escala 100% preenchida.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {absentEmployees.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50/50 rounded-lg border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0"
                    >
                      <div>
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{item.employeeName}</h4>
                        <div className="flex items-center space-x-1.5 mt-0.5 text-[9px] text-slate-500 font-bold uppercase font-mono">
                          <span>{item.employeeRole}</span>
                          <span>•</span>
                          <span className="text-slate-600">{item.sector}</span>
                        </div>
                        {item.notes && (
                          <p className="text-[9px] text-rose-700 mt-1 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 inline-block font-bold uppercase">
                            Motivo: {item.notes}
                          </p>
                        )}
                      </div>

                      <div>
                        <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          item.status === 'AUSENTE'
                            ? 'bg-rose-50 text-rose-600 border-rose-100'
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {item.status === 'AUSENTE' ? 'FALTA' : 'ATESTADO'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
