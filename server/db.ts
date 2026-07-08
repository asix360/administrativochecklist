import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});

function hashPassword(pwd: string): string {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    const char = pwd.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

// Initial system users
const INITIAL_USERS = [
  {
    id: 'user_1',
    username: 'admin',
    passwordHash: hashPassword('admin123'),
    name: 'Administrador Geral',
    email: 'admin@upa24h.com',
    role: 'ADMIN',
    registration: '000001',
    isActive: true,
    createdAt: '2026-07-04T08:00:00Z'
  },
  {
    id: 'user_2',
    username: 'sandriele',
    passwordHash: hashPassword('sandriele123'),
    name: 'Sandriele Marinho',
    email: 'sandriele.marinho@upa24h.com',
    role: 'COORDENADOR',
    registration: '1045352',
    isActive: true,
    createdAt: '2026-07-04T08:00:00Z'
  },
  {
    id: 'user_3',
    username: 'operador',
    passwordHash: hashPassword('operador123'),
    name: 'Operador de Plantão',
    email: 'operador@upa24h.com',
    role: 'OPERADOR',
    registration: '000003',
    isActive: true,
    createdAt: '2026-07-04T08:00:00Z'
  }
];

const INITIAL_ROLES = [
  'MÉDICO CLÍNICO',
  'MÉDICO PEDIATRA',
  'Pediatra',
  'Enfermeiro',
  'Tec Enfermagem',
  'Tec em Radiologia',
  'Condutor',
  'Assistente Social',
  'Farmacêutico',
  'Auxiliar de Farmácia',
  'Bioquímico/Biomédico',
  'Téc. Lab',
  'Funcionário',
  'Reeducando',
  'Guarita',
  'Portaria'
];

const INITIAL_EMPLOYEES = [
  { name: 'ARIEL GUIMARÃES MONTE', role: 'MÉDICO CLÍNICO', sector: 'MÉDICO CLÍNICO', registration: 'CRM-12345', isActive: true },
  { name: 'LUMA MARIA MANGUEIRA DANTAS', role: 'MÉDICO CLÍNICO', sector: 'MÉDICO CLÍNICO', registration: 'CRM-12346', isActive: true },
  { name: 'LEONARDO GADELHA XAVIER DA NOBREGA PEREIRA', role: 'MÉDICO CLÍNICO', sector: 'MÉDICO CLÍNICO', registration: 'CRM-12347', isActive: true },
  { name: 'ISADORA WANDERLEY QUEIROGA DE FREITAS EVANGELISTA', role: 'MÉDICO CLÍNICO', sector: 'MÉDICO CLÍNICO', registration: 'CRM-12348', isActive: true },
  { name: 'SUEVERTON MARIANO MENDONÇA', role: 'Pediatra', sector: 'MÉDICO PEDIATRA', registration: 'CRM-12349', isActive: true },
  { name: 'ARIELLE VASCO VIVEIROS - PSF', role: 'Pediatra', sector: 'MÉDICO PEDIATRA', registration: 'CRM-12350', isActive: true },
  { name: 'FERNANDA CRISTINA ALBUQUERQUE ALMEIDA', role: 'Enfermeiro', sector: 'CLASSIFICAÇÃO DE RISCO', registration: 'COREN-11111', isActive: true },
  { name: 'LIVIA SILVA BRITTO', role: 'Enfermeiro', sector: 'CLASSIFICAÇÃO DE RISCO', registration: 'COREN-11112', isActive: true },
  { name: 'ELIDIANE DOS SANTOS DIAS', role: 'Enfermeiro', sector: 'SALA VERDE', registration: 'COREN-11113', isActive: true },
  { name: 'ATHILLA JOSE POLICARPO DE OLIVEIRA', role: 'Tec Enfermagem', sector: 'SALA VERDE', registration: 'COREN-22221', isActive: true },
  { name: 'ROSENDA JORGE DE OLIVEIRA', role: 'Tec Enfermagem', sector: 'SALA VERDE', registration: 'COREN-22222', isActive: true },
  { name: 'MARIA MISLEIDE MATIAS CARVALHO DA SILVA', role: 'Tec Enfermagem', sector: 'SALA VERDE', registration: 'COREN-22223', isActive: true },
  { name: 'MORGANA PEREIRA DAS NEVES', role: 'Tec Enfermagem', sector: 'SALA VERDE', registration: 'COREN-22224', isActive: true },
  { name: 'PAOLA LUCENA', role: 'Tec Enfermagem', sector: 'SALA VERDE', registration: 'COREN-22225', isActive: true },
  { name: 'ERICA GOMES DE ARAUJO', role: 'Tec Enfermagem', sector: 'SALA VERDE', registration: 'COREN-22226', isActive: true },
  { name: 'DEBORAH RAYANNE ROSENO DE JESUS', role: 'Enfermeiro', sector: 'SALA AMARELA', registration: 'COREN-11114', isActive: true },
  { name: 'GEICIANE PAMPLONA DOS SANTOS', role: 'Tec Enfermagem', sector: 'SALA AMARELA', registration: 'COREN-22227', isActive: true },
  { name: 'DAYANA BARBARA SILVA DE SOUSA', role: 'Tec Enfermagem', sector: 'SALA AMARELA', registration: 'COREN-22228', isActive: true },
  { name: 'ROSENILDA DIAS DA SILVA', role: 'Enfermeiro', sector: 'SALA VERMELHA', registration: 'COREN-11115', isActive: true },
  { name: 'ISRAEL DA SILVA OLIVEIRA FILHO', role: 'Tec Enfermagem', sector: 'SALA VERMELHA', registration: 'COREN-22229', isActive: true },
  { name: 'RAWLINSON FARLEY ALMEIDA COSTA', role: 'Tec Enfermagem', sector: 'SALA VERMELHA', registration: 'COREN-22230', isActive: true },
  { name: 'DAFLYS KLEYTON RODRIGUES DE AZEVEDO', role: 'Tec Enfermagem', sector: 'SALA VERMELHA', registration: 'COREN-22231', isActive: true },
  { name: 'FARCKYANNE ARAGAO ROGRIGUES FERREIRA', role: 'Enfermeiro', sector: 'PEDIATRIA', registration: 'COREN-11116', isActive: true },
  { name: 'WAGNER ANTONIO VELEZ SANTANA', role: 'Tec Enfermagem', sector: 'PEDIATRIA', registration: 'COREN-22232', isActive: true },
  { name: 'JOSILDA CRISTINA DE SOUSA COSTA', role: 'Tec Enfermagem', sector: 'PEDIATRIA', registration: 'COREN-22233', isActive: true },
  { name: 'ERICKA CINTHYA COELHO LOPES', role: 'Tec Enfermagem', sector: 'CME', registration: 'COREN-22234', isActive: true },
  { name: 'CESAR AUGUSTO DOS SANTOS NOBREGA', role: 'Tec em Radiologia', sector: 'RAIO X', registration: 'RAD-33331', isActive: true },
  { name: 'MARY LYSSA DOS SANTOS ALEXANDRE - HCG PRONTOVIDA', role: 'Enfermeiro', sector: 'AMBULÂNCIA', registration: 'COREN-11117', isActive: true },
  { name: 'ARNON HILUEY SANTOS', role: 'Condutor', sector: 'AMBULÂNCIA', registration: 'CNH-44441', isActive: true },
  { name: 'JOYCE FERREIRA BATISTA', role: 'Enfermeiro', sector: 'NIR', registration: 'COREN-11118', isActive: true },
  { name: 'LUCELIA LIMA DE SOUZA', role: 'Assistente Social', sector: 'SERVIÇO SOCIAL', registration: 'CRESS-55551', isActive: true },
  { name: 'SARAH ALVES VIEIRA', role: 'Farmacêutico', sector: 'FARMÁCIA', registration: 'CRF-66661', isActive: true },
  { name: 'POLLYANA BATISTA LOPES DA SILVA', role: 'Auxiliar de Farmácia', sector: 'FARMÁCIA', registration: 'AUX-66662', isActive: true },
  { name: 'AMANDA DE ARAUJO ALENCAR', role: 'Bioquímico/Biomédico', sector: 'LABORATÓRIO', registration: 'CRBM-77771', isActive: true },
  { name: 'SERGIO RECARDO BELMIRO DOS SANTOS', role: 'Téc. Lab', sector: 'LABORATÓRIO', registration: 'TEC-77772', isActive: true },
  { name: 'SAMMIA DE KALY LIMA NUNES', role: 'Téc. Lab', sector: 'LABORATÓRIO', registration: 'TEC-77773', isActive: true },
  { name: 'JOELMA PEREIRA - COPA', role: 'Funcionário', sector: 'COPA', registration: 'FUNC-88881', isActive: true },
  { name: 'TAMIRYS BATISTA SANTOS - HIGIENIZAÇÃO', role: 'Funcionário', sector: 'HIGIENIZAÇÃO', registration: 'FUNC-99991', isActive: true },
  { name: 'JACINTA DE FÁTIMA BARROS - HIGIENIZAÇÃO', role: 'Funcionário', sector: 'HIGIENIZAÇÃO', registration: 'FUNC-99992', isActive: true },
  { name: 'SUELY CALIXTO DA SILVA - HIGIENIZAÇÃO', role: 'Funcionário', sector: 'HIGIENIZAÇÃO', registration: 'FUNC-99993', isActive: true },
  { name: 'JOSILENE VIEGAS DAS SILVA - HIGIENIZAÇÃO', role: 'Funcionário', sector: 'HIGIENIZAÇÃO', registration: 'FUNC-99994', isActive: true },
  { name: 'MARIA EDUARDA DE SOUSA ANDRADE', role: 'Funcionário', sector: 'RECEPÇÃO', registration: 'RECEP-10101', isActive: true },
  { name: 'ISABELLE BRUNA DOS SANTOS', role: 'Funcionário', sector: 'RECEPÇÃO', registration: 'RECEP-10102', isActive: true },
  { name: 'JOAO GABRIEL SOARES DO NASCIMENTO', role: 'Funcionário', sector: 'RECEPÇÃO', registration: 'RECEP-10103', isActive: true },
  { name: 'PAULO HENRIQUE ARRUDA - PORTEIRO', role: 'Guarita', sector: 'VIGILANTE', registration: 'VIG-20201', isActive: true },
  { name: 'EWERSON DE LIMA FERREIRA - PORTEIRO', role: 'Portaria', sector: 'VIGILANTE', registration: 'VIG-20202', isActive: true },
  { name: 'WELLINGTON RODRIGUES LEAL', role: 'Funcionário', sector: 'MANUTENÇÃO', registration: 'MAN-30301', isActive: true },
  { name: 'ANTONIO MARCUS DOS SANTOS', role: 'Funcionário', sector: 'MAQUEIRO', registration: 'MAQ-40401', isActive: true },
  { name: 'TÁSSIA DA COSTA ARAUJO LEITE', role: 'Reeducando', sector: 'REEDUCANDO', registration: 'REED-50501', isActive: true },
  { name: 'CAIO MARINHO NOBREGA CRISPIM', role: 'Reeducando', sector: 'REEDUCANDO', registration: 'REED-50502', isActive: true },
  { name: 'ADRAILTON DE SOUZA', role: 'Funcionário', sector: 'CARRO ADM', registration: 'CADM-60601', isActive: true },
  { name: 'MARIA SANDRIELE INGRID DOS SANTOS MARINHO LOPES', role: 'Funcionário', sector: 'ADMINISTRATIVO', registration: 'ADM-70701', isActive: true }
];

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing database schema...');
    // Read schema.sql
    const schemaPath = path.join(process.cwd(), 'server', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('Database schema verified.');

    // Schema migration: ensure users table has the registration column
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS registration VARCHAR(50)');
    await client.query("UPDATE users SET registration = '000001' WHERE username = 'admin' AND registration IS NULL");
    await client.query("UPDATE users SET registration = '1045352' WHERE username = 'sandriele' AND registration IS NULL");
    await client.query("UPDATE users SET registration = '000003' WHERE username = 'operador' AND registration IS NULL");

    // Schema migration: shifts soft-delete support
    await client.query('ALTER TABLE shifts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE');
    await client.query('ALTER TABLE shifts DROP CONSTRAINT IF EXISTS unique_date_period');
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_date_period ON shifts (date, period) WHERE (is_deleted = FALSE)');
    console.log('Database schema migrations applied.');

    // Check if we need to seed users
    const usersCountRes = await client.query('SELECT COUNT(*) FROM users');
    const usersCount = parseInt(usersCountRes.rows[0].count, 10);

    if (usersCount === 0) {
      console.log('Seeding initial system users...');
      for (const u of INITIAL_USERS) {
        await client.query(
          `INSERT INTO users (id, username, password_hash, name, email, role, registration, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [u.id, u.username, u.passwordHash, u.name, u.email, u.role, u.registration, u.isActive, u.createdAt]
        );
      }

      console.log('Seeding initial employee roles...');
      for (let i = 0; i < INITIAL_ROLES.length; i++) {
        const roleName = INITIAL_ROLES[i];
        const roleId = `role_${i + 1}`;
        await client.query(
          `INSERT INTO employee_roles (id, name, is_active) VALUES ($1, $2, $3)`,
          [roleId, roleName, true]
        );
      }

      console.log('Seeding initial employees...');
      // Load roles back to map IDs
      const rolesRes = await client.query('SELECT id, name FROM employee_roles');
      const rolesMap = new Map(rolesRes.rows.map(r => [r.name.toLowerCase(), r.id]));

      for (let i = 0; i < INITIAL_EMPLOYEES.length; i++) {
        const emp = INITIAL_EMPLOYEES[i];
        const empId = `emp_${i + 1}`;
        const matchedRoleId = rolesMap.get(emp.role.toLowerCase());
        
        await client.query(
          `INSERT INTO employees (id, name, role_id, role, sector, sectors, registration, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [empId, emp.name, matchedRoleId || null, emp.role, emp.sector, [emp.sector], emp.registration, emp.isActive]
        );
      }

      console.log('Seeding completed successfully!');
    }

    // Ensure at least one ADMIN user exists
    const adminCheckRes = await client.query("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'");
    const adminCount = parseInt(adminCheckRes.rows[0].count, 10);
    if (adminCount === 0) {
      console.log('No administrator user found in database. Creating default admin...');
      const adminUser = INITIAL_USERS.find(u => u.role === 'ADMIN') || INITIAL_USERS[0];
      
      // Ensure 'admin' username is not occupied by another role
      const usernameCheck = await client.query("SELECT COUNT(*) FROM users WHERE username = 'admin'");
      const hasAdminUsername = parseInt(usernameCheck.rows[0].count, 10) > 0;
      const adminUsername = hasAdminUsername ? `admin_${Date.now()}` : 'admin';
      const adminId = `user_${Date.now()}`;

      await client.query(
        `INSERT INTO users (id, username, password_hash, name, email, role, registration, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [adminId, adminUsername, adminUser.passwordHash, adminUser.name, adminUser.email, 'ADMIN', adminUser.registration, true, new Date().toISOString()]
      );
      console.log(`Default administrator user "${adminUsername}" successfully created.`);
    }

    // Ensure 'system' user exists to prevent foreign key violation on auto-close shifts
    const systemUserCheck = await client.query("SELECT COUNT(*) FROM users WHERE id = 'system'");
    const systemUserCount = parseInt(systemUserCheck.rows[0].count, 10);
    if (systemUserCount === 0) {
      console.log("No system user found in database. Creating system user...");
      await client.query(
        `INSERT INTO users (id, username, password_hash, name, email, role, registration, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        ['system', 'system', 'system_no_login', 'Sistema', 'system@system.local', 'ADMIN', 'SYSTEM', true, new Date().toISOString()]
      );
      console.log("System user successfully created.");
    }
  } catch (error) {
    console.error('Failed to initialize and seed database:', error);
  } finally {
    client.release();
  }
}
