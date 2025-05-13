// services/magayaInvoiceNextService.js
/**
 * @file Servicio para obtener el siguiente conjunto de transacciones en Magaya Cloud usando paginación (cookie).
 * @description Continúa la consulta de facturas u órdenes utilizando el cookie obtenido previamente.
 */

const axios = require("axios");
const jsdom = require("jsdom");
const logger = require("../utils/logger");

const { JSDOM } = jsdom;

/**
 * Obtiene el siguiente rango de transacciones usando cookie de paginación.
 *
 * @param {Object} data - Parámetros necesarios para la consulta (networkId, cookie).
 * @returns {Promise<Object>} - Objeto con `resCookie`, `transListXml`, `moreResults`.
 */
const getNextTransByDateJS = async (data) => {
  try {
    const { networkId, cookie, urlMagaya } = data;

    const url = urlMagaya;
    const headers = {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "#GetNextTransbyDate",
    };

    const postData = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <GetNextTransbyDateIn>
            <cookie>${cookie}</cookie>
          </GetNextTransbyDateIn>
        </soap:Body>
      </soap:Envelope>
    `;

    const response = await axios.post(url, postData, { headers });
    const dom = new JSDOM(response.data, { contentType: "text/xml" });
    const xmlDOM = dom.window.document;

    const returnElement = xmlDOM.querySelector("return");
    const returnCookie = xmlDOM.querySelector("cookie");
    const returnTransListXml = xmlDOM.querySelector("trans_list_xml");
    const returnMoreResults = xmlDOM.querySelector("more_results");

    if (
      !returnElement ||
      !returnCookie ||
      !returnTransListXml ||
      !returnMoreResults
    ) {
      logger.error(
        `❌ Respuesta SOAP inválida al continuar paginación con cookie: ${cookie}`
      );
      throw new Error(`Respuesta inválida de Magaya al continuar paginación.`);
    }

    const resCookie = returnCookie.textContent.trim();
    const transListXml = returnTransListXml.textContent.trim();
    const moreResults = returnMoreResults.textContent.trim();

    logger.info(
      `✅ Página de transacciones obtenida exitosamente usando cookie: ${cookie}`
    );
    return { resCookie, transListXml, moreResults };
  } catch (error) {
    logger.error(
      `❌ Error al traer siguiente página de facturas con cookie: ${
        data.cookie || "desconocido"
      } - ${error.message}`
    );
    throw error;
  }
};

module.exports = getNextTransByDateJS;
