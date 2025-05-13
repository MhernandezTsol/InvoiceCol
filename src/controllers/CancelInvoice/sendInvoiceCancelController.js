// cancel/sendInvoiceCancelController.js
/**
 * @file Servicio para enviar una cancelación de factura a LaFactura.co mediante API REST.
 */

const axios = require("axios");
const logger = require("../../utils/logger");

/**
 * Envía la solicitud de cancelación de una factura a LaFactura.co.
 *
 * @param {string} userName - Usuario para autenticación HTTP Basic.
 * @param {string} password - Contraseña para autenticación HTTP Basic.
 * @param {Object} data - Payload con los datos de cancelación (`tascode`, `description`).
 * @returns {Promise<Object>} - Respuesta de LaFactura.co (JSON).
 */
const sendInvoiceCancel = async (userName, password, data) => {
  try {
    const url = `${process.env.LAFACTURA_URL}creditNote/`; // usar endpoint correcto y flexible

    const response = await axios.post(url, data, {
      headers: {
        "Content-Type": "application/json",
      },
      auth: {
        username: userName,
        password,
      },
    });

    return response.data;
  } catch (error) {
    logger.error(`❌ Error al cancelar la factura: ${error.message}`);

    if (error.response) {
      logger.error(
        "❌ Respuesta del servidor LaFactura.co:",
        error.response.data
      );
      return error.response.data;
    }

    return {
      error: `Error inesperado al cancelar la factura: ${error.message}`,
    };
  }
};

module.exports = sendInvoiceCancel;
