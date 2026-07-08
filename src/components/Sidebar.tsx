/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LayoutDashboard, Users, UserCog, History, ShieldAlert, LogOut, Activity, BadgeAlert, Menu, X, ClipboardList, Briefcase } from 'lucide-react';
import { User, UserRole } from '../types';
import UpaLogo from './UpaLogo';

interface SidebarProps {
  currentUser: User;
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
  pendingIssuesCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  currentUser,
  currentView,
  onViewChange,
  onLogout,
  pendingIssuesCount,
  isOpenMobile = false,
  onCloseMobile
}: SidebarProps) {
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
      case UserRole.COORDENADOR:
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
      case UserRole.OPERADOR:
        return 'bg-sky-500/15 text-sky-400 border border-sky-500/30';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'Administrador';
      case UserRole.COORDENADOR:
        return 'Coordenador';
      case UserRole.OPERADOR:
        return 'Operador';
    }
  };

  const handleItemClick = (viewId: string) => {
    onViewChange(viewId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleLogoutClick = () => {
    onLogout();
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const menuItems = [
    {
      id: 'checklist',
      label: 'Checklist de Plantão',
      icon: LayoutDashboard,
      roles: [UserRole.ADMIN, UserRole.COORDENADOR, UserRole.OPERADOR]
    },
    {
      id: 'indicadores',
      label: 'Painel de Indicadores',
      icon: Activity,
      roles: [UserRole.ADMIN, UserRole.COORDENADOR]
    },
    {
      id: 'historico',
      label: 'Histórico de Plantões',
      icon: ClipboardList,
      roles: [UserRole.ADMIN, UserRole.COORDENADOR, UserRole.OPERADOR]
    },
    {
      id: 'pendencias',
      label: 'Visão de Pendências',
      icon: ShieldAlert,
      roles: [UserRole.ADMIN, UserRole.COORDENADOR, UserRole.OPERADOR],
      badge: pendingIssuesCount > 0 ? pendingIssuesCount : undefined
    },
    {
      id: 'funcionarios',
      label: 'Funcionários',
      icon: Users,
      roles: [UserRole.ADMIN, UserRole.COORDENADOR]
    },
    {
      id: 'cargos',
      label: 'Funções & Cargos',
      icon: Briefcase,
      roles: [UserRole.ADMIN, UserRole.COORDENADOR]
    },
    {
      id: 'usuarios',
      label: 'Cadastro de Usuários',
      icon: UserCog,
      roles: [UserRole.ADMIN]
    },
    {
      id: 'logs',
      label: 'Histórico de Logs',
      icon: History,
      roles: [UserRole.ADMIN, UserRole.COORDENADOR]
    }
  ];

  const renderSidebarContent = () => (
    <div className="flex flex-col justify-between h-full w-full">
      {/* Top Brand Logo */}
      <div>
        <div className="h-16 flex items-center px-4 border-b border-slate-800 bg-slate-950/20 justify-between">
          <UpaLogo variant="horizontal" />
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg bg-slate-800/60 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
 
        {/* Navigation Items */}
        <nav className="mt-6 px-3 space-y-1">
          {menuItems
            .filter((item) => item.roles.includes(currentUser.role))
            .map((item) => {
               const Icon = item.icon;
               const isActive = currentView === item.id;
               return (
                 <button
                   key={item.id}
                   onClick={() => handleItemClick(item.id)}
                   className={`w-full group flex items-center justify-between px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition duration-150 cursor-pointer ${
                     isActive
                       ? 'bg-blue-600 text-white shadow-sm'
                       : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                   }`}
                 >
                   <div className="flex items-center space-x-3">
                     <Icon
                       className={`h-4 w-4 shrink-0 ${
                         isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                       }`}
                     />
                     <span>{item.label}</span>
                   </div>
                   {item.badge !== undefined && (
                     <span
                       className={`ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${
                         isActive ? 'bg-white text-blue-700' : 'bg-rose-500 text-white'
                       }`}
                     >
                       {item.badge}
                     </span>
                   )}
                 </button>
               );
             })}
        </nav>
      </div>
 
      {/* User Session Profile & Log Out */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/20">
        <div className="flex items-center space-x-3 mb-4">
          <div className="h-9 w-9 rounded-full bg-blue-600 border border-slate-700 flex items-center justify-center text-white font-black text-sm shadow-inner shrink-0">
            {currentUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-xs font-bold text-white truncate leading-none">{currentUser.name}</h4>
            <p className="text-[10px] text-slate-500 font-mono truncate leading-none mt-1">{currentUser.email}</p>
            <span className={`inline-block mt-2 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${getRoleBadge(currentUser.role)}`}>
              {getRoleLabel(currentUser.role)}
            </span>
          </div>
        </div>
 
        <button
          onClick={handleLogoutClick}
          className="w-full flex items-center justify-center px-4 py-2 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-slate-400 hover:text-white text-[10px] font-bold uppercase tracking-wider rounded-lg transition duration-150 cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5 mr-2 text-rose-500" />
          Sair do Sistema
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile/tablet screens) */}
      <aside className="hidden lg:flex w-64 bg-[#0F172A] border-r border-slate-800 flex-col justify-between h-screen shrink-0 font-sans">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer (visible on mobile/tablet screens when triggered) */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-55 flex">
          {/* Backdrop blur overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={onCloseMobile}
          />
          
          {/* Drawer content sliding in */}
          <aside className="relative flex-1 flex flex-col max-w-[260px] w-full bg-[#0F172A] border-r border-slate-800 h-screen justify-between shrink-0 font-sans z-10 shadow-2xl animate-fade-in animate-none">
            {renderSidebarContent()}
          </aside>
        </div>
      )}
    </>
  );
}
