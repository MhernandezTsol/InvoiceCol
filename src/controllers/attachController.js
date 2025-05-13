// controllers/attachController.js
/**
 * @file Controlador para descargar una factura generada y adjuntarla a una transacción en Magaya.
 */

const axios = require("axios");
const { Buffer } = require("buffer");
const setAttachment = require("../services/magayaSetAttachment");
const logger = require("../utils/logger");

/**
 * Descarga el archivo ZIP de la factura desde la URL y lo adjunta en Magaya.
 *
 * @param {Object} data - Información de la transacción Magaya (networkId, accessKey, number).
 * @param {string} url - URL del archivo a descargar.
 * @returns {Promise<Object>} - Respuesta del servicio de adjuntar en Magaya.
 */
const attachInvoice = async (data, url) => {
  const { networkId, accessKey, number, urlMagaya } = data;

  try {
    logger.info(`📥 Descargando archivo de la factura ${number}`);
    const response = await axios.get(url, { responseType: "arraybuffer" });

    const fileName = `factura_${number}`;
    const fileExtension = "zip";
    const base64Data = Buffer.from(response.data).toString("base64");

    logger.info(`✅ Archivo de la factura ${number} convertido a base64`);

    const attachmentXml = `
    <Attachment xmlns="http://www.magaya.com/XMLSchema/V1">
        <Name>${fileName}</Name>
        <Extension>${fileExtension}</Extension>
        <IsImage>false</IsImage>
        <Data><![CDATA[${base64Data}]]></Data> 
    </Attachment>`;

    logger.info(`📎 Adjuntando factura ${number} a Magaya...`);
    const responseSetAttachment = await setAttachment({
      networkId,
      accessKey,
      flags: 4,
      number,
      type: "IN",
      attachXml: attachmentXml,
      urlMagaya,
    });

    logger.info(`✅ Factura ${number} adjuntada correctamente.`);
    return responseSetAttachment;
  } catch (error) {
    logger.error(
      `❌ No se pudo adjuntar la factura ${number}: ${error.message}`
    );
    throw error;
  }
};

module.exports = attachInvoice;
