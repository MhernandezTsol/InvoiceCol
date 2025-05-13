/**
 * @file Servicio para envío de facturas a LaFactura.co
 * @description Envía la factura electrónica vía API a LaFactura.co usando autenticación básica.
 */

const axios = require("axios");
const logger = require("../../utils/logger");

const BASE_URL =
  process.env.LAFACTURA_URL || "https://play.tas-la.com/facturacion.v30/";
const INVOICE_ENDPOINT = "invoice/";

const sendInvoice = async (userName, password, data) => {
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
    logger.error(`❌ Error al enviar la factura: ${error.message}`);

    if (error.response) {
      logger.error(
        `📨 Respuesta de error del servidor: ${JSON.stringify(
          error.response.data
        )}`
      );
      return error.response.data;
    }

    return {
      error: true,
      message: `Error al enviar factura: ${error.message}`,
    };
  }
};

module.exports = sendInvoice;
