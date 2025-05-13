// utils/executeQuery.js
/**
 * @file Utilidad para ejecutar consultas SQL con parámetros preparados usando un pool de conexiones.
 * @description Abstrae el acceso a base de datos, validando consultas y manejando errores.
 */

const { pool } = require("../database/db");
const logger = require("../utils/logger");

/**
 * Ejecuta una consulta SQL segura utilizando parámetros preparados.
 *
 * @param {string} query - Consulta SQL a ejecutar.
 * @param {Array} [params=[]] - Parámetros para la consulta preparada.
 * @returns {Promise<any>} - Resultado de la consulta.
 */
const executeQuery = async (query, params = []) => {
  try {
    if (!query || typeof query !== "string") {
      throw new Error("Consulta SQL inválida. Debe ser un string.");
    }
    if (!Array.isArray(params)) {
      throw new Error("Los parámetros deben ser un arreglo.");
    }

    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    logger.error(`❌ Error al ejecutar consulta SQL: ${error.message}`, {
      query,
      params,
    });
    throw error; // Propaga el error para manejo en capas superiores
  }
};

module.exports = executeQuery;
