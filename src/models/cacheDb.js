// models/cacheDb.js
/**
 * @file Servicio de cacheo y actualización de facturas electrónicas en la base de datos.
 * @description Inserta o actualiza registros de facturas en la tabla `transacciones` y determina cuáles deben ser procesadas.
 */

const executeQuery = require("../utils/executeQuery");
const logger = require("../utils/logger");

/**
 * Procesa un arreglo de transacciones de facturación.
 */
const cacheTransactions = async (transactions) => {
  const pendingTransactions = [];

  try {
    for (const transaction of transactions) {
      if (!validateTransaction(transaction)) {
        logger.error(`❌ Transacción inválida: ${JSON.stringify(transaction)}`);
        continue;
      }

      const cachedStatus = await getStatusInvoice(transaction.intId);

      if (cachedStatus) {
        await handleExistingTransaction(
          transaction,
          cachedStatus,
          pendingTransactions
        );
      } else {
        await insertNewTransaction(transaction, pendingTransactions);
      }
    }

    return pendingTransactions;
  } catch (error) {
    logger.error(`❌ Error procesando transacciones: ${error.message}`);
    throw error;
  }
};

/**
 * Obtiene el estado actual de una transacción en la base de datos.
 */
const getStatusInvoice = async (intId) => {
  const query = `SELECT * FROM transacciones WHERE intId = ?`;

  try {
    const [cachedStatus] = await executeQuery(query, [intId]);
    return cachedStatus;
  } catch (error) {
    logger.error(
      `❌ Error obteniendo estado de la factura ${intId}: ${error.message}`
    );
    throw error;
  }
};

/**
 * Maneja una transacción existente en la base de datos.
 */
const handleExistingTransaction = async (
  transaction,
  cachedStatus,
  pendingTransactions
) => {
  try {
    if (
      cachedStatus.estado_factura !== transaction.estadoFactura ||
      cachedStatus.solicitud_factura !== transaction.solicitudFactura
    ) {
      await updateTransaction(transaction);
    } else if (
      ["Sin Factura Electronica", "Error en Factura Electronica"].includes(
        cachedStatus.estado_factura
      )
    ) {
      pendingTransactions.push(transaction);
    }
  } catch (error) {
    logger.error(
      `❌ Error actualizando la transacción ${transaction.intId}: ${error.message}`
    );
    throw error;
  }
};

/**
 * Actualiza una transacción existente.
 */
const updateTransaction = async (transaction) => {
  const query = `
    UPDATE transacciones 
    SET solicitud_factura = ?, estado_factura = ?, updatedAt = NOW() 
    WHERE intId = ?
  `;

  try {
    await executeQuery(query, [
      transaction.solicitudFactura,
      transaction.estadoFactura,
      transaction.intId,
    ]);
    logger.info(
      `✅ Transacción ${transaction.intId} actualizada correctamente.`
    );
  } catch (error) {
    logger.error(
      `❌ Error actualizando transacción ${transaction.intId}: ${error.message}`
    );
    throw error;
  }
};

/**
 * Inserta una nueva transacción en la base de datos.
 */
const insertNewTransaction = async (data, pendingTransactions) => {
  const query = `
    INSERT INTO transacciones (intId, type, networkId, guid, solicitud_factura, estado_factura, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE solicitud_factura = VALUES(solicitud_factura), estado_factura = VALUES(estado_factura), updatedAt = NOW();
  `;

  const params = [
    data.intId,
    data.type,
    data.networkId,
    data.guid,
    data.solicitudFactura,
    data.estadoFactura,
  ];

  try {
    await executeQuery(query, params);
    pendingTransactions.push(data);
    logger.info(`✅ Transacción ${data.intId} insertada correctamente.`);
  } catch (error) {
    logger.error(
      `❌ Error insertando transacción ${data.intId}: ${error.message}`
    );
    throw error;
  }
};

/**
 * Valida la estructura de una transacción.
 */
const validateTransaction = (transaction) => {
  if (
    !transaction.intId ||
    !transaction.type ||
    !transaction.networkId ||
    !transaction.guid ||
    !transaction.solicitudFactura ||
    !transaction.estadoFactura
  ) {
    return false;
  }

  const estadosPermitidos = [
    "Sin Factura Electronica",
    "Error en Factura Electronica",
    "Factura Electronica Exitosa",
    "Cancelado",
  ];
  return estadosPermitidos.includes(transaction.estadoFactura);
};

module.exports = cacheTransactions;
