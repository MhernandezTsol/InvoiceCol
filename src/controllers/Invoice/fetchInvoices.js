// controllers/Invoice/fetchInvoices.js
/**
 * @file Servicio para obtener todas las facturas de los últimos días desde Magaya, eliminando duplicados.
 */

const { format, subDays } = require("date-fns");
const logger = require("../../utils/logger");

/**
 * Obtiene facturas por rango de días anteriores, manejando paginación y evitando duplicados.
 */
const fetchInvoices = async (
  networkId,
  accessKey,
  functionParam,
  firstTransByDate,
  nextTransByDate,
  parseXmlString,
  urlMagaya
) => {
  const daysAgo = 8;
  const currentDate = new Date();
  const uniqueInvoices = new Map(); // Para eliminar duplicados

  logger.info(`🔎 Iniciando consulta de facturas para NetworkID: ${networkId}`);

  for (let i = daysAgo; i > 0; i--) {
    const startDate = format(subDays(currentDate, i), "yyyy-MM-dd");
    const endDate = format(subDays(currentDate, i - 1), "yyyy-MM-dd");

    logger.info(`📅 Consultando transacciones del ${startDate} al ${endDate}`);

    try {
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

      const { cookie, more_results, success } = await firstTransByDate(params);

      if (success !== "no_error") {
        logger.error(`❌ Error al consultar fecha ${startDate}: ${success}`);
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
          logger.info(`📭 Sin resultados adicionales para fecha ${startDate}`);
          break;
        }

        const jsonResult = await parseXmlString(transListXml);
        if (!jsonResult) {
          logger.error(`❌ Error al parsear XML en fecha ${startDate}`);
          break;
        }

        let invoices = jsonResult.Invoices?.Invoice;
        if (!invoices) {
          logger.info(`📭 No hay facturas para fecha ${startDate}`);
          break;
        }

        invoices = Array.isArray(invoices) ? invoices : [invoices];

        for (const invoice of invoices) {
          const key = invoice.Number; // Número único de factura
          if (!uniqueInvoices.has(key)) {
            uniqueInvoices.set(key, invoice);
          }
        }

        currentCookie = resCookie;
        hasMoreResults = moreResults;
      }
    } catch (error) {
      logger.error(
        `❌ Error durante la obtención de facturas en rango ${startDate} - ${endDate}: ${error.message}`
      );
    }
  }

  const invoicesArray = Array.from(uniqueInvoices.values());
  logger.info(`📋 Total de facturas únicas obtenidas: ${invoicesArray.length}`);

  return invoicesArray;
};

module.exports = fetchInvoices;
