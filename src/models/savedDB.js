// models/savedDB.js
/**
 * @file Servicio para insertar nuevas transacciones en la base de datos.
 * @description Inserta una lista de transacciones en la tabla `transacciones`, registrando errores si ocurren.
 */

const executeQuery = require("../utils/executeQuery");
const logger = require("../utils/logger");

/**
 * Inserta un arreglo de nuevas transacciones en la base de datos.
 *
 * @param {Array} transactions - Lista de transacciones a insertar.
 */
const insertNewTransaction = async (transactions) => {
  for (const transaction of transactions) {
    if (!validateTransaction(transaction)) {
      logger.error(
        `❌ Transacción inválida, no se insertará: ${JSON.stringify(
          transaction
        )}`
      );
      continue;
    }

    const insertQuery = `
      INSERT INTO transacciones (intID, type, networkId, customer, solicitud_factura, estado_factura, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      transaction.intId,
      transaction.type,
      transaction.networkId,
      transaction.customerName,
      transaction.solicitudFactura,
      transaction.estadoFactura,
    ];

    try {
      const result = await executeQuery(insertQuery, params);
      logger.info(
        `✅ Transacción ${transaction.intId} insertada correctamente.`
      );
    } catch (error) {
      logger.error(
        `❌ Error insertando transacción ${transaction.intId}: ${error.message}`
      );
    }
  }
};

/**
 * Valida los campos esenciales de una transacción antes de insertar.
 */
const validateTransaction = (transaction) => {
  return (
    transaction.intId &&
    transaction.type &&
    transaction.networkId &&
    transaction.customerName &&
    transaction.solicitudFactura &&
    transaction.estadoFactura
  );
};

module.exports = { insertNewTransaction };
