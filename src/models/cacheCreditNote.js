// models/cacheCreditNote.js
/**
 * @file Servicio de cacheo y actualización de notas de crédito en la base de datos.
 * @description Inserta o actualiza registros de notas de crédito en la tabla `transacciones` y determina cuáles deben ser procesadas.
 */

const executeQuery = require("../utils/executeQuery");
const logger = require("../utils/logger");

/**
 * Procesa un arreglo de transacciones de notas de crédito.
 */
const cacheCreditNote = async (transactions) => {
  const pendingTransactions = [];

  try {
    for (const transaction of transactions) {
      if (!validateTransaction(transaction)) {
        logger.error(`❌ Transacción inválida: ${JSON.stringify(transaction)}`);
        continue;
      }

      const cachedStatus = await getStatusInvoice(transaction.intId);

      if (cachedStatus.length > 0) {
        await handleExistingTransaction(
          transaction,
          cachedStatus[0],
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
    const result = await executeQuery(query, [intId]);
    return result;
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
      cachedStatus.estado_nota_credito !== transaction.estadoNotaCredito ||
      cachedStatus.solicitud_nota_credito !== transaction.solicitudNotaCredito
    ) {
      await updateTransaction(transaction);
    } else if (
      ["Sin Nota de Credito", "Error en Nota de Credito"].includes(
        cachedStatus.estado_nota_credito
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
      transaction.solicitudNotaCredito,
      transaction.estadoNotaCredito,
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
    data.solicitudNotaCredito,
    data.estadoNotaCredito,
  ];

  try {
    await executeQuery(query, params);
    pendingTransactions.push(data);
    logger.info(`✅ Transacción ${data.intId} insertada correctamente.`);
  } catch (error) {
    logger.error(
      `❌ Error insertando la transacción ${data.intId}: ${error.message}`
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
    !transaction.solicitudNotaCredito ||
    !transaction.estadoNotaCredito
  ) {
    return false;
  }

  const estadosPermitidos = [
    "Sin Nota de Credito",
    "Error en Nota de Credito",
    "Nota de Credito Exitosa",
    "Cancelado",
  ];
  return estadosPermitidos.includes(transaction.estadoNotaCredito);
};

module.exports = cacheCreditNote;
