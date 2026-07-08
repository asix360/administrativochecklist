/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Trash2, Edit2, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { User, EmployeeRole, UserRole } from '../types';
import { getEmployeeRoles, saveEmployeeRole, deleteEmployeeRole } from '../utils';

interface RoleManagerProps {
  currentUser: User;
}

export default function RoleManager({ currentUser }: RoleManagerProps) {
  const [roles, setRoles] = useState<EmployeeRole[]>([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Form states
  const [roleId, setRoleId] = useState('');
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const storedRoles = await getEmployeeRoles();
      setRoles(storedRoles);
    } catch (err: any) {
      showMsg(err.message || 'Erro ao carregar cargos.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showMsg('O nome do cargo/função é obrigatório.', 'error');
      return;
    }

    const roleData: EmployeeRole = {
      id: roleId,
      name: name.trim().toUpperCase(),
      isActive
    };

    const result = await saveEmployeeRole(currentUser, roleData);
    if (result.success) {
      showMsg(result.message, 'success');
      resetForm();
      loadRoles();
    } else {
      showMsg(result.message, 'error');
    }
  };

  const handleEdit = (role: EmployeeRole) => {
    setRoleId(role.id);
    setName(role.name);
    setIsActive(role.isActive);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    const confirm = window.confirm('Deseja realmente remover esta Função/Cargo?');
    if (!confirm) return;

    const result = await deleteEmployeeRole(currentUser, id);
    if (result.success) {
      showMsg(result.message, 'success');
      loadRoles();
    } else {
      showMsg(result.message, 'error');
    }
  };

  const resetForm = () => {
    setRoleId('');
    setName('');
    setIsActive(true);
    setIsEditing(false);
  };

  const showMsg = (text: string, type: string) => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const filteredRoles = roles.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto font-sans text-[#1E293B] space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center uppercase">
            <Briefcase className="mr-2.5 h-5 w-5 text-blue-600 shrink-0" />
            Cadastro de Funções & Cargos
          </h1>
          <p className="mt-1 text-slate-500 text-xs font-semibold">
            Cadastre as funções e atribuições clínicas e administrativas para vinculação aos colaboradores.
          </p>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden lg:sticky lg:top-6">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h2 className="text-xs font-black text-slate-800 uppercase">
                {isEditing ? 'Editar Função / Cargo' : 'Nova Função / Cargo'}
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                {isEditing ? 'Modifique os dados da função' : 'Insira um novo cargo para o sistema'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Nome da Função / Cargo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: ENFERMEIRO DIARISTA"
                  className="block w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 bg-slate-50 border-slate-200 rounded"
                />
                <label htmlFor="isActive" className="text-xs font-bold text-slate-600 uppercase select-none">
                  Cargo Ativo para Seleção
                </label>
              </div>

              <div className="pt-3 flex items-center space-x-2">
                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs uppercase py-2 rounded-lg cursor-pointer transition text-center"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase py-2 rounded-lg cursor-pointer transition text-center flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isEditing ? 'Salvar' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <div className="relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Pesquisar por nome da função..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                      Nome da Função / Cargo
                    </th>
                    <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRoles.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-slate-400 text-xs font-medium uppercase">
                        Nenhuma função cadastrada ou encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredRoles.map((role) => (
                      <tr key={role.id} className="hover:bg-slate-50/40 transition duration-100">
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-black text-slate-800 uppercase">
                          {role.name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                            role.isActive 
                              ? 'text-blue-600 bg-blue-50 border-blue-100' 
                              : 'text-slate-500 bg-slate-100 border-slate-200'
                          }`}>
                            {role.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-medium space-x-1.5">
                          <button
                            onClick={() => handleEdit(role)}
                            className="text-slate-400 hover:text-blue-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer transition inline-flex items-center"
                            title="Editar função"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(role.id)}
                            className="text-rose-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 cursor-pointer transition inline-flex items-center"
                            title="Excluir função"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-[10px] text-slate-400 font-mono font-bold">
              <span>Total de {filteredRoles.length} funções cadastradas.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
