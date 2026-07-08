import { test, describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { app } from './index';
import { pool } from './db';
import { Server } from 'http';

// Store original query to restore after tests
const originalQuery = pool.query;
const originalConnect = pool.connect;

describe('Checklist UPA API Endpoints', () => {
  let server: Server;
  let port: number;
  let mockQueryResult: any = { rows: [] };
  let lastQueryText = '';
  let lastQueryParams: any[] = [];

  before(() => {
    // Override pool.query with our mock runner
    pool.query = (async (text: string | { text: string }, values?: any[]) => {
      lastQueryText = typeof text === 'string' ? text : (text as any).text;
      lastQueryParams = values || [];
      if (typeof mockQueryResult === 'function') {
        return mockQueryResult(lastQueryText, lastQueryParams);
      }
      return mockQueryResult;
    }) as any;

    // Override pool.connect to return a mocked client
    pool.connect = async () => {
      const mockClient = {
        query: async (text: string | { text: string }, values?: any[]) => {
          lastQueryText = typeof text === 'string' ? text : (text as any).text;
          lastQueryParams = values || [];
          if (lastQueryText === 'BEGIN' || lastQueryText === 'COMMIT' || lastQueryText === 'ROLLBACK') {
            return { rows: [] };
          }
          if (typeof mockQueryResult === 'function') {
            return mockQueryResult(lastQueryText, lastQueryParams);
          }
          return mockQueryResult;
        },
        release: () => {}
      };
      return mockClient as any;
    };

    // Start ephemeral server on a random port
    server = app.listen(0);
    const addr = server.address();
    port = typeof addr === 'string' ? 0 : addr?.port || 3003;
  });

  after(async () => {
    // Restore original query/connect and close server
    pool.query = originalQuery;
    pool.connect = originalConnect;
    server.close();
    await pool.end();
  });

  beforeEach(() => {
    mockQueryResult = { rows: [] };
    lastQueryText = '';
    lastQueryParams = [];
  });

  describe('POST /api/auth/login', () => {
    it('should successfully log in with correct credentials', async () => {
      // Arrange
      mockQueryResult = {
        rows: [
          {
            id: 'user_1',
            username: 'admin',
            password_hash: 'hash_99c',
            name: 'Admin UPA',
            email: 'admin@upa.com',
            role: 'ADMIN',
            registration: '12345',
            is_active: true
          }
        ]
      };

      // Act
      const res = await fetch(`http://localhost:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', passwordHash: 'hash_99c' })
      });

      const body = await res.json();

      // Assert
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.username, 'admin');
      assert.strictEqual(body.role, 'ADMIN');
    });

    it('should fail to log in with incorrect credentials', async () => {
      // Arrange
      mockQueryResult = { rows: [] };

      // Act
      const res = await fetch(`http://localhost:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', passwordHash: 'wrong_hash' })
      });

      const body = await res.json();

      // Assert
      assert.strictEqual(res.status, 401);
      assert.ok(body.message.includes('não encontrado') || body.message.includes('Senha incorreta'));
      assert.strictEqual(body.code, 'ERR_AUTH_FAILED');
    });
  });

  describe('POST /api/shifts', () => {
    it('should check duplicate and inform if shift is in the trash', async () => {
      // Arrange
      // Let duplicateRes return a deleted shift
      mockQueryResult = {
        rows: [
          {
            id: 'shift_123',
            is_deleted: true
          }
        ]
      };

      // Act
      const res = await fetch(`http://localhost:${port}/api/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-07-06',
          period: 'NOTURNO',
          weekday: 'Segunda-feira',
          coordinatorsName: 'COORDENADOR TESTE',
          coordinatorsRegistration: '12345'
        })
      });

      const body = await res.json();

      // Assert
      assert.strictEqual(res.status, 400);
      assert.ok(body.message.includes('está na lixeira'));
      assert.strictEqual(body.code, 'ERR_DUPLICATE_RECORD');
    });

    it('should check duplicate and inform if shift is active', async () => {
      // Arrange
      // Let duplicateRes return an active shift
      mockQueryResult = {
        rows: [
          {
            id: 'shift_123',
            is_deleted: false
          }
        ]
      };

      // Act
      const res = await fetch(`http://localhost:${port}/api/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: '2026-07-06',
          period: 'NOTURNO',
          weekday: 'Segunda-feira',
          coordinatorsName: 'COORDENADOR TESTE',
          coordinatorsRegistration: '12345'
        })
      });

      const body = await res.json();

      // Assert
      assert.strictEqual(res.status, 400);
      assert.ok(body.message.includes('Já existe um plantão ativo'));
      assert.strictEqual(body.code, 'ERR_DUPLICATE_RECORD');
    });
  });

  describe('POST /api/shifts/:id/transfer', () => {
    it('should forbid transfer if requesting user is not ADMIN', async () => {
      // Act
      const res = await fetch(`http://localhost:${port}/api/shifts/shift_123/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newOwnerUsername: 'sandriele',
          user: { role: 'COORDENADOR', username: 'test_coord' }
        })
      });

      const body = await res.json();

      // Assert
      assert.strictEqual(res.status, 403);
      assert.ok(body.message.includes('Apenas administradores'));
      assert.strictEqual(body.code, 'ERR_FORBIDDEN');
    });

    it('should successfully transfer shift ownership if requester is ADMIN', async () => {
      // Arrange
      let currentCreatedBy = 'old_coord';
      let currentCoordName = 'COORDENADOR ANTIGO';
      mockQueryResult = (queryText: string, params: any[]) => {
        if (queryText.includes('FROM users')) {
          return {
            rows: [
              {
                id: 'user_456',
                username: 'sandriele',
                name: 'SANDRIELE MARINHO',
                registration: '1045352',
                is_active: true
              }
            ]
          };
        }
        if (queryText.includes('UPDATE shifts')) {
          currentCreatedBy = params[0];
          currentCoordName = params[1];
          return { rows: [] };
        }
        if (queryText.includes('FROM shifts')) {
          return {
            rows: [
              {
                id: 'shift_123',
                date: new Date('2026-07-06'),
                period: 'NOTURNO',
                weekday: 'Segunda-feira',
                coordinators_name: currentCoordName,
                coordinators_registration: '99999',
                general_notes: 'Notas antigas',
                status: 'ABERTO',
                created_at: new Date(),
                created_by: currentCreatedBy,
                closed_at: null,
                closed_by: null,
                reopen_justification: null,
                reopened_at: null,
                reopened_by: null
              }
            ]
          };
        }
        return { rows: [] };
      };

      // Act
      const res = await fetch(`http://localhost:${port}/api/shifts/shift_123/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newOwnerUsername: 'sandriele',
          user: { id: 'admin_id', role: 'ADMIN', username: 'admin_user' }
        })
      });

      const body = await res.json();

      // Assert
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.createdBy, 'user_456');
      assert.strictEqual(body.coordinatorsName, 'SANDRIELE MARINHO');
    });
  });

  describe('POST /api/checklist-items', () => {
    it('should block allocation if employee is already active in another sector and is NOT multisetorial', async () => {
      mockQueryResult = (queryText: string, params: any[]) => {
        if (queryText.includes('FROM shifts')) {
          // Mock isShiftEditable check
          return { rows: [{ id: 'shift_123', status: 'ABERTO', date: new Date(2030, 0, 1), period: 'DIURNO', created_at: new Date() }] };
        }
        if (queryText.includes('SELECT * FROM employees')) {
          // Mock employee fetch with single sector NIR
          return { rows: [{ id: 'emp_1', name: 'JOÃO', role: 'Enfermeiro', sector: 'NIR', sectors: ['NIR'] }] };
        }
        if (queryText.includes('FROM checklist_items WHERE shift_id = $1 AND employee_id = $2')) {
          // Mock duplicate check returning already in RECEPÇÃO
          return { rows: [{ id: 'cli_old', sector: 'RECEPÇÃO' }] };
        }
        return { rows: [] };
      };

      const res = await fetch(`http://localhost:${port}/api/checklist-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: 'shift_123',
          employeeId: 'emp_1',
          sector: 'NIR',
          user: { id: 'admin_id', role: 'ADMIN', username: 'admin' }
        })
      });

      const body = await res.json();

      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.code, 'ERR_DUPLICATE_RECORD');
      assert.strictEqual(body.message, 'Este colaborador já está alocado no setor "RECEPÇÃO" neste mesmo plantão.');
    });

    it('should block allocation and return detailed warning explanation if employee is multisetorial', async () => {
      mockQueryResult = (queryText: string, params: any[]) => {
        if (queryText.includes('FROM shifts')) {
          // Mock isShiftEditable check
          return { rows: [{ id: 'shift_123', status: 'ABERTO', date: new Date(2030, 0, 1), period: 'DIURNO', created_at: new Date() }] };
        }
        if (queryText.includes('SELECT * FROM employees')) {
          // Mock employee fetch with multiple sectors NIR and RECEPÇÃO
          return { rows: [{ id: 'emp_1', name: 'JOÃO', role: 'Enfermeiro', sector: 'NIR', sectors: ['NIR', 'RECEPÇÃO'] }] };
        }
        if (queryText.includes('FROM checklist_items WHERE shift_id = $1 AND employee_id = $2')) {
          // Mock duplicate check returning already in RECEPÇÃO
          return { rows: [{ id: 'cli_old', sector: 'RECEPÇÃO' }] };
        }
        return { rows: [] };
      };

      const res = await fetch(`http://localhost:${port}/api/checklist-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: 'shift_123',
          employeeId: 'emp_1',
          sector: 'NIR',
          user: { id: 'admin_id', role: 'ADMIN', username: 'admin' }
        })
      });

      const body = await res.json();

      assert.strictEqual(res.status, 400);
      assert.strictEqual(body.code, 'ERR_DUPLICATE_RECORD');
      assert.ok(body.message.includes('Não é permitido alocar o mesmo colaborador em mais de um setor no mesmo plantão, mesmo que ele possua cadastro multisetorial'));
    });
  });
});
