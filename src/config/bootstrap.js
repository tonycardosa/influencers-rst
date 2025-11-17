const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASS = '',
  DB_NAME = 'rst_affiliates',
} = process.env;

const DEFAULT_ADMINS = [
  { email: 'tcardosa@outlook.com', name: 'RST Admin TC' },
  { email: 'info@rstferramentas.com', name: 'RST Admin Info' },
];

async function ensureDatabaseExists() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASS,
  });
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();
}

function getSchemaStatements() {
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.startsWith('--'));
}

async function ensureSchema(pool) {
  const statements = getSchemaStatements();
  for (const statement of statements) {
    // eslint-disable-next-line no-await-in-loop
    await pool.query(statement);
  }
}

async function ensureAdminUsers(pool) {
  for (const admin of DEFAULT_ADMINS) {
    // eslint-disable-next-line no-await-in-loop
    await pool.query(
      `INSERT INTO psrst_users (email, name, role)
       VALUES (?, ?, 'admin')
       ON DUPLICATE KEY UPDATE role = 'admin', name = VALUES(name)`,
      [admin.email, admin.name],
    );
  }
}

async function bootstrapDatabase() {
  await ensureDatabaseExists();
  const pool = await mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
  });

  try {
    await ensureSchema(pool);
    await ensureAdminUsers(pool);
  } finally {
    await pool.end();
  }
}

module.exports = bootstrapDatabase;
