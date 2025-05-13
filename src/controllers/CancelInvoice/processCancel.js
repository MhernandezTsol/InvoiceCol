// cancel/processCancel.js
/**
 * @file Servicio para procesar facturas cancelables en Magaya.
 * @description Consulta facturas emitidas, filtra las "ANULADAS" y las prepara para cancelación en LaFactura.co.
 */

const firstTransByDate = require("../../services/magayaInvoiceFirstService");
const nextTransByDate = require("../../services/magayaInvoiceNextService");
const parseXmlString = require("../../utils/parseXmlString");
const fetchCancel = require("./fetchCancel");
const getValueCustomField = require("../../utils/getValueCustomField");
const getTransaction = require("../../services/magayaGetTransaction");
const logger = require("../../utils/logger"); // Logger agregado

/**
 * Obtiene todas las facturas que cumplen los criterios para ser canceladas.
 *
 * @param {string} networkId - ID de red de Magaya.
 * @param {string} accessKey - Clave de acceso.
 * @param {string} functionCancel - Función de Magaya para obtener datos.
 * @returns {Promise<Array>} - Lista de facturas a cancelar.
 */
const getAllInvoiceToProcess = async (
  networkId,
  accessKey,
  functionCancel,
  urlMagaya
) => {
  try {
    logger.info(
      `🚀 Iniciando obtención de solicitudes de cancelaciones para: ${networkId}`
    );

    const cancelArray = await fetchCancel(
      networkId,
      accessKey,
      functionCancel,
      firstTransByDate,
      nextTransByDate,
      parseXmlString,
      urlMagaya
    );

    if (cancelArray.length === 0) {
      logger.info(`📭 No se encontraron cancelaciones en el rango de fechas.`);
      return [];
    }

    logger.info(
      `📋 Total de facturas para evaluar cancelación: ${cancelArray.length}`
    );

    const processedCancel = [];

    for (const cancel of cancelArray) {
      const returnCancel = await getTransaction({
        networkId,
        access_key: accessKey,
        type: "IN",
        flags: "90",
        transaction: cancel.Number,
        urlMagaya,
      });

      const jsonResult = await parseXmlString(returnCancel.transXmlContext);
      const objectCancel = await getInfoCancel(jsonResult, networkId);

      if (objectCancel && shouldProcessCancel(objectCancel)) {
        processedCancel.push(objectCancel);
      }
    }

    return processedCancel;
  } catch (error) {
    logger.error(`❌ Error al traer cancelaciones: ${error.message}`);
    throw error;
  }
};

/**
 * Determina si una factura debe ser procesada para cancelación.
 */
const shouldProcessCancel = (cancelObj) => {
  const { isCancel, tasCode, descriptCancel } = cancelObj;
  return isCancel === "ANULADA: " && (tasCode !== "" || descriptCancel !== "");
};

/**
 * Extrae información necesaria de una factura para cancelarla.
 */
const getInfoCancel = async (value, networkId) => {
  try {
    const invoice = value.Invoice;

    const objCancel = {
      networkId,
      intId: invoice.Number,
      type: "IN",
      guid: invoice.GUID,
      isCancel:
        invoice.Notes && invoice.Notes.includes("ANULADA")
          ? invoice.Notes
          : null,
      tasCode: await getValueCustomField(
        invoice.CustomFields.CustomField,
        "tas_code"
      ),
      descriptCancel: await getValueCustomField(
        invoice.CustomFields.CustomField,
        "description"
      ),
    };

    return objCancel;
  } catch (err) {
    logger.error(
      `❌ Error al obtener información de la cancelación: ${err.message}`
    );
    throw err;
  }
};

module.exports = getAllInvoiceToProcess;
