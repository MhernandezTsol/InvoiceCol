// services/magayaInvoiceFirstService.js
/**
 * @file Servicio para obtener el primer conjunto de transacciones por fecha desde Magaya Cloud.
 * @description Inicia la consulta paginada de facturas u órdenes entre dos fechas específicas.
 */

const axios = require("axios");
const jsdom = require("jsdom");
const logger = require("../utils/logger");

const { JSDOM } = jsdom;

/**
 * Obtiene el primer rango de transacciones por fecha en Magaya.
 *
 * @param {Object} data - Parámetros necesarios para la consulta (networkId, accessKey, type, startDate, endDate, flags, functionMagaya).
 * @returns {Promise<Object>} - Objeto con `cookie`, `more_results` y `success`.
 */
const getFirstTransByDateJS = async (data) => {
  try {
    const {
      networkId,
      accessKey,
      type,
      startDate,
      endDate,
      flags,
      functionMagaya,
      urlMagaya,
    } = data;

    const url = urlMagaya;
    const headers = {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "#GetFirstTransbyDateJS",
    };

    const postData = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <GetFirstTransbyDateJSIn>
            <access_key>${accessKey}</access_key>
            <type>${type}</type>
            <start_date>${startDate}</start_date>
            <end_date>${endDate}</end_date>
            <flags>${flags}</flags>
            <record_quantity>1</record_quantity>
            <backwards_order>76</backwards_order>
            <function>${functionMagaya}</function>
            <xml_params></xml_params>
          </GetFirstTransbyDateJSIn>
        </soap:Body>
      </soap:Envelope>
    `;

    const response = await axios.post(url, postData, { headers });
    const dom = new JSDOM(response.data, { contentType: "text/xml" });
    const xmlDom = dom.window.document;

    const returnElement = xmlDom.querySelector("return");
    const cookieElement = xmlDom.querySelector("cookie");
    const moreResultsElement = xmlDom.querySelector("more_results");

    if (!returnElement || !cookieElement || !moreResultsElement) {
      logger.error(
        `❌ Respuesta SOAP inválida al obtener transacciones entre ${startDate} y ${endDate}`
      );
      throw new Error(
        `Respuesta inválida al consultar transacciones por fecha en Magaya.`
      );
    }

    const cookie = cookieElement.textContent.trim();
    const more_results = moreResultsElement.textContent.trim();
    const success = returnElement.textContent.trim();

    logger.info(
      `✅ Consulta inicial de transacciones realizada para fechas ${startDate} a ${endDate}.`
    );
    return { cookie, more_results, success };
  } catch (error) {
    logger.error(
      `❌ Error al obtener rango de transacciones entre ${data.startDate} y ${data.endDate}: ${error.message}`
    );
    throw error;
  }
};

module.exports = getFirstTransByDateJS;
