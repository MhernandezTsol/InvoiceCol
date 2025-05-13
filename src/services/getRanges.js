/**
 * @file Servicio para obtener los rangos de numeración activos desde LaFactura.co.
 * @description Envía solicitud al endpoint /general/ para consultar los rangos disponibles.
 */

const axios = require("axios");
const logger = require("../utils/logger");

const BASE_URL =
  process.env.LAFACTURA_URL || "https://play.tas-la.com/facturacion.v30/";
const GENERAL_ENDPOINT = "general/";

const getRanges = async (userName, password, data) => {
  try {
    const url = `${BASE_URL}${GENERAL_ENDPOINT}`;

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
    logger.error(`❌ Error al obtener rangos: ${error.message}`);

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
      message: `Error al obtener rangos: ${error.message}`,
    };
  }
};

module.exports = getRanges;
