const executeQuery = require("../utils/executeQuery");

const updateCancelledTransaction = async (transaction) => {
  const query = `
    UPDATE transacciones 
    SET solicitud_factura = ?, estado_factura = 'Cancelado', updatedAt = NOW() 
    WHERE intId = ?
  `;

  try {
    await executeQuery(query, [
      transaction.solicitudFactura,
      transaction.intId,
    ]);
    console.log("Transacción cancelada correctamente:", transaction.intId);
    return true;
  } catch (error) {
    console.error(
      `Error cancelando la transacción ${transaction.intId}: ${error.message}`
    );
    throw error;
  }
};

module.exports = updateCancelledTransaction;
