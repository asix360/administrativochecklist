/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, UserRole, SectorPendingIssue, ChecklistItem, Shift } from './types';
import { initializeDatabase, logAction, getShifts, getIssues, getChecklistItems } from './utils';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PendingIssues from './components/PendingIssues';
import EmployeeManager from './components/EmployeeManager';
import RoleManager from './components/RoleManager';
import UserManager from './components/UserManager';
import LogViewer from './components/LogViewer';
import ShiftHistory from './components/ShiftHistory';
import IndicatorsDashboard from './components/IndicatorsDashboard';
import { Menu } from 'lucide-react';
import UpaLogo from './components/UpaLogo';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<string>('checklist');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [selectedShiftId, setSelectedShiftId] = useState<string | undefined>(undefined);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    // Run DB and system seed initialization
    initializeDatabase();

    // Recover session if exists
    const sessionUserStr = localStorage.getItem('upa_current_user');
    if (sessionUserStr) {
      try {
        const user = JSON.parse(sessionUserStr) as User;
        setCurrentUser(user);
      } catch (e) {
        localStorage.removeItem('upa_current_user');
      }
    }
  }, []);

  // Recalculate pending badge alerts globally
  useEffect(() => {
    if (currentUser) {
      calculatePendingIssues();
      // Setup periodic calculation
      const timer = setInterval(() => {
        calculatePendingIssues();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [currentUser, currentView]);

  const calculatePendingIssues = async () => {
    try {
      // Sector alerts count (unresolved)
      const storedIssues = await getIssues();
      const activeSectorIssuesCount = storedIssues.filter(i => i.status === 'PENDENTE').length;

      // Absenteeism count in currently active/open shift
      const storedShifts = await getShifts();
      const openShift = storedShifts.find(s => s.status === 'ABERTO') || storedShifts[0];
      
      let absenteesCount = 0;
      if (openShift) {
        const shiftItems = await getChecklistItems(openShift.id);
        absenteesCount = shiftItems.filter(item => item.status === 'AUSENTE' || item.status === 'ATESTADO').length;
      }

      setPendingCount(activeSectorIssuesCount + absenteesCount);
    } catch (err) {
      console.error('Erro ao calcular pendências:', err);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    // Reset view to default
    setCurrentView('checklist');
  };

  const handleLogout = () => {
    if (currentUser) {
      logAction(currentUser, 'LOGOUT', 'Efetuou logout voluntário e encerrou sessão.');
      localStorage.removeItem('upa_current_user');
      setCurrentUser(null);
    }
  };

  // Render sub-view
  const renderActiveView = () => {
    if (!currentUser) return null;

    switch (currentView) {
      case 'checklist':
        return (
          <Dashboard
            currentUser={currentUser}
            initialShiftId={selectedShiftId}
            onClearInitialShiftId={() => setSelectedShiftId(undefined)}
          />
        );
      case 'indicadores':
        if (currentUser.role === UserRole.OPERADOR) {
          setCurrentView('checklist');
          return <Dashboard currentUser={currentUser} />;
        }
        return <IndicatorsDashboard currentUser={currentUser} />;
      case 'historico':
        return (
          <ShiftHistory
            currentUser={currentUser}
            onSelectShift={(shift) => setSelectedShiftId(shift.id)}
            onNavigateToView={(view) => setCurrentView(view)}
          />
        );
      case 'pendencias':
        return <PendingIssues currentUser={currentUser} />;
      case 'funcionarios':
        // Guards
        if (currentUser.role === UserRole.OPERADOR) {
          setCurrentView('checklist');
          return <Dashboard currentUser={currentUser} />;
        }
        return <EmployeeManager currentUser={currentUser} />;
      case 'cargos':
        if (currentUser.role === UserRole.OPERADOR) {
          setCurrentView('checklist');
          return <Dashboard currentUser={currentUser} />;
        }
        return <RoleManager currentUser={currentUser} />;
      case 'usuarios':
        if (currentUser.role !== UserRole.ADMIN) {
          setCurrentView('checklist');
          return <Dashboard currentUser={currentUser} />;
        }
        return <UserManager currentUser={currentUser} />;
      case 'logs':
        if (currentUser.role === UserRole.OPERADOR) {
          setCurrentView('checklist');
          return <Dashboard currentUser={currentUser} />;
        }
        return <LogViewer currentUser={currentUser} />;
      default:
        return <Dashboard currentUser={currentUser} />;
    }
  };

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#F1F5F9] text-[#1E293B] overflow-hidden font-sans">
      {/* Mobile Header Bar */}
      <div className="lg:hidden h-16 bg-[#0F172A] border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white focus:outline-none cursor-pointer"
          >
            <Menu className="h-6 w-6" />
          </button>
          <UpaLogo variant="horizontal" />
        </div>
        <div className="h-8 w-8 rounded-full bg-blue-600 border border-slate-700 flex items-center justify-center text-white font-black text-xs shrink-0">
          {currentUser.name.slice(0, 2).toUpperCase()}
        </div>
      </div>

      {/* Navigation Sidebar */}
      <Sidebar
        currentUser={currentUser}
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view)}
        onLogout={handleLogout}
        pendingIssuesCount={pendingCount}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main viewport */}
      <main className="flex-1 overflow-y-auto bg-[#F1F5F9] relative">
        {renderActiveView()}
      </main>
    </div>
  );
}
