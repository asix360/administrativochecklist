/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Users, Search, Plus, Trash2, Edit2, Upload, Table, AlertTriangle, CheckCircle, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { Employee, User, UserRole, EmployeeRole } from '../types';
import { saveEmployee, deleteEmployee, importEmployeesFromText, SECTORS, getEmployeeRoles, getEmployees } from '../utils';

interface EmployeeManagerProps {
  currentUser: User;
}

export default function EmployeeManager({ currentUser }: EmployeeManagerProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availableRoles, setAvailableRoles] = useState<EmployeeRole[]>([]);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Form states
  const [empId, setEmpId] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [roleId, setRoleId] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([SECTORS[0]]);
  const [registration, setRegistration] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Import Spreadsheet States
  const [showImportModal, setShowImportModal] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [parsedPreview, setParsedPreview] = useState<{ name: string; role: string; sector: string; registration: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEmployees();
    loadRoles();
  }, []);

  const loadEmployees = async () => {
    try {
      const raw = await getEmployees();
      const formatted = raw.map(emp => ({
        ...emp,
        sectors: emp.sectors && emp.sectors.length > 0 ? emp.sectors : (emp.sector ? [emp.sector] : [SECTORS[0]])
      }));
      setEmployees(formatted);
    } catch (err: any) {
      showMsg(err.message || 'Erro ao carregar funcionários.', 'error');
    }
  };

  const loadRoles = async () => {
    try {
      const roles = await getEmployeeRoles();
      setAvailableRoles(roles);
    } catch (err: any) {
      showMsg(err.message || 'Erro ao carregar cargos.', 'error');
    }
  };

  const handleToggleSector = (secName: string) => {
    if (selectedSectors.includes(secName)) {
      if (selectedSectors.length > 1) {
        setSelectedSectors(selectedSectors.filter(s => s !== secName));
      } else {
        showMsg('O funcionário deve pertencer a pelo menos um setor.', 'error');
      }
    } else {
      setSelectedSectors([...selectedSectors, secName]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showMsg('O nome do funcionário é obrigatório.', 'error');
      return;
    }
    if (!roleId) {
      showMsg('A seleção de cargo/função é obrigatória.', 'error');
      return;
    }

    const selectedRoleObj = availableRoles.find(r => r.id === roleId);
    const resolvedRoleName = selectedRoleObj ? selectedRoleObj.name : role;

    const empData: Employee = {
      id: empId,
      name: name.trim().toUpperCase(),
      role: resolvedRoleName,
      roleId,
      sector: selectedSectors[0] || SECTORS[0],
      sectors: selectedSectors,
      registration: registration.trim(),
      isActive
    };

    const result = await saveEmployee(currentUser, empData);
    if (result.success) {
      showMsg(result.message, 'success');
      resetForm();
      loadEmployees();
    } else {
      showMsg(result.message, 'error');
    }
  };

  const handleEdit = (emp: Employee) => {
    setEmpId(emp.id);
    setName(emp.name);
    setRole(emp.role);
    setRoleId(emp.roleId || '');
    
    // Fallback if sectors are empty
    const empSectors = emp.sectors && emp.sectors.length > 0 ? emp.sectors : (emp.sector ? [emp.sector] : [SECTORS[0]]);
    setSelectedSectors(empSectors);
    
    setRegistration(emp.registration || '');
    setIsActive(emp.isActive);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    const confirm = window.confirm('Deseja realmente remover este funcionário? Isso não o removerá de relatórios passados, mas ele sairá das escalas futuras.');
    if (!confirm) return;

    const result = await deleteEmployee(currentUser, id);
    if (result.success) {
      showMsg(result.message, 'success');
      loadEmployees();
    } else {
      showMsg(result.message, 'error');
    }
  };

  const handleTextParse = (text: string) => {
    setPasteContent(text);
    if (!text.trim()) {
      setParsedPreview([]);
      return;
    }

    const lines = text.split('\n');
    const preview: typeof parsedPreview = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      let pName = '';
      let pRole = 'Funcionário';
      let pSector = 'ADMINISTRATIVO';
      let pRegistration = '';

      let parts: string[] = [];
      if (line.includes('\t')) {
        parts = line.split('\t');
      } else if (line.includes(';')) {
        parts = line.split(';');
      } else if (line.includes(',')) {
        parts = line.split(',');
      } else {
        parts = [line];
      }

      pName = parts[0].trim();
      if (pName.toLowerCase() === 'nome' || pName.toLowerCase() === 'funcionario' || pName.toLowerCase() === 'funcionário') {
        continue;
      }

      if (parts.length > 1) pRole = parts[1].trim();
      if (parts.length > 2) {
        const matchedSector = SECTORS.find(s => s.toLowerCase() === parts[2].trim().toLowerCase());
        pSector = matchedSector || parts[2].trim().toUpperCase();
      }
      if (parts.length > 3) pRegistration = parts[3].trim();

      if (pName) {
        preview.push({
          name: pName.toUpperCase(),
          role: pRole,
          sector: pSector,
          registration: pRegistration
        });
      }
    }
    setParsedPreview(preview);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleTextParse(text);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (parsedPreview.length === 0) {
      showMsg('Nenhum dado válido para importar.', 'error');
      return;
    }

    const result = await importEmployeesFromText(currentUser, pasteContent);
    if (result.success) {
      showMsg(result.message, 'success');
      setPasteContent('');
      setParsedPreview([]);
      setShowImportModal(false);
      loadEmployees();
      loadRoles(); // reload in case new roles were imported dynamically
    } else {
      showMsg(result.message, 'error');
    }
  };

  const resetForm = () => {
    setEmpId('');
    setName('');
    setRole('');
    setRoleId('');
    setSelectedSectors([SECTORS[0]]);
    setRegistration('');
    setIsActive(true);
    setIsEditing(false);
  };

  const showMsg = (text: string, type: string) => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) || 
                          emp.role.toLowerCase().includes(search.toLowerCase()) ||
                          (emp.registration && emp.registration.toLowerCase().includes(search.toLowerCase()));
    
    const empSectors = emp.sectors && emp.sectors.length > 0 ? emp.sectors : (emp.sector ? [emp.sector] : []);
    const matchesSector = sectorFilter === '' || empSectors.includes(sectorFilter);
    return matchesSearch && matchesSector;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto font-sans text-[#1E293B] space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center uppercase">
            <Users className="mr-2.5 h-5 w-5 text-blue-600 shrink-0" />
            Cadastro de Funcionários
          </h1>
          <p className="mt-1 text-slate-500 text-xs font-semibold">
            Gerencie o corpo clinical, enfermeiros, técnicos, radiologistas e corpo operacional da UPA.
          </p>
        </div>

        <div className="mt-3 md:mt-0 flex items-center space-x-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Importar Planilha</span>
          </button>
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
                {isEditing ? 'Editar Funcionário' : 'Novo Funcionário'}
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                {isEditing ? 'Modifique os dados cadastrais' : 'Insira manualmente um novo colaborador'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: FERNANDA CRISTINA ALMEIDA"
                  className="block w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Função / Cargo
                  </label>
                  <select
                    required
                    value={roleId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setRoleId(selectedId);
                      const matched = availableRoles.find(r => r.id === selectedId);
                      if (matched) {
                        setRole(matched.name);
                      }
                    }}
                    className="block w-full py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {availableRoles.map((r) => (
                      <option key={r.id} value={r.id} disabled={!r.isActive && r.id !== roleId}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Matrícula (Op)
                  </label>
                  <input
                    type="text"
                    value={registration}
                    onChange={(e) => setRegistration(e.target.value)}
                    placeholder="ex: COREN-1234"
                    className="block w-full py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Setores Vinculados (Mais de um permitido)
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 max-h-40 overflow-y-auto space-y-1.5">
                  {SECTORS.map((sec) => {
                    const isChecked = selectedSectors.includes(sec);
                    return (
                      <label key={sec} className="flex items-center space-x-2 text-[11px] font-bold text-slate-700 uppercase cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSector(sec)}
                          className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 bg-white border-slate-200 rounded animate-none"
                        />
                        <span>{sec}</span>
                      </label>
                    );
                  })}
                </div>
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
                  Colaborador Ativo na Escala
                </label>
              </div>

              <div className="pt-3 flex items-center space-x-2">
                {isEditing && (
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
                  <span>{isEditing ? 'Salvar' : 'Cadastrar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List Column */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Pesquisar por nome, cargo ou matrícula..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="block w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold"
              />
            </div>

            <div className="w-full md:w-52">
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

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                      Funcionário
                    </th>
                    <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                      Função
                    </th>
                    <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                      Setores Vinculados
                    </th>
                    <th className="px-4 py-3 text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                      Matrícula
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
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-xs font-medium uppercase">
                        Nenhum colaborador encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const empSectors = emp.sectors && emp.sectors.length > 0 ? emp.sectors : (emp.sector ? [emp.sector] : []);
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/40 transition duration-100">
                          <td className="px-4 py-3 text-xs font-black text-slate-800 uppercase">
                            {emp.name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500 font-bold uppercase">
                            {emp.role}
                          </td>
                          <td className="px-4 py-3 text-[10px] font-bold">
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {empSectors.map((sec) => (
                                <span key={sec} className="text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-[9px] uppercase tracking-wider">
                                  {sec}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-[10px] text-slate-400 font-mono font-bold">
                            {emp.registration || '—'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${
                              emp.isActive 
                                ? 'text-blue-600 bg-blue-50 border-blue-100' 
                                : 'text-slate-500 bg-slate-100 border-slate-200'
                            }`}>
                              {emp.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-xs font-medium space-x-1.5">
                            <button
                              onClick={() => handleEdit(emp)}
                              className="text-slate-400 hover:text-blue-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer transition inline-flex items-center"
                              title="Editar colaborador"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(emp.id)}
                              className="text-rose-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 cursor-pointer transition inline-flex items-center"
                              title="Excluir colaborador"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-[10px] text-slate-400 font-mono font-bold">
              <span>Listando {filteredEmployees.length} de {employees.length} colaboradores cadastrados.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Spreadsheet Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 font-sans">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-lg text-[#1E293B]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase flex items-center">
                  <FileSpreadsheet className="h-5 w-5 text-blue-600 mr-2 shrink-0" />
                  Importar Escala de Funcionários de Planilha
                </h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                  Copie e cole dados do Excel/Sheets ou envie um arquivo .CSV
                </p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition text-xs font-bold border border-slate-200 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* Instructions */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-slate-600 text-xs leading-relaxed space-y-2">
                <p className="font-black text-slate-800 flex items-center text-xs uppercase">
                  <Table className="h-4 w-4 text-blue-600 mr-1.5" />
                  Formato esperado de colunas na planilha:
                </p>
                <div className="grid grid-cols-4 gap-2 font-mono text-center bg-white p-2 rounded-lg border border-slate-200 font-bold text-blue-600 text-[10px] uppercase">
                  <span>Nome Completo</span>
                  <span>Cargo / Função</span>
                  <span>Setor Principal</span>
                  <span>Registro / Matrícula</span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">
                  * Dica: Basta copiar (Ctrl+C) as células dessas 4 colunas no Excel ou Google Sheets e colar (Ctrl+V) no campo de texto abaixo. O sistema identificará as colunas automaticamente por tabulação e registrará automaticamente novas funções identificadas.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Textarea / File input */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Colar Dados da Planilha
                    </label>
                    <textarea
                      rows={8}
                      value={pasteContent}
                      onChange={(e) => handleTextParse(e.target.value)}
                      placeholder="Cole aqui as linhas copias do Excel/Sheets...&#10;Exemplo:&#10;MARIA DE FATIMA COSTA&#9;Auxiliar de Farmácia&#9;FARMÁCIA&#9;CRF-3342&#10;PEDRO ALVES GUERRA&#9;Médico Clínico&#9;MÉDICO CLÍNICO&#9;CRM-9912"
                      className="block w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                    ></textarea>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Ou envie o arquivo:</span>
                    <input
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs uppercase px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center space-x-1.5"
                    >
                      <Upload className="h-3.5 w-3.5 text-blue-600" />
                      <span>Selecionar Arquivo .CSV</span>
                    </button>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="flex flex-col border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                  <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                      Pré-visualização dos Dados
                    </span>
                    <span className="bg-blue-50 text-blue-600 text-[9px] font-bold px-2 py-0.5 rounded border border-blue-200 font-mono">
                      {parsedPreview.length} linhas lidas
                    </span>
                  </div>

                  <div className="flex-1 overflow-auto max-h-[180px] text-xs bg-white">
                    {parsedPreview.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 font-bold uppercase text-[10px]">
                        Nenhum dado colado ou carregado ainda.
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-2 py-1.5 text-left text-[9px] font-bold text-slate-400 uppercase">Nome</th>
                            <th className="px-2 py-1.5 text-left text-[9px] font-bold text-slate-400 uppercase">Função</th>
                            <th className="px-2 py-1.5 text-left text-[9px] font-bold text-slate-400 uppercase">Setor</th>
                            <th className="px-2 py-1.5 text-left text-[9px] font-bold text-slate-400 uppercase">Matrícula</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white font-medium text-[11px]">
                          {parsedPreview.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-2 py-1.5 text-slate-800 font-bold truncate max-w-[120px]" title={item.name}>{item.name}</td>
                              <td className="px-2 py-1.5 text-slate-500 font-bold uppercase truncate max-w-[100px]" title={item.role}>{item.role}</td>
                              <td className="px-2 py-1.5 text-blue-600 truncate max-w-[100px] font-black uppercase" title={item.sector}>{item.sector}</td>
                              <td className="px-2 py-1.5 text-slate-400 font-mono font-bold" title={item.registration}>{item.registration || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs uppercase px-3.5 py-2 rounded-lg cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={parsedPreview.length === 0}
                onClick={handleConfirmImport}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:pointer-events-none text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer transition flex items-center space-x-1.5 shadow-sm"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Confirmar e Importar {parsedPreview.length} Registros</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
