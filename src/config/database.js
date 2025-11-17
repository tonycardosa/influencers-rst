const mysql = require('mysql2/promise');

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASS = '',
  DB_NAME = 'rst_affiliates',
  DB_CONN_LIMIT = '10',
} = process.env;

const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(DB_CONN_LIMIT),
  timezone: 'Z',
});

const query = (sql, params = []) => pool.execute(sql, params);
const getConnection = () => pool.getConnection();

module.exports = {
  pool,
  query,
  getConnection,
};
