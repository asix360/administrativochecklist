/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { History, Search, Filter, Shield, Calendar, RefreshCw } from 'lucide-react';
import { AuditLog, User, UserRole } from '../types';
import { getLogs } from '../utils';

interface LogViewerProps {
  currentUser: User;
}

export default function LogViewer({ currentUser }: LogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const rawLogs = await getLogs();
      setLogs(rawLogs);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.username.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === '' || log.action === actionFilter;
    const matchesRole = roleFilter === '' || log.userRole === roleFilter;

    return matchesSearch && matchesAction && matchesRole;
  });

  // Get unique actions for filter
  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'text-rose-600 bg-rose-50 border-rose-100';
      case UserRole.COORDENADOR:
        return 'text-amber-600 bg-amber-50 border-amber-100';
      case UserRole.OPERADOR:
        return 'text-blue-600 bg-blue-50 border-blue-100';
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto font-sans text-[#1E293B] space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center uppercase">
            <History className="mr-2.5 h-5 w-5 text-blue-600 shrink-0" />
            Histórico de Logs & Auditoria
          </h1>
          <p className="mt-1 text-slate-500 text-xs font-semibold">
            Rastreabilidade total das atividades administrativas, acessos ao sistema e modificações das escalas.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="mt-3 md:mt-0 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Atualizar Logs</span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative rounded-lg shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar por usuário, ação ou detalhe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold"
          />
        </div>

        {/* Filter by Action */}
        <div className="w-full md:w-52">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="block w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Ações (Todas)</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        {/* Filter by Role */}
        <div className="w-full md:w-48">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="block w-full py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Nível de Acesso (Todos)</option>
            <option value={UserRole.ADMIN}>Administrador</option>
            <option value={UserRole.COORDENADOR}>Coordenador</option>
            <option value={UserRole.OPERADOR}>Operador</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                  Data / Hora
                </th>
                <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                  Usuário
                </th>
                <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                  Nível
                </th>
                <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                  Ação
                </th>
                <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                  Descrição dos Fatos
                </th>
                <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                  Endereço IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-xs font-medium uppercase">
                    Nenhum registro de log encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/40 transition duration-100">
                    <td className="px-4 py-3 whitespace-nowrap text-[10px] text-slate-400 font-mono font-bold">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        <span>{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-black text-slate-800 uppercase">
                      {log.username}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getRoleBadge(log.userRole)}`}>
                        {log.userRole}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[10px] font-bold font-mono">
                      <span className="text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded uppercase">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 font-bold uppercase">
                      {log.details}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[10px] text-slate-400 font-mono font-bold">
                      {log.ipAddress || '192.168.1.100'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-[10px] text-slate-400 font-mono font-bold">
          <span>
            Exibindo {filteredLogs.length} de {logs.length} registros auditados.
          </span>
          <span>
            * Logs de sistema são imutáveis e persistidos no dispositivo local do navegador.
          </span>
        </div>
      </div>
    </div>
  );
}
