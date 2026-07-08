/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserCog, Plus, Shield, ShieldCheck, Mail, Key, UserMinus, ToggleLeft, ToggleRight, Check, RefreshCw } from 'lucide-react';
import { User, UserRole } from '../types';
import { hashPassword, logAction, getUsers, saveUser, deleteUser } from '../utils';

interface UserManagerProps {
  currentUser: User;
}

interface DBUser {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  email: string;
  role: UserRole;
  registration?: string;
  isActive: boolean;
  createdAt: string;
}

export default function UserManager({ currentUser }: UserManagerProps) {
  const [users, setUsers] = useState<DBUser[]>([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [registration, setRegistration] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.OPERADOR);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const u = await getUsers();
      setUsers(u as DBUser[]);
    } catch (err: any) {
      showMsg(err.message || 'Erro ao carregar usuários.', 'error');
    }
  };

  const handleCreateOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    if (!username.trim() || !name.trim() || !email.trim()) {
      showMsg('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    const passHash = password.trim() ? hashPassword(password) : undefined;
    const userData = {
      id: editingUserId || undefined,
      username: username.trim().toLowerCase(),
      passwordHash: passHash,
      name: name.trim(),
      email: email.trim(),
      role,
      registration: registration.trim(),
      isActive: true
    };

    const result = await saveUser(currentUser, userData);
    if (result.success) {
      showMsg(result.message, 'success');
      resetForm();
      loadUsers();
    } else {
      showMsg(result.message, 'error');
    }
  };

  const handleToggleStatus = async (userId: string) => {
    if (userId === currentUser.id) {
      showMsg('Você não pode desativar sua própria conta de administrador.', 'error');
      return;
    }

    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    const result = await saveUser(currentUser, {
      ...targetUser,
      isActive: !targetUser.isActive
    });

    if (result.success) {
      showMsg('Status do usuário alterado com sucesso!', 'success');
      loadUsers();
    } else {
      showMsg(result.message, 'error');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      showMsg('Você não pode excluir sua própria conta.', 'error');
      return;
    }

    const confirm = window.confirm('Tem certeza que deseja excluir permanentemente este usuário do sistema?');
    if (!confirm) return;

    const result = await deleteUser(currentUser, userId);
    if (result.success) {
      showMsg(result.message, 'success');
      loadUsers();
    } else {
      showMsg(result.message, 'error');
    }
  };

  const handleEditClick = (user: DBUser) => {
    setEditingUserId(user.id);
    setUsername(user.username);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setRegistration(user.registration || '');
    setPassword(''); // leave blank if no password change
  };

  const resetForm = () => {
    setEditingUserId(null);
    setUsername('');
    setName('');
    setEmail('');
    setRegistration('');
    setPassword('');
    setRole(UserRole.OPERADOR);
  };

  const showMsg = (text: string, type: string) => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const getRoleLabel = (r: UserRole) => {
    switch (r) {
      case UserRole.ADMIN: return 'Administrador';
      case UserRole.COORDENADOR: return 'Coordenador';
      case UserRole.OPERADOR: return 'Operador';
    }
  };

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
            <UserCog className="mr-2.5 h-5 w-5 text-blue-600 shrink-0" />
            Gerenciamento de Contas e Usuários
          </h1>
          <p className="mt-1 text-slate-500 text-xs font-semibold">
            Cadastro de novos operadores e alteração de privilégios de acesso aos dados dos plantões.
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
                {editingUserId ? 'Editar Usuário Existente' : 'Cadastrar Novo Usuário'}
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                {editingUserId ? 'Altere os dados da conta selecionada' : 'Defina os dados de login e permissões'}
              </p>
            </div>

            <form onSubmit={handleCreateOrUpdateUser} className="p-4 space-y-3">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Dr. João Silva"
                  className="block w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Matrícula
                </label>
                <input
                  type="text"
                  value={registration}
                  onChange={(e) => setRegistration(e.target.value)}
                  placeholder="ex: 1045352"
                  className="block w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Endereço de E-mail
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="joao@upa24h.com"
                    className="block w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Nome de Usuário (Login)
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingUserId}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: joaosilva"
                  className="block w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Senha {editingUserId && '(Deixe em branco para não alterar)'}
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <Key className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required={!editingUserId}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUserId ? 'Nova senha se desejar' : 'Senha de acesso'}
                    className="block w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Nível de Permissão (Acesso)
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="block w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={UserRole.OPERADOR}>Operador (Apenas preenche e exporta)</option>
                  <option value={UserRole.COORDENADOR}>Coordenador (Gerencia escalas e pendências)</option>
                  <option value={UserRole.ADMIN}>Administrador (Acesso total e usuários)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center space-x-2">
                {editingUserId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider py-2 rounded-lg cursor-pointer transition text-center"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider py-2 rounded-lg cursor-pointer transition text-center flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{editingUserId ? 'Salvar' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-150 bg-slate-50 flex justify-between items-center">
              <h2 className="text-xs font-black text-slate-800 uppercase">Usuários Cadastrados</h2>
              <span className="bg-slate-200 text-slate-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full font-mono">
                {users.length} usuários
              </span>
            </div>

            <div className="divide-y divide-slate-100 bg-white">
              {users.map((u) => (
                <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50/40 transition">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-black text-sm">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-slate-800 text-xs uppercase tracking-tight">{u.name}</span>
                        <span className="text-slate-400 text-[10px] font-mono font-bold uppercase">@{u.username}</span>
                      </div>
                      <div className="flex items-center space-x-1.5 text-[9px] text-slate-500 mt-0.5 font-bold uppercase font-mono">
                        <span>{u.email}</span>
                        <span>•</span>
                        {u.registration && (
                          <>
                            <span>Matrícula: {u.registration}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>Cadastrado em {new Date(u.createdAt).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="mt-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getRoleBadge(u.role)}`}>
                          <Shield className="h-3 w-3 mr-1" />
                          {getRoleLabel(u.role)}
                        </span>
                        {!u.isActive && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                            Inativo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEditClick(u)}
                      className="text-slate-500 hover:text-blue-600 text-[10px] font-bold uppercase px-2.5 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => handleToggleStatus(u.id)}
                      className={`p-1 rounded-lg border cursor-pointer transition ${
                        u.isActive
                          ? 'text-blue-600 hover:text-blue-700 bg-blue-50 border-blue-200'
                          : 'text-slate-400 hover:text-slate-500 bg-slate-100 border-slate-200'
                      }`}
                      title={u.isActive ? 'Desativar usuário' : 'Ativar usuário'}
                    >
                      {u.isActive ? <ToggleRight className="h-5.5 w-5.5" /> : <ToggleLeft className="h-5.5 w-5.5" />}
                    </button>

                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      disabled={u.id === currentUser.id}
                      className="p-1 text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-100 hover:border-rose-600 rounded-lg transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                      title="Excluir usuário"
                    >
                      <UserMinus className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
