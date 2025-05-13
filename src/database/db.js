// database/db.js
/**
 * @file Configuración de la conexión a la base de datos MySQL usando un pool de conexiones.
 * @description Establece el pool de conexiones y expone una función para probar la conexión.
 */

const mysql = require("mysql2/promise");
const logger = require("../utils/logger");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  queueLimit: 0,
});

/**
 * Prueba la conexión a la base de datos MySQL.
 * Finaliza el proceso si no se puede establecer la conexión.
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    logger.info("✅ Conexión exitosa a la base de datos");
    connection.release();
  } catch (error) {
    logger.error(`❌ Error al conectar a la base de datos: ${error.message}`);
    process.exit(1); // Finaliza el proceso si no hay conexión
  }
};

module.exports = { pool, testConnection };
