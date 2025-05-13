// services/magayaSetCustomFieldValue.js
/**
 * @file Servicio para actualizar campos personalizados en transacciones de Magaya Cloud.
 * @description Envía solicitud SOAP para actualizar el valor de un CustomField en una factura o documento.
 */

const axios = require("axios");
// const { JSDOM } = require("jsdom");
const logger = require("../utils/logger");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
// const { JSDOM } = jsdom;

/**
 * Actualiza el valor de un campo personalizado en Magaya Cloud.
 *
 * @param {Object} data - Parámetros de la transacción y campo a actualizar.
 * @returns {Promise<string>} - Resultado de la operación.
 */
const setCustomFieldValue = async (data) => {
  try {
    const {
      networkId,
      accessKey,
      number,
      type,
      fieldValue,
      fieldInternalName,
      urlMagaya,
    } = data;

    const url = urlMagaya;
    const headers = {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "#SetCustomFieldValue",
    };

    const postData = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <SetCustomFieldValueIn>
            <access_key>${accessKey}</access_key>
            <type>${type}</type>
            <number>${number}</number>
            <field_internal_name>${fieldInternalName}</field_internal_name>
            <field_value>${fieldValue}</field_value>
          </SetCustomFieldValueIn>
        </soap:Body>
      </soap:Envelope>
    `;

    const response = await axios.post(url, postData, { headers });
    const dom = new JSDOM(response.data, { contentType: "text/xml" });
    const xmlDom = dom.window.document;

    const result = xmlDom.querySelector("return");

    if (!result) {
      logger.error(
        `❌ No se encontró respuesta válida para actualizar campo ${fieldInternalName} en transacción ${number}`
      );
      return "No guarda";
    }

    const resultText = result.textContent.trim();

    if (!resultText) {
      logger.error(
        `❌ Error al actualizar campo ${fieldInternalName} en transacción ${number}: ${resultText}`
      );
      return "No guarda";
    }

    logger.info(
      `✅ Campo ${fieldInternalName} actualizado correctamente para transacción ${number}`
    );
    return resultText;
  } catch (error) {
    logger.error(
      `❌ Error al actualizar campo en transacción ${
        data.number || "desconocido"
      }: ${error.message}`
    );
    throw error;
  }
};

module.exports = setCustomFieldValue;
