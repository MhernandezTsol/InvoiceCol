// services/magayaGetTransaction.js
/**
 * @file Servicio para obtener una transacción específica desde Magaya Cloud.
 * @description Envía una solicitud SOAP para recuperar el XML de una transacción específica.
 */

const axios = require("axios");
const jsdom = require("jsdom");
const logger = require("../utils/logger");

const { JSDOM } = jsdom;

/**
 * Obtiene la información de una transacción (factura, nota, etc.) en Magaya Cloud.
 *
 * @param {Object} data - Información necesaria para la solicitud (networkId, access_key, type, flags, transaction).
 * @returns {Promise<Object>} - Objeto con `returnContext` y `transXmlContext`.
 */
const getTransaction = async (data) => {
  const { networkId, access_key, type, flags, transaction, urlMagaya } = data;

  try {
    const url = urlMagaya;
    const headers = {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "#GetTransaction",
    };

    const postData = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <GetTransactionIn>
            <access_key>${access_key}</access_key>
            <type>${type}</type>
            <flags>${flags}</flags>
            <number>${transaction}</number>
          </GetTransactionIn>
        </soap:Body>
      </soap:Envelope>
    `;

    const response = await axios.post(url, postData, { headers });

    const dom = new JSDOM(response.data, { contentType: "text/xml" });
    const xmlDom = dom.window.document;

    const returnElement = xmlDom.querySelector("return");
    const transXmlElement = xmlDom.querySelector("trans_xml");

    if (!returnElement || !transXmlElement) {
      logger.error(
        `❌ Respuesta SOAP inválida: No se encontraron nodos requeridos en la respuesta para transacción ${transaction}`
      );
      throw new Error(
        `Respuesta inválida de Magaya para la transacción ${transaction}`
      );
    }

    const returnContext = returnElement.textContent.trim();
    const transXmlContext = transXmlElement.textContent.trim();

    logger.info(`✅ Transacción ${transaction} obtenida correctamente.`);
    return { returnContext, transXmlContext };
  } catch (error) {
    logger.error(
      `❌ Error obteniendo transacción ${data.transaction || "desconocida"}: ${
        error.message
      }`
    );
    throw error;
  }
};

module.exports = getTransaction;
