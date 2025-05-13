// services/magayaAuthService.js
/**
 * @file Servicio para iniciar sesión en Magaya Cloud mediante API SOAP.
 * @description Envía una solicitud SOAP para obtener el `access_key` de sesión.
 */

const axios = require("axios");
const jsdom = require("jsdom");
const logger = require("../utils/logger");

const { JSDOM } = jsdom;

/**
 * Inicia sesión en Magaya Cloud y obtiene el `access_key`.
 *
 * @param {string} networkid - NetworkID de Magaya.
 * @param {string} username - Usuario de Magaya.
 * @param {string} password - Contraseña de Magaya.
 * @returns {Promise<Object>} - Objeto con `networkid` y `access_key`, o error en caso de fallo.
 */
const startSession = async (networkid, username, password, urlMagaya) => {
  try {
    const url = urlMagaya;
    const headers = {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "#StartSession",
    };

    const postData = `
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <StartSessionIn>
            <user>${username}</user>
            <pass>${password}</pass>
          </StartSessionIn>
        </soap:Body>
      </soap:Envelope>
    `;

    const response = await axios.post(url, postData, { headers });

    const dom = new JSDOM(response.data, { contentType: "text/xml" });
    const xmlDom = dom.window.document;

    const returnElement = xmlDom.querySelector("return");
    const returnAccessKey = xmlDom.querySelector("access_key");

    // Validar que existan nodos esperados
    if (!returnElement) {
      logger.error("❌ No se encontró nodo <return> en la respuesta SOAP.");
      return {
        error: "Respuesta inválida",
        message: "No se pudo procesar respuesta de Magaya",
      };
    }

    if (returnElement.textContent === "access_denied") {
      logger.warn(`⚠️ Acceso denegado para usuario ${username}`);
      return { error: "Acceso denegado", message: "Credenciales incorrectas" };
    }

    if (
      !returnAccessKey ||
      !returnAccessKey.textContent ||
      returnAccessKey.textContent.trim() === ""
    ) {
      logger.error(
        `❌ access_key inválido o vacío recibido para usuario ${username}`
      );
      return {
        error: "AccessKey inválido",
        message: "No se recibió access_key válido desde Magaya",
      };
    }

    const access_key = returnAccessKey.textContent.trim();

    logger.info(`✅ Sesión iniciada correctamente para ${username}`);
    return { networkid, access_key };
  } catch (error) {
    logger.error(`❌ Error al iniciar sesión en Magaya: ${error.message}`);
    throw error;
  }
};

module.exports = startSession;
