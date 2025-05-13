// creditNote/sendCreditNoteController.js
/**
 * @file Servicio para enviar una Nota de Crédito a LaFactura.co mediante API REST.
 */

const axios = require("axios");
const logger = require("../../utils/logger");

/**
 * Envía una nota de crédito a LaFactura.co para su timbrado electrónico.
 *
 * @param {string} userName - Usuario de autenticación HTTP Basic.
 * @param {string} password - Contraseña de autenticación HTTP Basic.
 * @param {Object} data - Payload de la nota de crédito en formato JSON.
 * @returns {Promise<Object>} - Respuesta de LaFactura.co.
 */
const sendCreditNote = async (userName, password, data) => {
  try {
    const url = `${process.env.LAFACTURA_URL}/creditNote/`; // Mejor usar la variable de entorno

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
    logger.error(`❌ Error al generar la nota de crédito: ${error.message}`);

    if (error.response) {
      logger.error(
        `❌ Respuesta del servidor LaFactura.co:`,
        error.response.data
      );
      return error.response.data;
    }

    return { error: `Error al generar la nota de crédito: ${error.message}` };
  }
};

module.exports = sendCreditNote;
