// controllers/verifyInvoiceStatusController.js
/**
 * @file Servicio para verificar el estado de una factura electrónica en LaFactura.co
 * @description Envía una solicitud al API de LaFactura.co para consultar el estado de un TASCODE (factura).
 */

const axios = require("axios");
const logger = require("../utils/logger");

const BASE_URL =
  process.env.LAFACTURA_URL || "https://play.tas-la.com/facturacion.v30/";
const INVOICE_ENDPOINT = "invoice/";

const verifyInvoiceStatus = async (userName, password, data) => {
  try {
    const url = `${BASE_URL}${INVOICE_ENDPOINT}`;

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
    logger.error(`❌ Error al verificar estado de factura: ${error.message}`);

    if (error.response) {
      logger.error(
        `📨 Respuesta de error del servidor: ${JSON.stringify(
          error.response.data
        )}`
      );
      return error.response.data; // Devolvemos error que viene del servidor
    }

    return {
      error: true,
      message: `Error al verificar factura: ${error.message}`,
    };
  }
};

module.exports = verifyInvoiceStatus;
