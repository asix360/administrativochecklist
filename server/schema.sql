-- Schema for Checklist de Plantão UPA

-- 1. Users table (App administrators, coordinators, operators)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'ADMIN', 'COORDENADOR', 'OPERADOR'
    registration VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Employee Roles (Job roles e.g. Enfermeiro, Médico Clínico, etc.)
CREATE TABLE IF NOT EXISTS employee_roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- 3. Employees (Master list)
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role_id VARCHAR(50) REFERENCES employee_roles(id) ON DELETE SET NULL,
    role VARCHAR(100) NOT NULL,
    sector VARCHAR(100) NOT NULL,
    sectors TEXT[], -- Array of sectors for multiple assignments
    registration VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE
);

-- 4. Shifts
CREATE TABLE IF NOT EXISTS shifts (
    id VARCHAR(50) PRIMARY KEY,
    date DATE NOT NULL,
    period VARCHAR(20) NOT NULL, -- 'DIURNO', 'NOTURNO'
    weekday VARCHAR(30) NOT NULL,
    coordinators_name VARCHAR(100),
    coordinators_registration VARCHAR(50),
    general_notes TEXT,
    status VARCHAR(20) DEFAULT 'ABERTO', -- 'ABERTO', 'FECHADO'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    reopen_justification TEXT,
    reopened_at TIMESTAMP WITH TIME ZONE,
    reopened_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT unique_date_period UNIQUE (date, period)
);

-- 5. Checklist Items (Attendance entries for each employee in a shift)
CREATE TABLE IF NOT EXISTS checklist_items (
    id VARCHAR(100) PRIMARY KEY,
    shift_id VARCHAR(50) REFERENCES shifts(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE SET NULL,
    employee_name VARCHAR(100) NOT NULL,
    employee_role VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL, -- 'PRESENTE', 'AUSENTE', 'ATESTADO', 'EXTRA', 'TROCA', 'FAST_TRACK'
    notes TEXT,
    sector VARCHAR(100) NOT NULL,
    order_index INT NOT NULL
);

-- 6. Sector Pending Issues
CREATE TABLE IF NOT EXISTS sector_pending_issues (
    id VARCHAR(50) PRIMARY KEY,
    shift_id VARCHAR(50) REFERENCES shifts(id) ON DELETE CASCADE,
    sector VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDENTE', -- 'PENDENTE', 'RESOLVIDO'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL
);

-- 7. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL,
    user_role VARCHAR(20) NOT NULL,
    action VARCHAR(50) NOT NULL,
    details TEXT NOT NULL,
    ip_address VARCHAR(50)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_checklist_shift ON checklist_items(shift_id);
CREATE INDEX IF NOT EXISTS idx_checklist_employee ON checklist_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_issues_shift ON sector_pending_issues(shift_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON audit_logs(timestamp DESC);
