/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, Key, User as UserIcon, Lock, AlertTriangle, Activity } from 'lucide-react';
import { User, UserRole } from '../types';
import { hashPassword, logAction } from '../utils';
import UpaLogo from './UpaLogo';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    try {
      const inputHash = hashPassword(password);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, passwordHash: inputHash })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const msg = errorData.message || 'Usuário ou senha incorretos.';
        setError(errorData.code ? `${msg} [Código: ${errorData.code}]` : msg);
        return;
      }

      const loggedUser = await res.json() as User;

      // Set session
      localStorage.setItem('upa_current_user', JSON.stringify(loggedUser));
      onLoginSuccess(loggedUser);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao se conectar com o servidor.');
    }
  };



  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden text-[#1E293B]">
      {/* Decorative background grids */}
      <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-5 pointer-events-none"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 text-center">
        <UpaLogo variant="full" className="mb-4" />
        <h2 className="mt-4 text-center text-xl font-black text-slate-800 tracking-tight uppercase">
          Checklist de Plantão Administrativo
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-white py-6 px-6 shadow-sm rounded-xl border border-slate-200 sm:px-10">
          <form className="space-y-4" onSubmit={handleLogin}>
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start space-x-2.5">
                <AlertTriangle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-rose-700">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Nome de Usuário
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="h-4 w-4" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs font-semibold"
                  placeholder="ex: sandriele"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Senha de Acesso
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs font-semibold"
                  placeholder="Digite sua senha"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer transition duration-150"
              >
                Autenticar e Entrar
              </button>
            </div>
          </form>


        </div>
        <div className="mt-4 text-center text-[10px] text-slate-400 font-medium uppercase tracking-wider">
          Sistema de Apoio Administrativo • Auditoria e Registro de Atividades Ativo
          <div className="mt-1.5 text-[9px] text-slate-400/80 font-bold lowercase tracking-normal">
            desenvolvido por <span className="uppercase text-slate-500 font-black">Alessandro Santos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
