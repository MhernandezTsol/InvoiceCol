// creditNote/processCreditNote.js
/**
 * @file Servicio para obtener y procesar notas de crédito desde Magaya Cloud.
 * @description Consulta y filtra notas de crédito pendientes de procesamiento.
 */

const firstTransByDate = require("../../services/magayaInvoiceFirstService");
const nextTransByDate = require("../../services/magayaInvoiceNextService");
const parseXmlString = require("../../utils/parseXmlString");
const fetchCreditNotes = require("./fetchCreditNotes");
const cachearCreditNote = require("../../models/cacheCreditNote");
const getTransaction = require("../../services/magayaGetTransaction");
const getValueCustomField = require("../../utils/getValueCustomField");
const logger = require("../../utils/logger");

/**
 * Obtiene todas las notas de crédito que deben ser procesadas.
 *
 * @param {string} networkId - ID de red de Magaya.
 * @param {string} accessKey - Clave de sesión activa en Magaya.
 * @param {string} functionParam - Función SOAP a invocar.
 * @returns {Promise<Array>} - Arreglo de notas de crédito procesables.
 */
const getAllCreditNoteToProcess = async (
  networkId,
  accessKey,
  functionParam,
  urlMagaya
) => {
  try {
    logger.info(
      `🚀 Iniciando obtención de Notas de Crédito por día para: ${networkId}`
    );

    const creditnoteArray = await fetchCreditNotes(
      networkId,
      accessKey,
      functionParam,
      firstTransByDate,
      nextTransByDate,
      parseXmlString,
      urlMagaya
    );

    if (creditnoteArray.length === 0) {
      logger.info(
        "📭 No se encontraron notas de crédito en el rango de fechas."
      );
      return [];
    }
    logger.info(
      `📋 Total de notas de crédito obtenidas: ${creditnoteArray.length}`
    );

    const processedCreditNotes = [];

    for (const creditNote of creditnoteArray) {
      try {
        const returnCreditNote = await getTransaction({
          networkId,
          access_key: accessKey,
          type: "IN",
          flags: "90",
          transaction: creditNote.Number,
          urlMagaya,
        });

        const jsonResult = await parseXmlString(
          returnCreditNote.transXmlContext
        );
        const objectCreditNote = await getInfoCreditNote(jsonResult, networkId);

        if (objectCreditNote && shouldProcessCreditnote(objectCreditNote)) {
          processedCreditNotes.push(objectCreditNote);
        }
      } catch (innerError) {
        logger.error(
          `❌ Error al procesar nota de crédito ${creditNote.Number}: ${innerError.message}`
        );
      }
    }

    if (processedCreditNotes.length > 0) {
      const result = await cachearCreditNote(processedCreditNotes);
      logger.info(`✅ Notas de Crédito almacenadas en caché: ${result.length}`);
    }

    return processedCreditNotes;
  } catch (error) {
    logger.error(
      `❌ Error general al traer Notas de Crédito: ${error.message}`
    );
    throw error;
  }
};

/**
 * Determina si una nota de crédito debe ser procesada.
 */
const shouldProcessCreditnote = (creditNote) => {
  const { solicitudNotaCredito, estadoNotaCredito } = creditNote;
  return (
    solicitudNotaCredito === "Emitir Nota de Credito" &&
    (estadoNotaCredito === "Sin Nota de Credito" ||
      estadoNotaCredito === "Error en Nota de Credito")
  );
};

/**
 * Extrae la información relevante de una nota de crédito desde la respuesta XML.
 */
const getInfoCreditNote = async (value, networkId) => {
  try {
    const creditMemo = value.CreditMemo;
    const objectCreditNote = {
      networkId,
      intId: creditMemo.Number,
      type: "IN",
      guid: creditMemo.GUID,
      solicitudNotaCredito: await getValueCustomField(
        creditMemo.CustomFields.CustomField,
        "solicitud_nota_credito"
      ),
      estadoNotaCredito: await getValueCustomField(
        creditMemo.CustomFields.CustomField,
        "estado_nota_credito"
      ),
      tasCode: await getValueCustomField(
        creditMemo.CustomFields.CustomField,
        "tas_code_nota_credito"
      ),
    };

    return objectCreditNote;
  } catch (err) {
    logger.error(
      `❌ Error al extraer información de Nota de Crédito: ${err.message}`
    );
    return null;
  }
};

module.exports = getAllCreditNoteToProcess;
