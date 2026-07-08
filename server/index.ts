import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool, initializeDatabase } from './db';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper function to log audit actions in DB
async function logAction(userId: string, username: string, userRole: string, action: string, details: string, req: Request) {
  const ipAddress = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1';
  const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  try {
    await pool.query(
      `INSERT INTO audit_logs (id, user_id, username, user_role, action, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, userId, username, userRole, action, details, ipAddress]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// Global logger helper endpoint (for client-side events like exports/logouts)
app.post('/api/logs', async (req: Request, res: Response) => {
  const { user, action, details } = req.body;
  if (!user) return res.status(400).json({ message: 'User object required.', code: 'ERR_VALIDATION_FAILED' });
  await logAction(user.id, user.username, user.role, action, details, req);
  res.json({ success: true });
});

// Authentication Route
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, passwordHash } = req.body;
  try {
    const userRes = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );
    if (userRes.rows.length === 0) {
      return res.status(401).json({ message: 'Usuário não encontrado ou inativo.', code: 'ERR_AUTH_FAILED' });
    }
    const user = userRes.rows[0];
    if (user.password_hash !== passwordHash) {
      return res.status(401).json({ message: 'Senha incorreta.', code: 'ERR_AUTH_FAILED' });
    }

    const clientUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      registration: user.registration,
      isActive: user.is_active,
      createdAt: user.created_at
    };

    await logAction(clientUser.id, clientUser.username, clientUser.role, 'LOGIN', 'Efetuou login no sistema.', req);
    res.json(clientUser);
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

// Helper function to construct a Date object representing a specific date and time in a target timezone
function getTzDate(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const utcDate = new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23'
  });
  
  const parts = formatter.formatToParts(utcDate);
  const getVal = (type: string) => parseInt(parts.find(p => p.type === type)!.value, 10);
  
  const formattedYear = getVal('year');
  const formattedMonth = getVal('month') - 1;
  const formattedDay = getVal('day');
  const formattedHour = getVal('hour');
  const formattedMinute = getVal('minute');
  
  const targetUtc = Date.UTC(year, month, day, hour, minute, 0, 0);
  const formattedUtc = Date.UTC(formattedYear, formattedMonth, formattedDay, formattedHour, formattedMinute, 0, 0);
  
  const diff = targetUtc - formattedUtc;
  
  return new Date(utcDate.getTime() + diff);
}

// Helper function to check if a shift has expired
function isShiftExpired(dateVal: Date | string, period: string): boolean {
  try {
    const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
    const dateStr = d.toISOString().split('T')[0];
    const [year, month, day] = dateStr.split('-').map(Number);
    
    let endHour = 18;
    let endMinute = 55;
    let endDayOffset = 0;
    
    if (period === 'NOTURNO') {
      endHour = 6;
      endMinute = 55;
      endDayOffset = 1;
    }
    
    const targetDate = new Date(Date.UTC(year, month - 1, day + endDayOffset));
    const targetYear = targetDate.getUTCFullYear();
    const targetMonth = targetDate.getUTCMonth();
    const targetDay = targetDate.getUTCDate();
    
    const endShiftDate = getTzDate(targetYear, targetMonth, targetDay, endHour, endMinute, 'America/Sao_Paulo');
    return new Date() > endShiftDate;
  } catch (e) {
    console.error('Error parsing shift expiry:', e);
    return false;
  }
}

// Helper to format PostgreSQL errors into user-friendly error codes and messages
function handleDatabaseError(err: any): { status: number; message: string; code: string } {
  console.error('Database/Server Error:', err);
  
  if (err && err.code) {
    switch (err.code) {
      case '23505': // Unique key violation
        return { 
          status: 400, 
          message: 'Este registro já existe no sistema.', 
          code: 'ERR_DUPLICATE_RECORD' 
        };
      case '23503': // Foreign key violation
        return { 
          status: 400, 
          message: 'O registro de referência fornecido não é válido.', 
          code: 'ERR_INVALID_REFERENCE' 
        };
      case '23502': // Not null violation
        return { 
          status: 400, 
          message: 'Um campo obrigatório não foi preenchido.', 
          code: 'ERR_MISSING_REQUIRED_FIELD' 
        };
      case '08003': // Connection does not exist
      case '08006': // Connection failure
      case '57P01': // Admin shutdown / DB pool ended
        return { 
          status: 500, 
          message: 'Erro de comunicação temporário com o banco de dados. Tente novamente.', 
          code: 'ERR_DB_CONNECTION_FAILURE' 
        };
    }
  }

  return { 
    status: 500, 
    message: err.message || 'Ocorreu um erro interno no servidor.', 
    code: 'ERR_INTERNAL_SERVER' 
  };
}

// Helper to check if checklist items for a shift can be edited
async function isShiftEditable(shiftId: string): Promise<boolean> {
  try {
    const res = await pool.query('SELECT * FROM shifts WHERE id = $1', [shiftId]);
    if (res.rows.length === 0) return false;
    const shift = res.rows[0];
    if (shift.is_deleted) return false;
    if (shift.status === 'FECHADO') return false;
    if (isShiftExpired(shift.date, shift.period) && !shift.reopen_justification) {
      return false;
    }
    return true;
  } catch (e) {
    console.error('Error checking shift editability:', e);
    return false;
  }
}

// Helper to check if the current user has permission to modify the shift (only creator or ADMIN)
async function canUserModifyShift(shiftId: string, user: any): Promise<boolean> {
  try {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    
    const res = await pool.query('SELECT created_by FROM shifts WHERE id = $1', [shiftId]);
    if (res.rows.length === 0) return false;
    
    return res.rows[0].created_by === user.id;
  } catch (e) {
    console.error('Error checking shift modification permissions:', e);
    return false;
  }
}

// Background function to close active shifts that are past their end time
async function autoCloseExpiredShifts() {
  try {
    const openShiftsRes = await pool.query("SELECT * FROM shifts WHERE status = 'ABERTO' AND is_deleted = false");
    for (const shift of openShiftsRes.rows) {
      if (isShiftExpired(shift.date, shift.period)) {
        await pool.query(
          "UPDATE shifts SET status = 'FECHADO', closed_at = NOW(), closed_by = 'system' WHERE id = $1",
          [shift.id]
        );
        
        const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        const dateFormatted = shift.date.toISOString().split('T')[0].split('-').reverse().join('/');
        const details = `Plantão do dia ${dateFormatted} (${shift.period}) foi fechado automaticamente no encerramento do expediente.`;
        await pool.query(
          `INSERT INTO audit_logs (id, user_id, username, user_role, action, details, ip_address)
           VALUES ($1, 'system', 'sistema', 'SISTEMA', 'FECHAMENTO AUTOMÁTICO', $2, '127.0.0.1')`,
          [logId, details]
        );
        
        console.log(`Shift ${shift.id} auto-closed successfully.`);
      }
    }
  } catch (err) {
    console.error('Error auto-closing shifts:', err);
  }
}

// Run check periodically every 30 seconds if not testing
if (process.env.NODE_ENV !== 'test') {
  setInterval(autoCloseExpiredShifts, 30000);
}

// Shift routes
app.get('/api/shifts', async (req: Request, res: Response) => {
  const role = req.query.role as string;
  const userId = req.query.userId as string;

  try {
    await autoCloseExpiredShifts();
    
    let queryText = 'SELECT * FROM shifts WHERE is_deleted = false';
    let queryParams: any[] = [];
    
    if (role === 'OPERADOR' && userId) {
      queryText += ' AND created_by = $1';
      queryParams.push(userId);
    }
    
    queryText += ' ORDER BY date DESC, period DESC';
    
    const shiftsRes = await pool.query(queryText, queryParams);
    // Format to match frontend models (naming style)
    const formatted = shiftsRes.rows.map(s => ({
      id: s.id,
      date: s.date.toISOString().split('T')[0], // YYYY-MM-DD
      period: s.period,
      weekday: s.weekday,
      coordinatorsName: s.coordinators_name,
      coordinatorsRegistration: s.coordinators_registration,
      generalNotes: s.general_notes,
      status: s.status,
      createdAt: s.created_at,
      createdBy: s.created_by,
      closedAt: s.closed_at,
      closedBy: s.closed_by,
      reopenJustification: s.reopen_justification,
      reopenedAt: s.reopened_at,
      reopenedBy: s.reopened_by
    }));
    res.json(formatted);
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.get('/api/shifts/trash', async (req: Request, res: Response) => {
  try {
    const role = req.query.role as string;
    if (role !== 'ADMIN') {
      return res.status(403).json({ message: 'Apenas administradores podem acessar a lixeira.', code: 'ERR_FORBIDDEN' });
    }
    const trashRes = await pool.query('SELECT * FROM shifts WHERE is_deleted = true ORDER BY date DESC, period DESC');
    const formatted = trashRes.rows.map(s => ({
      id: s.id,
      date: s.date.toISOString().split('T')[0],
      period: s.period,
      weekday: s.weekday,
      coordinatorsName: s.coordinators_name,
      coordinatorsRegistration: s.coordinators_registration,
      generalNotes: s.general_notes,
      status: s.status,
      createdAt: s.created_at,
      createdBy: s.created_by,
      closedAt: s.closed_at,
      closedBy: s.closed_by,
      reopenJustification: s.reopen_justification,
      reopenedAt: s.reopened_at,
      reopenedBy: s.reopened_by
    }));
    res.json(formatted);
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.get('/api/statistics', async (req: Request, res: Response) => {
  const role = req.query.role as string;
  if (role !== 'ADMIN' && role !== 'COORDENADOR') {
    return res.status(403).json({ message: 'Apenas administradores e coordenadores podem acessar os indicadores.', code: 'ERR_FORBIDDEN' });
  }

  const rangeDays = parseInt(req.query.days as string, 10) || 30;
  let dateFilter = '';
  let queryParams: any[] = [];
  if (rangeDays > 0 && rangeDays < 999) {
    dateFilter = `AND s.date >= NOW() - CAST($1 || ' days' AS INTERVAL)`;
    queryParams.push(rangeDays);
  }

  try {
    // 1. Fetch total shifts
    const shiftsCountRes = await pool.query(
      `SELECT COUNT(*) FROM shifts s WHERE s.is_deleted = false ${dateFilter}`,
      queryParams
    );
    const totalShiftsAnalyzed = parseInt(shiftsCountRes.rows[0].count, 10);

    // 2. Aggregate count of statuses globally
    const statusAggRes = await pool.query(
      `SELECT ci.status, COUNT(*) as count 
       FROM checklist_items ci
       JOIN shifts s ON ci.shift_id = s.id
       WHERE s.is_deleted = false ${dateFilter}
       GROUP BY ci.status`,
      queryParams
    );
    
    const statusCounts = statusAggRes.rows.reduce((acc: any, row: any) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, { PRESENTE: 0, AUSENTE: 0, ATESTADO: 0, EXTRA: 0, TROCA: 0, FAST_TRACK: 0 });

    const totalPresent = (statusCounts.PRESENTE || 0) + (statusCounts.EXTRA || 0) + (statusCounts.TROCA || 0) + (statusCounts.FAST_TRACK || 0);
    const totalAbsent = statusCounts.AUSENTE || 0;
    const totalAtestado = statusCounts.ATESTADO || 0;
    const totalAllocations = totalPresent + totalAbsent + totalAtestado;

    const presenceRate = totalAllocations > 0 ? parseFloat(((totalPresent / totalAllocations) * 100).toFixed(1)) : 100.0;
    const absenteeRate = totalAllocations > 0 ? parseFloat((((totalAbsent + totalAtestado) / totalAllocations) * 100).toFixed(1)) : 0.0;

    // 3. Aggregate absentees by sector
    const sectorAggRes = await pool.query(
      `SELECT ci.sector, 
              COUNT(CASE WHEN ci.status IN ('AUSENTE', 'ATESTADO') THEN 1 END) as absences,
              COUNT(*) as total
       FROM checklist_items ci
       JOIN shifts s ON ci.shift_id = s.id
       WHERE s.is_deleted = false ${dateFilter}
       GROUP BY ci.sector
       ORDER BY absences DESC`,
      queryParams
    );
    
    const sectorStats = sectorAggRes.rows.map((row: any) => {
      const absences = parseInt(row.absences, 10);
      const total = parseInt(row.total, 10);
      const rate = total > 0 ? parseFloat(((absences / total) * 100).toFixed(1)) : 0.0;
      return {
        sector: row.sector,
        absences,
        total,
        rate
      };
    });

    // 4. Ranking of most absent employees (reincidencia)
    const recurrenceRes = await pool.query(
      `SELECT ci.employee_name as name, ci.employee_role as role,
              COUNT(CASE WHEN ci.status = 'AUSENTE' THEN 1 END) as absences,
              COUNT(CASE WHEN ci.status = 'ATESTADO' THEN 1 END) as medical_leaves,
              COUNT(*) as total_shifts
       FROM checklist_items ci
       JOIN shifts s ON ci.shift_id = s.id
       WHERE s.is_deleted = false ${dateFilter}
       GROUP BY ci.employee_name, ci.employee_role
       HAVING COUNT(CASE WHEN ci.status IN ('AUSENTE', 'ATESTADO') THEN 1 END) > 0
       ORDER BY (COUNT(CASE WHEN ci.status = 'AUSENTE' THEN 1 END) + COUNT(CASE WHEN ci.status = 'ATESTADO' THEN 1 END)) DESC
       LIMIT 10`,
      queryParams
    );
    
    const topAbsentees = recurrenceRes.rows.map((row: any) => ({
      name: row.name,
      role: row.role,
      absences: parseInt(row.absences, 10),
      medicalLeaves: parseInt(row.medical_leaves, 10),
      totalShifts: parseInt(row.total_shifts, 10)
    }));

    // 5. Shift trends over time (limit 15 shifts)
    const trendRes = await pool.query(
      `SELECT s.id, s.date, s.period,
              COUNT(CASE WHEN ci.status IN ('AUSENTE', 'ATESTADO') THEN 1 END) as absences,
              COUNT(*) as total
       FROM shifts s
       LEFT JOIN checklist_items ci ON s.id = ci.shift_id
       WHERE s.is_deleted = false
       GROUP BY s.id, s.date, s.period
       ORDER BY s.date DESC, s.period DESC
       LIMIT 15`
    );
    
    const trends = trendRes.rows.map((row: any) => {
      const absences = parseInt(row.absences, 10);
      const total = parseInt(row.total, 10);
      const rate = total > 0 ? parseFloat(((absences / total) * 100).toFixed(1)) : 0.0;
      return {
        date: row.date.toISOString().split('T')[0],
        period: row.period,
        absences,
        total,
        rate
      };
    }).reverse();

    res.json({
      totalShiftsAnalyzed,
      statusCounts,
      presenceRate,
      absenteeRate,
      sectorStats,
      topAbsentees,
      trends
    });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.post('/api/shifts', async (req: Request, res: Response) => {
  const { date, period, weekday, coordinatorsName, coordinatorsRegistration, generalNotes, createdBy, user } = req.body;
  
  // Validation checks following best practices
  if (!date || !period || !weekday || !coordinatorsName || !coordinatorsRegistration) {
    return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser fornecidos.', code: 'ERR_VALIDATION_FAILED' });
  }
  if (period !== 'DIURNO' && period !== 'NOTURNO') {
    return res.status(400).json({ message: 'Período de plantão inválido.', code: 'ERR_VALIDATION_FAILED' });
  }
  if (coordinatorsName.length > 100 || coordinatorsRegistration.length > 50) {
    return res.status(400).json({ message: 'Nome ou matrícula do coordenador excede o tamanho limite permitido.', code: 'ERR_VALIDATION_FAILED' });
  }
  if (generalNotes && generalNotes.length > 1000) {
    return res.status(400).json({ message: 'Observações excedem o tamanho máximo de 1000 caracteres.', code: 'ERR_VALIDATION_FAILED' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Duplicate check
    const duplicateRes = await client.query(
      'SELECT id, is_deleted FROM shifts WHERE date = $1 AND period = $2',
      [date, period]
    );
    if (duplicateRes.rows.length > 0) {
      await client.query('ROLLBACK');
      const isDel = duplicateRes.rows[0].is_deleted;
      const formattedDate = date.split('-').reverse().join('/');
      if (isDel) {
        return res.status(400).json({ 
          message: `O plantão para a data ${formattedDate} (${period}) está na lixeira. Por favor, restaure-o do histórico para poder utilizá-lo.`,
          code: 'ERR_DUPLICATE_RECORD' 
        });
      } else {
        return res.status(400).json({ 
          message: `Já existe um plantão ativo para a data ${formattedDate} (${period}).`,
          code: 'ERR_DUPLICATE_RECORD' 
        });
      }
    }

    const shiftId = `shift_${Date.now()}`;
    await client.query(
      `INSERT INTO shifts (id, date, period, weekday, coordinators_name, coordinators_registration, general_notes, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [shiftId, date, period, weekday, coordinatorsName, coordinatorsRegistration, generalNotes, 'ABERTO', createdBy]
    );

    await client.query('COMMIT');

    if (user) {
      await logAction(user.id, user.username, user.role, 'CRIOU PLANTÃO', `Criou escala de plantão para ${date.split('-').reverse().join('/')} - ${period}.`, req);
    }
    
    // Return created shift
    const newShiftRes = await pool.query('SELECT * FROM shifts WHERE id = $1', [shiftId]);
    const s = newShiftRes.rows[0];
    res.json({
      id: s.id,
      date: s.date.toISOString().split('T')[0],
      period: s.period,
      weekday: s.weekday,
      coordinatorsName: s.coordinators_name,
      coordinatorsRegistration: s.coordinators_registration,
      generalNotes: s.general_notes,
      status: s.status,
      createdAt: s.created_at,
      createdBy: s.created_by
    });
  } catch (err) {
    await client.query('ROLLBACK');
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  } finally {
    client.release();
  }
});

app.put('/api/shifts/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { coordinatorsName, coordinatorsRegistration, generalNotes, status, closedBy, reopenJustification, reopenedBy, user } = req.body;

  try {
    // Check if shift exists
    const shiftRes = await pool.query('SELECT * FROM shifts WHERE id = $1', [id]);
    if (shiftRes.rows.length === 0) return res.status(404).json({ message: 'Plantão não encontrado.', code: 'ERR_NOT_FOUND' });
    const originalShift = shiftRes.rows[0];

    // Check modify permission: only creator or ADMIN
    if (!(await canUserModifyShift(id, user))) {
      return res.status(403).json({ message: 'Apenas o criador do plantão ou um Administrador podem realizar modificações.', code: 'ERR_FORBIDDEN' });
    }

    // Data validation constraints
    if (coordinatorsName && coordinatorsName.length > 100) {
      return res.status(400).json({ message: 'Nome do coordenador excede o tamanho limite.', code: 'ERR_VALIDATION_FAILED' });
    }
    if (coordinatorsRegistration && coordinatorsRegistration.length > 50) {
      return res.status(400).json({ message: 'Matrícula do coordenador excede o tamanho limite.', code: 'ERR_VALIDATION_FAILED' });
    }
    if (generalNotes && generalNotes.length > 1000) {
      return res.status(400).json({ message: 'Observações excedem o limite de caracteres.', code: 'ERR_VALIDATION_FAILED' });
    }
    if (reopenJustification && reopenJustification.length > 1000) {
      return res.status(400).json({ message: 'Justificativa de reabertura excede o limite de caracteres.', code: 'ERR_VALIDATION_FAILED' });
    }

    // Validate if modifying read-only fields of an expired/closed shift
    const isShiftOverVal = isShiftExpired(originalShift.date, originalShift.period);
    const isShiftReadOnly = originalShift.status === 'FECHADO' || (isShiftOverVal && !originalShift.reopen_justification);
    
    if (isShiftReadOnly && status !== 'ABERTO' && reopenJustification === undefined) {
      if (
        (coordinatorsName !== undefined && coordinatorsName !== originalShift.coordinators_name) ||
        (coordinatorsRegistration !== undefined && coordinatorsRegistration !== originalShift.coordinators_registration) ||
        (generalNotes !== undefined && generalNotes !== originalShift.general_notes)
      ) {
        return res.status(400).json({ message: 'Este plantão está fechado ou expirado e não pode ser editado.', code: 'ERR_VALIDATION_FAILED' });
      }
    }

    // Determine values to update
    const updatedStatus = status || originalShift.status;
    const updatedCoordName = coordinatorsName !== undefined ? coordinatorsName : originalShift.coordinators_name;
    const updatedCoordReg = coordinatorsRegistration !== undefined ? coordinatorsRegistration : originalShift.coordinators_registration;
    const updatedGenNotes = generalNotes !== undefined ? generalNotes : originalShift.general_notes;

    let closedAt = originalShift.closed_at;
    let closedByVal = originalShift.closed_by;
    let justification = originalShift.reopen_justification;
    let reopenedAt = originalShift.reopened_at;
    let reopenedByVal = originalShift.reopened_by;

    if (status === 'FECHADO' && originalShift.status === 'ABERTO') {
      closedAt = new Date();
      closedByVal = closedBy || (user ? user.id : null);
    } else if (status === 'ABERTO' && originalShift.status === 'FECHADO') {
      reopenedAt = new Date();
      reopenedByVal = reopenedBy || (user ? user.id : null);
      justification = reopenJustification ? reopenJustification.toUpperCase() : 'SEM JUSTIFICATIVA REGISTRADA';
      closedAt = null;
      closedByVal = null;
    } else if (reopenJustification !== undefined) {
      reopenedAt = new Date();
      reopenedByVal = reopenedBy || (user ? user.id : null);
      justification = reopenJustification ? reopenJustification.toUpperCase() : 'SEM JUSTIFICATIVA REGISTRADA';
    }

    await pool.query(
      `UPDATE shifts
       SET coordinators_name = $1, coordinators_registration = $2, general_notes = $3, status = $4,
           closed_at = $5, closed_by = $6, reopen_justification = $7, reopened_at = $8, reopened_by = $9
       WHERE id = $10`,
      [updatedCoordName, updatedCoordReg, updatedGenNotes, updatedStatus, closedAt, closedByVal, justification, reopenedAt, reopenedByVal, id]
    );

    // Audit logs
    if (user) {
      if (status === 'FECHADO' && originalShift.status === 'ABERTO') {
        await logAction(user.id, user.username, user.role, 'FECHOU PLANTÃO', `Fechou e homologou o plantão administrativo do dia ${originalShift.date.toISOString().split('T')[0].split('-').reverse().join('/')}.`, req);
      } else if (status === 'ABERTO' && originalShift.status === 'FECHADO') {
        await logAction(user.id, user.username, user.role, 'REABRIU PLANTÃO', `Reabriu o plantão do dia ${originalShift.date.toISOString().split('T')[0].split('-').reverse().join('/')} (${originalShift.period}). Justificativa: ${justification}`, req);
      } else if (reopenJustification !== undefined) {
        await logAction(user.id, user.username, user.role, 'DESBLOQUEOU PLANTÃO', `Desbloqueou o plantão expirado do dia ${originalShift.date.toISOString().split('T')[0].split('-').reverse().join('/')} (${originalShift.period}). Justificativa: ${justification}`, req);
      } else {
        await logAction(user.id, user.username, user.role, 'ATUALIZAÇÃO PLANTÃO', `Atualizou dados do plantão administrativo do dia ${originalShift.date.toISOString().split('T')[0].split('-').reverse().join('/')}.`, req);
      }
    }

    const finalShiftRes = await pool.query('SELECT * FROM shifts WHERE id = $1', [id]);
    const finalShift = finalShiftRes.rows[0];
    res.json({
      id: finalShift.id,
      date: finalShift.date.toISOString().split('T')[0],
      period: finalShift.period,
      weekday: finalShift.weekday,
      coordinatorsName: finalShift.coordinators_name,
      coordinatorsRegistration: finalShift.coordinators_registration,
      generalNotes: finalShift.general_notes,
      status: finalShift.status,
      createdAt: finalShift.created_at,
      createdBy: finalShift.created_by,
      closedAt: finalShift.closed_at,
      closedBy: finalShift.closed_by,
      reopenJustification: finalShift.reopen_justification,
      reopenedAt: finalShift.reopened_at,
      reopenedBy: finalShift.reopened_by
    });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.delete('/api/shifts/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user } = req.body;

  try {
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Apenas administradores podem excluir plantões.', code: 'ERR_FORBIDDEN' });
    }

    const shiftRes = await pool.query('SELECT * FROM shifts WHERE id = $1', [id]);
    if (shiftRes.rows.length === 0) return res.status(404).json({ message: 'Plantão não encontrado.', code: 'ERR_NOT_FOUND' });
    const shift = shiftRes.rows[0];

    // Soft delete by updating is_deleted flag to true
    await pool.query('UPDATE shifts SET is_deleted = true WHERE id = $1', [id]);

    await logAction(
      user.id,
      user.username,
      user.role,
      'MOVEU PARA LIXEIRA',
      `Moveu para a lixeira o plantão do dia ${shift.date.toISOString().split('T')[0].split('-').reverse().join('/')} (${shift.period}).`,
      req
    );

    res.json({ success: true, message: 'Plantão movido para a lixeira.' });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.post('/api/shifts/:id/restore', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user } = req.body;

  try {
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Apenas administradores podem restaurar plantões.', code: 'ERR_FORBIDDEN' });
    }

    const shiftRes = await pool.query('SELECT * FROM shifts WHERE id = $1', [id]);
    if (shiftRes.rows.length === 0) return res.status(404).json({ message: 'Plantão não encontrado.', code: 'ERR_NOT_FOUND' });
    const shift = shiftRes.rows[0];

    // Restore by updating is_deleted flag back to false
    await pool.query('UPDATE shifts SET is_deleted = false WHERE id = $1', [id]);

    await logAction(
      user.id,
      user.username,
      user.role,
      'RESTAUROU PLANTÃO',
      `Restaurou da lixeira o plantão do dia ${shift.date.toISOString().split('T')[0].split('-').reverse().join('/')} (${shift.period}).`,
      req
    );

    res.json({ success: true, message: 'Plantão restaurado com sucesso.' });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.post('/api/shifts/:id/transfer', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newOwnerUsername, user } = req.body;

  try {
    // 1. Authorization check: only ADMIN can transfer
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Apenas administradores podem transferir a propriedade de um plantão.', code: 'ERR_FORBIDDEN' });
    }

    // 2. Fetch the new owner details
    const newOwnerRes = await pool.query('SELECT * FROM users WHERE username = $1 AND is_active = true', [newOwnerUsername]);
    if (newOwnerRes.rows.length === 0) {
      return res.status(404).json({ message: 'Coordenador/usuário destinatário não encontrado ou inativo.', code: 'ERR_NOT_FOUND' });
    }
    const newOwner = newOwnerRes.rows[0];

    // 3. Fetch original shift details for logs
    const shiftRes = await pool.query('SELECT * FROM shifts WHERE id = $1', [id]);
    if (shiftRes.rows.length === 0) {
      return res.status(404).json({ message: 'Plantão não encontrado.', code: 'ERR_NOT_FOUND' });
    }
    const originalShift = shiftRes.rows[0];

    // 4. Update the shift creator & coordinator name/registration
    await pool.query(
      `UPDATE shifts 
       SET created_by = $1, coordinators_name = $2, coordinators_registration = $3
       WHERE id = $4`,
      [newOwner.id, newOwner.name.toUpperCase(), newOwner.registration, id]
    );

    // 5. Log this action in audit log
    await logAction(
      user.id,
      user.username,
      user.role,
      'TRANSFERIU PROPRIEDADE',
      `Transferiu a propriedade do plantão do dia ${originalShift.date.toISOString().split('T')[0].split('-').reverse().join('/')} (${originalShift.period}) de "${originalShift.created_by}" para "${newOwner.username}".`,
      req
    );

    // 6. Return updated shift
    const updatedRes = await pool.query('SELECT * FROM shifts WHERE id = $1', [id]);
    const s = updatedRes.rows[0];
    res.json({
      id: s.id,
      date: s.date.toISOString().split('T')[0],
      period: s.period,
      weekday: s.weekday,
      coordinatorsName: s.coordinators_name,
      coordinatorsRegistration: s.coordinators_registration,
      generalNotes: s.general_notes,
      status: s.status,
      createdAt: s.created_at,
      createdBy: s.created_by,
      closedAt: s.closed_at,
      closedBy: s.closed_by,
      reopenJustification: s.reopen_justification,
      reopenedAt: s.reopened_at,
      reopenedBy: s.reopened_by
    });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

// Checklist item routes
app.get('/api/shifts/:shiftId/items', async (req: Request, res: Response) => {
  const { shiftId } = req.params;
  try {
    const itemsRes = await pool.query(
      'SELECT * FROM checklist_items WHERE shift_id = $1 ORDER BY order_index ASC',
      [shiftId]
    );
    const formatted = itemsRes.rows.map(item => ({
      id: item.id,
      shiftId: item.shift_id,
      employeeId: item.employee_id,
      employeeName: item.employee_name,
      employeeRole: item.employee_role,
      status: item.status,
      notes: item.notes,
      sector: item.sector,
      orderIndex: item.order_index
    }));
    res.json(formatted);
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

// Add collaborator to shift (with duplicate verification!)
app.post('/api/checklist-items', async (req: Request, res: Response) => {
  const { shiftId, employeeId, sector, user } = req.body;

  try {
    // Check if shift is editable
    if (!(await isShiftEditable(shiftId))) {
      return res.status(400).json({ message: 'Este plantão está fechado ou expirado e não pode ser alterado.', code: 'ERR_VALIDATION_FAILED' });
    }
    // Check modify permission: only creator or ADMIN
    if (!(await canUserModifyShift(shiftId, user))) {
      return res.status(403).json({ message: 'Apenas o criador do plantão ou um Administrador podem realizar modificações.', code: 'ERR_FORBIDDEN' });
    }
    // 1. Fetch employee details first to know their allowed sectors
    const empRes = await pool.query('SELECT * FROM employees WHERE id = $1', [employeeId]);
    if (empRes.rows.length === 0) return res.status(404).json({ message: 'Colaborador não encontrado.', code: 'ERR_NOT_FOUND' });
    const emp = empRes.rows[0];

    // 2. Duplicate check: is employee already active in another sector during the same shift?
    const dupRes = await pool.query(
      'SELECT id, sector FROM checklist_items WHERE shift_id = $1 AND employee_id = $2',
      [shiftId, employeeId]
    );

    if (dupRes.rows.length > 0) {
      const alreadySector = dupRes.rows[0].sector;
      const allowedSectors = emp.sectors || [emp.sector];
      
      let message = `Este colaborador já está alocado no setor "${alreadySector}" neste mesmo plantão.`;
      if (allowedSectors.length > 1) {
        message = `Este colaborador já está alocado no setor "${alreadySector}" neste mesmo plantão. Não é permitido alocar o mesmo colaborador em mais de um setor no mesmo plantão, mesmo que ele possua cadastro multisetorial para múltiplos setores.`;
      }
      
      return res.status(400).json({
        message,
        code: 'ERR_DUPLICATE_RECORD'
      });
    }

    // 3. Insert new item
    const itemId = `cli_${shiftId}_${emp.id}_${Date.now()}`;
    const orderIndexRes = await pool.query('SELECT COUNT(*) FROM checklist_items WHERE shift_id = $1', [shiftId]);
    const nextOrderIndex = parseInt(orderIndexRes.rows[0].count, 10);

    await pool.query(
      `INSERT INTO checklist_items (id, shift_id, employee_id, employee_name, employee_role, status, notes, sector, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [itemId, shiftId, emp.id, emp.name, emp.role, 'PRESENTE', '', sector, nextOrderIndex]
    );

    if (user) {
      await logAction(user.id, user.username, user.role, 'INDICAÇÃO COLABORADOR', `Indicou ${emp.name} (${emp.role}) no setor ${sector}.`, req);
    }

    res.json({
      id: itemId,
      shiftId,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeRole: emp.role,
      status: 'PRESENTE',
      notes: '',
      sector,
      orderIndex: nextOrderIndex
    });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.put('/api/checklist-items/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, notes, user } = req.body;

  // Validate status is valid if provided
  if (status !== undefined) {
    const validStatuses = ['PRESENTE', 'AUSENTE', 'ATESTADO', 'EXTRA', 'TROCA', 'FAST_TRACK'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Status de frequência inválido.', code: 'ERR_VALIDATION_FAILED' });
    }
  }

  if (notes && notes.length > 500) {
    return res.status(400).json({ message: 'Observações excedem o limite de 500 caracteres.', code: 'ERR_VALIDATION_FAILED' });
  }

  try {
    const itemRes = await pool.query('SELECT * FROM checklist_items WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) return res.status(404).json({ message: 'Item de checklist não encontrado.', code: 'ERR_NOT_FOUND' });
    const originalItem = itemRes.rows[0];

    // Check if shift is editable
    if (!(await isShiftEditable(originalItem.shift_id))) {
      return res.status(400).json({ message: 'Este plantão está fechado ou expirado e não pode ser alterado.', code: 'ERR_VALIDATION_FAILED' });
    }
    // Check modify permission: only creator or ADMIN
    if (!(await canUserModifyShift(originalItem.shift_id, user))) {
      return res.status(403).json({ message: 'Apenas o criador do plantão ou um Administrador podem realizar modificações.', code: 'ERR_FORBIDDEN' });
    }

    const updatedStatus = status !== undefined ? status : originalItem.status;
    const updatedNotes = notes !== undefined ? notes.toUpperCase() : originalItem.notes;

    await pool.query(
      'UPDATE checklist_items SET status = $1, notes = $2 WHERE id = $3',
      [updatedStatus, updatedNotes, id]
    );

    if (user) {
      if (status !== undefined && status !== originalItem.status) {
        await logAction(user.id, user.username, user.role, 'CHECKLIST PRESENÇA', `Alterou status de ${originalItem.employee_name} (${originalItem.sector}) para ${status}.`, req);
      }
      if (notes !== undefined && notes !== originalItem.notes) {
        await logAction(user.id, user.username, user.role, 'CHECKLIST OBSERVAÇÃO', `Atualizou observação de ${originalItem.employee_name}: "${updatedNotes}".`, req);
      }
    }

    res.json({ success: true });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.delete('/api/checklist-items/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user } = req.body; // Pass user in query/body for logs

  try {
    const itemRes = await pool.query('SELECT * FROM checklist_items WHERE id = $1', [id]);
    if (itemRes.rows.length === 0) return res.status(404).json({ message: 'Item não encontrado.', code: 'ERR_NOT_FOUND' });
    const item = itemRes.rows[0];

    // Check if shift is editable
    if (!(await isShiftEditable(item.shift_id))) {
      return res.status(400).json({ message: 'Este plantão está fechado ou expirado e não pode ser alterado.', code: 'ERR_VALIDATION_FAILED' });
    }
    // Check modify permission: only creator or ADMIN
    if (!(await canUserModifyShift(item.shift_id, user))) {
      return res.status(403).json({ message: 'Apenas o criador do plantão ou um Administrador podem realizar modificações.', code: 'ERR_FORBIDDEN' });
    }

    await pool.query('DELETE FROM checklist_items WHERE id = $1', [id]);

    if (user) {
      await logAction(user.id, user.username, user.role, 'REMOÇÃO COLABORADOR', `Removeu indicação de ${item.employee_name} do setor ${item.sector}.`, req);
    }

    res.json({ success: true });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

// Employee routes
app.get('/api/employees', async (req: Request, res: Response) => {
  try {
    const emps = await pool.query('SELECT * FROM employees ORDER BY name ASC');
    const formatted = emps.rows.map(e => ({
      id: e.id,
      name: e.name,
      role: e.role,
      roleId: e.role_id,
      sector: e.sector,
      sectors: e.sectors || [e.sector],
      registration: e.registration,
      isActive: e.is_active
    }));
    res.json(formatted);
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.post('/api/employees', async (req: Request, res: Response) => {
  const { id, name, role, roleId, sector, sectors, registration, isActive, user } = req.body;

  try {
    const sectorsVal = sectors && sectors.length > 0 ? sectors : [sector];
    if (id) {
      // Update
      const oldEmpRes = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);
      if (oldEmpRes.rows.length === 0) return res.status(404).json({ message: 'Funcionário não encontrado.', code: 'ERR_NOT_FOUND' });
      
      await pool.query(
        `UPDATE employees
         SET name = $1, role = $2, role_id = $3, sector = $4, sectors = $5, registration = $6, is_active = $7
         WHERE id = $8`,
        [name, role, roleId, sector, sectorsVal, registration, isActive, id]
      );

      if (user) {
        await logAction(user.id, user.username, user.role, 'ATUALIZAÇÃO FUNCIONÁRIO', `Editou dados do funcionário: ${name} (Função: ${role}, Setor: ${sector}).`, req);
      }
      res.json({ success: true, message: 'Funcionário atualizado com sucesso.' });
    } else {
      // Create
      const newId = `emp_${Date.now()}`;
      await pool.query(
        `INSERT INTO employees (id, name, role, role_id, sector, sectors, registration, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newId, name, role, roleId, sector, sectorsVal, registration, isActive]
      );

      if (user) {
        await logAction(user.id, user.username, user.role, 'CADASTRO FUNCIONÁRIO', `Cadastrou novo funcionário: ${name} (Função: ${role}, Setor: ${sector}).`, req);
      }
      res.json({ success: true, message: 'Funcionário cadastrado com sucesso.' });
    }
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.delete('/api/employees/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user } = req.body;

  try {
    const empRes = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);
    if (empRes.rows.length === 0) return res.status(404).json({ message: 'Funcionário não encontrado.', code: 'ERR_NOT_FOUND' });
    const emp = empRes.rows[0];

    await pool.query('DELETE FROM employees WHERE id = $1', [id]);

    if (user) {
      await logAction(user.id, user.username, user.role, 'EXCLUSÃO FUNCIONÁRIO', `Removeu funcionário do sistema: ${emp.name} (Função: ${emp.role}, Setor: ${emp.sector}).`, req);
    }
    res.json({ success: true, message: 'Funcionário excluído com sucesso.' });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.post('/api/employees/import', async (req: Request, res: Response) => {
  const { text, user } = req.body;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lines = text.split('\n');
    const rolesRes = await client.query('SELECT * FROM employee_roles');
    const rolesMap = new Map(rolesRes.rows.map(r => [r.name.toLowerCase(), r.id]));
    let count = 0;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      let name = '';
      let roleName = 'Funcionário';
      let sector = 'ADMINISTRATIVO';
      let registration = '';

      let parts: string[] = [];
      if (line.includes('\t')) parts = line.split('\t');
      else if (line.includes(';')) parts = line.split(';');
      else if (line.includes(',')) parts = line.split(',');
      else parts = [line];

      if (parts.length > 0) {
        name = parts[0].trim();
        if (name.toLowerCase() === 'nome' || name.toLowerCase() === 'funcionario' || name.toLowerCase() === 'funcionário') {
          continue;
        }

        if (parts.length > 1) roleName = parts[1].trim();
        if (parts.length > 2) sector = parts[2].trim().toUpperCase();
        if (parts.length > 3) registration = parts[3].trim();

        if (name) {
          const empId = `emp_${Date.now()}_${count}_${Math.floor(Math.random() * 100)}`;
          
          let roleId = rolesMap.get(roleName.toLowerCase());
          if (!roleId) {
            roleId = `role_${Date.now()}_${count}_${Math.floor(Math.random() * 100)}`;
            await client.query(
              'INSERT INTO employee_roles (id, name, is_active) VALUES ($1, $2, $3)',
              [roleId, roleName, true]
            );
            rolesMap.set(roleName.toLowerCase(), roleId);
          }

          await client.query(
            `INSERT INTO employees (id, name, role, role_id, sector, sectors, registration, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [empId, name, roleName, roleId, sector, [sector], registration, true]
          );
          count++;
        }
      }
    }

    await client.query('COMMIT');

    if (user && count > 0) {
      await logAction(user.id, user.username, user.role, 'IMPORTAÇÃO FUNCIONÁRIOS', `Importou ${count} funcionários a partir de planilha.`, req);
    }

    res.json({ success: true, count, message: `${count} funcionários importados com sucesso.` });
  } catch (err) {
    await client.query('ROLLBACK');
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  } finally {
    client.release();
  }
});

// Roles routes
app.get('/api/roles', async (req: Request, res: Response) => {
  try {
    const rolesRes = await pool.query('SELECT * FROM employee_roles ORDER BY name ASC');
    const formatted = rolesRes.rows.map(r => ({
      id: r.id,
      name: r.name,
      isActive: r.is_active
    }));
    res.json(formatted);
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.post('/api/roles', async (req: Request, res: Response) => {
  const { id, name, isActive, user } = req.body;

  try {
    if (id) {
      // Update
      const oldRoleRes = await pool.query('SELECT * FROM employee_roles WHERE id = $1', [id]);
      if (oldRoleRes.rows.length === 0) return res.status(404).json({ message: 'Cargo não encontrado.', code: 'ERR_NOT_FOUND' });
      
      await pool.query(
        'UPDATE employee_roles SET name = $1, is_active = $2 WHERE id = $3',
        [name, isActive, id]
      );

      if (user) {
        await logAction(user.id, user.username, user.role, 'ATUALIZAÇÃO CARGO', `Editou cargo/função: ${name}.`, req);
      }
      res.json({ success: true, message: 'Cargo atualizado com sucesso.' });
    } else {
      // Create
      const newId = `role_${Date.now()}`;
      await pool.query(
        'INSERT INTO employee_roles (id, name, is_active) VALUES ($1, $2, $3)',
        [newId, name, true]
      );

      if (user) {
        await logAction(user.id, user.username, user.role, 'CADASTRO CARGO', `Cadastrou novo cargo/função: ${name}.`, req);
      }
      res.json({ success: true, message: 'Cargo cadastrado com sucesso.' });
    }
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.delete('/api/roles/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user } = req.body;

  try {
    const roleRes = await pool.query('SELECT * FROM employee_roles WHERE id = $1', [id]);
    if (roleRes.rows.length === 0) return res.status(404).json({ message: 'Cargo não encontrado.', code: 'ERR_NOT_FOUND' });
    const role = roleRes.rows[0];

    // Check if roles are being used
    const checkUsed = await pool.query('SELECT COUNT(*) FROM employees WHERE role_id = $1 OR LOWER(role) = $2', [id, role.name.toLowerCase()]);
    if (parseInt(checkUsed.rows[0].count, 10) > 0) {
      return res.status(400).json({ message: 'Este cargo não pode ser excluído pois existem funcionários vinculados a ele.', code: 'ERR_INVALID_REFERENCE' });
    }

    await pool.query('DELETE FROM employee_roles WHERE id = $1', [id]);

    if (user) {
      await logAction(user.id, user.username, user.role, 'EXCLUSÃO CARGO', `Excluiu cargo/função: ${role.name}.`, req);
    }
    res.json({ success: true, message: 'Cargo excluído com sucesso.' });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

// Users management routes (Admin only)
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const usersRes = await pool.query('SELECT * FROM users ORDER BY name ASC');
    const formatted = usersRes.rows.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role,
      registration: u.registration,
      isActive: u.is_active,
      createdAt: u.created_at
    }));
    res.json(formatted);
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.post('/api/users', async (req: Request, res: Response) => {
  const { id, username, passwordHash, name, email, role, registration, isActive, user } = req.body;

  try {
    if (id) {
      // Update
      const oldUserRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (oldUserRes.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado.', code: 'ERR_NOT_FOUND' });

      if (passwordHash) {
        await pool.query(
          `UPDATE users
           SET username = $1, password_hash = $2, name = $3, email = $4, role = $5, registration = $6, is_active = $7
           WHERE id = $8`,
          [username, passwordHash, name, email, role, registration, isActive, id]
        );
      } else {
        await pool.query(
          `UPDATE users
           SET username = $1, name = $2, email = $3, role = $4, registration = $5, is_active = $6
           WHERE id = $7`,
          [username, name, email, role, registration, isActive, id]
        );
      }

      if (user) {
        await logAction(user.id, user.username, user.role, 'ATUALIZAÇÃO USUÁRIO', `Editou dados do usuário do sistema: ${username} (${name}).`, req);
      }
      res.json({ success: true, message: 'Usuário atualizado com sucesso.' });
    } else {
      // Create
      const newId = `user_${Date.now()}`;
      await pool.query(
        `INSERT INTO users (id, username, password_hash, name, email, role, registration, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newId, username, passwordHash, name, email, role, registration, isActive]
      );

      if (user) {
        await logAction(user.id, user.username, user.role, 'CADASTRO USUÁRIO', `Cadastrou novo usuário do sistema: ${username} (${name}).`, req);
      }
      res.json({ success: true, message: 'Usuário cadastrado com sucesso.' });
    }
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.delete('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user } = req.body;

  try {
    const targetUserRes = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (targetUserRes.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado.', code: 'ERR_NOT_FOUND' });
    const targetUser = targetUserRes.rows[0];

    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    if (user) {
      await logAction(user.id, user.username, user.role, 'EXCLUSÃO USUÁRIO', `Excluiu usuário do sistema: ${targetUser.username}.`, req);
    }
    res.json({ success: true, message: 'Usuário excluído com sucesso.' });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

// Pending issues routes
app.get('/api/issues', async (req: Request, res: Response) => {
  try {
    const issuesRes = await pool.query('SELECT * FROM sector_pending_issues ORDER BY created_at DESC');
    const formatted = issuesRes.rows.map(i => ({
      id: i.id,
      shiftId: i.shift_id,
      sector: i.sector,
      description: i.description,
      status: i.status,
      createdAt: i.created_at,
      createdBy: i.created_by,
      resolvedAt: i.resolved_at,
      resolvedBy: i.resolved_by
    }));
    res.json(formatted);
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.post('/api/issues', async (req: Request, res: Response) => {
  const { id, shiftId, sector, description, status, resolvedBy, user } = req.body;

  try {
    if (id) {
      // Update
      const oldRes = await pool.query('SELECT * FROM sector_pending_issues WHERE id = $1', [id]);
      if (oldRes.rows.length === 0) return res.status(404).json({ message: 'Pendência não encontrada.', code: 'ERR_NOT_FOUND' });
      const originalIssue = oldRes.rows[0];

      let resolvedAt = originalIssue.resolved_at;
      let resolvedByVal = originalIssue.resolved_by;

      if (status === 'RESOLVIDO' && originalIssue.status === 'PENDENTE') {
        resolvedAt = new Date();
        resolvedByVal = resolvedBy || (user ? user.id : null);
      } else if (status === 'PENDENTE' && originalIssue.status === 'RESOLVIDO') {
        resolvedAt = null;
        resolvedByVal = null;
      }

      await pool.query(
        `UPDATE sector_pending_issues
         SET sector = $1, description = $2, status = $3, resolved_at = $4, resolved_by = $5
         WHERE id = $6`,
        [sector, description, status, resolvedAt, resolvedByVal, id]
      );

      if (user) {
        if (status === 'RESOLVIDO' && originalIssue.status === 'PENDENTE') {
          await logAction(user.id, user.username, user.role, 'RESOLUÇÃO ALERTA', `Resolveu pendência no setor ${sector}: "${description}".`, req);
        } else {
          await logAction(user.id, user.username, user.role, 'ATUALIZAÇÃO ALERTA', `Atualizou pendência no setor ${sector}.`, req);
        }
      }
      res.json({ success: true });
    } else {
      // Create
      const newId = `issue_${Date.now()}`;
      await pool.query(
        `INSERT INTO sector_pending_issues (id, shift_id, sector, description, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newId, shiftId, sector, description, 'PENDENTE', user ? user.id : null]
      );

      if (user) {
        await logAction(user.id, user.username, user.role, 'REGISTRO DE ALERTA', `Adicionou pendência no setor ${sector}: "${description}".`, req);
      }
      res.json({ success: true });
    }
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

app.delete('/api/issues/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { user } = req.body;

  try {
    const issueRes = await pool.query('SELECT * FROM sector_pending_issues WHERE id = $1', [id]);
    if (issueRes.rows.length === 0) return res.status(404).json({ message: 'Pendência não encontrada.', code: 'ERR_NOT_FOUND' });
    const issue = issueRes.rows[0];

    await pool.query('DELETE FROM sector_pending_issues WHERE id = $1', [id]);

    if (user) {
      await logAction(user.id, user.username, user.role, 'EXCLUSÃO PENDÊNCIA SECTOR', `Removeu pendência no setor ${issue.sector}: "${issue.description}"`, req);
    }
    res.json({ success: true });
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

// Logs routes
app.get('/api/logs', async (req: Request, res: Response) => {
  try {
    const logsRes = await pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 1000');
    const formatted = logsRes.rows.map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      userId: l.user_id,
      username: l.username,
      userRole: l.user_role,
      action: l.action,
      details: l.details,
      ipAddress: l.ip_address
    }));
    res.json(formatted);
  } catch (err) {
    const errInfo = handleDatabaseError(err);
    res.status(errInfo.status).json({ message: errInfo.message, code: errInfo.code });
  }
});

// Initialize database schema and start server if not testing
if (process.env.NODE_ENV !== 'test') {
  initializeDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }).catch(err => {
    console.error('Database failed to initialize. Exiting.', err);
    process.exit(1);
  });
}
