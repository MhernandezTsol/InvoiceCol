// creditNote/fetchCreditNotes.js
/**
 * @file Servicio para obtener notas de crédito desde Magaya Cloud de los últimos 30 días.
 * @description Consulta paginada de notas de crédito, evitando duplicados y consolidando resultados.
 */

const { format, subDays } = require("date-fns");
const logger = require("../../utils/logger"); // Importamos logger

/**
 * Consulta las notas de crédito emitidas en Magaya en los últimos 30 días.
 *
 * @param {string} networkId - ID de red de Magaya.
 * @param {string} accessKey - Clave de acceso de sesión.
 * @param {string} functionParam - Función específica a invocar en Magaya.
 * @param {Function} firstTransByDate - Función para obtener primera página de resultados.
 * @param {Function} nextTransByDate - Función para obtener páginas siguientes.
 * @param {Function} parseXmlString - Función para parsear XML de respuesta.
 * @returns {Promise<Array>} - Arreglo de notas de crédito únicas encontradas.
 */
const fetchCreditNote = async (
  networkId,
  accessKey,
  functionParam,
  firstTransByDate,
  nextTransByDate,
  parseXmlString,
  urlMagaya
) => {
  let daysAgo = 30;
  let currentDate = new Date();
  let creditNoteArray = [];
  let uniqueCreditNotes = new Map();

  for (let i = daysAgo; i > 0; i--) {
    let startDate = format(subDays(currentDate, i), "yyyy-MM-dd");
    let endDate = format(subDays(currentDate, i - 1), "yyyy-MM-dd");

    const params = {
      networkId,
      accessKey,
      type: "IN",
      startDate,
      endDate,
      flags: "524288",
      functionMagaya: functionParam,
      urlMagaya,
    };

    logger.info(
      `📆 Consultando notas de crédito del ${startDate} al ${endDate}`
    );

    const { cookie, more_results, success } = await firstTransByDate(params);

    if (success !== "no_error") {
      logger.error(`❌ Error al consultar ${startDate}: ${success}`);
      continue;
    }

    let currentCookie = cookie;
    let hasMoreResults = more_results;

    while (hasMoreResults !== "0" && currentCookie) {
      const { resCookie, transListXml, moreResults } = await nextTransByDate({
        networkId,
        cookie: currentCookie,
        urlMagaya,
      });

      if (!transListXml) {
        logger.info(`📭 Sin resultados para ${startDate}`);
        break;
      }

      const jsonResult = await parseXmlString(transListXml);
      if (!jsonResult) {
        logger.error(`❌ Error al parsear XML para ${startDate}`);
        continue;
      }

      let creditNotes = jsonResult.Invoices?.CreditMemo;
      if (!creditNotes) {
        logger.info(`📭 No hay notas de crédito para ${startDate}`);
        currentCookie = resCookie;
        hasMoreResults = moreResults;
        continue;
      }

      creditNotes = Array.isArray(creditNotes) ? creditNotes : [creditNotes];

      for (const creditNote of creditNotes) {
        const key = creditNote.Number;
        if (!uniqueCreditNotes.has(key)) {
          uniqueCreditNotes.set(key, creditNote);
        }
      }

      currentCookie = resCookie;
      hasMoreResults = moreResults;
    }
  }

  creditNoteArray = Array.from(uniqueCreditNotes.values());

  logger.info(
    `✅ Total de notas de crédito únicas obtenidas: ${creditNoteArray.length}`
  );
  return creditNoteArray;
};

module.exports = fetchCreditNote;
