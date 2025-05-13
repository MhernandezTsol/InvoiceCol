// services/magayaSetAttachment.js
/**
 * @file Servicio para adjuntar archivos (facturas, XML, PDF) a transacciones en Magaya Cloud.
 * @description Envía una solicitud SOAP para adjuntar archivos a un Invoice u otro documento.
 */

const axios = require("axios");
const { JSDOM } = require("jsdom");
const logger = require("../utils/logger");

/**
 * Adjunta un archivo a una transacción específica en Magaya Cloud.
 *
 * @param {Object} data - Datos de la transacción (networkId, accessKey, flags, number, type, attachXml).
 * @returns {Promise<string>} - Resultado del adjunto (mensaje de éxito o fallo).
 */
const setAttachment = async (data) => {
  try {
    const { networkId, accessKey, flags, number, type, attachXml, urlMagaya } =
      data;

    const url = urlMagaya;
    const headers = {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "#SetAttachment",
    };

    const postData = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <SetAttachmentIn>
            <access_key>${accessKey}</access_key>
            <flags>${flags}</flags>
            <type>${type}</type>
            <number>${number}</number>
            <attach_xml>${attachXml}</attach_xml>
          </SetAttachmentIn>
        </soap:Body>
      </soap:Envelope>
    `;

    const response = await axios.post(url, postData, { headers });
    const dom = new JSDOM(response.data, { contentType: "text/xml" });
    const xmlDom = dom.window.document;

    const result = xmlDom.querySelector("return");

    if (result) {
      const resultText = result.textContent.trim();
      logger.info(
        `✅ Archivo adjuntado correctamente a transacción ${number}.`
      );
      return resultText;
    } else {
      logger.error(
        `❌ No se encontró respuesta válida al adjuntar archivo a transacción ${number}.`
      );
      return "No guarda";
    }
  } catch (error) {
    logger.error(
      `❌ Error al adjuntar archivo a transacción ${
        data.number || "desconocida"
      }: ${error.message}`
    );
    throw error;
  }
};

module.exports = setAttachment;
