// cancel/fetchCancel.js
/**
 * @file Servicio para obtener facturas desde Magaya para su evaluación de cancelación.
 * @description Consulta facturas emitidas en los últimos 30 días, evitando duplicados.
 */

const { format, subDays } = require("date-fns");
const logger = require("../../utils/logger"); // Usamos logger estructurado

/**
 * Obtiene facturas emitidas en Magaya, para proceso de cancelación posterior.
 *
 * @param {string} networkId - ID de red de Magaya.
 * @param {string} accessKey - Clave de acceso a sesión.
 * @param {string} functionParam - Función Magaya para filtrar resultados.
 * @param {Function} firstTransByDate - Servicio de primera página de resultados.
 * @param {Function} nextTransByDate - Servicio de siguientes páginas de resultados.
 * @param {Function} parseXmlString - Servicio de parseo XML.
 * @returns {Promise<Array>} - Facturas únicas obtenidas.
 */
const fetchCancel = async (
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
  let cancelArray = [];
  let uniqueCancel = new Map();

  for (let i = daysAgo; i > 0; i--) {
    const startDate = format(subDays(currentDate, i), "yyyy-MM-dd");
    const endDate = format(subDays(currentDate, i - 1), "yyyy-MM-dd");

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

    logger.info(`📆 Consultando facturas del ${startDate} al ${endDate}`);

    const { cookie, more_results, success } = await firstTransByDate(params);

    if (success !== "no_error") {
      logger.error(
        `❌ Error al consultar facturas para ${startDate}: ${success}`
      );
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

      let cancelTransaction = jsonResult.Invoices?.Invoice;
      if (!cancelTransaction) {
        logger.info(`📭 No hay facturas para ${startDate}`);
        currentCookie = resCookie;
        hasMoreResults = moreResults;
        continue;
      }

      cancelTransaction = Array.isArray(cancelTransaction)
        ? cancelTransaction
        : [cancelTransaction];

      for (const cancelTrans of cancelTransaction) {
        const key = cancelTrans.Number;
        if (!uniqueCancel.has(key)) {
          uniqueCancel.set(key, cancelTrans);
        }
      }

      currentCookie = resCookie;
      hasMoreResults = moreResults;
    }
  }

  cancelArray = Array.from(uniqueCancel.values());

  logger.info(
    `✅ Total de facturas únicas obtenidas para cancelación: ${cancelArray.length}`
  );
  return cancelArray;
};

module.exports = fetchCancel;
