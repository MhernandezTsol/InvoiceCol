// controllers/Invoice/processInvoice.js
/**
 * @file Servicio para obtener y preparar facturas a procesar en Magaya para su envío a LaFactura.co.
 */

const firstTransByDate = require("../../services/magayaInvoiceFirstService");
const nextTransByDate = require("../../services/magayaInvoiceNextService");
const parseXmlString = require("../../utils/parseXmlString");
const fetchInvoices = require("./fetchInvoices");
const cachearTransaccion = require("../../models/cacheDb");
const getTransaction = require("../../services/magayaGetTransaction");
const getValueCustomField = require("../../utils/getValueCustomField");
const logger = require("../../utils/logger");

/**
 * Obtiene todas las facturas del día a procesar.
 */
const getAllInvoiceToProcess = async (
  networkId,
  accessKey,
  functionParam,
  urlMagaya
) => {
  logger.info(`🔍 Iniciando obtención de facturas para ${networkId}`);

  try {
    const invoicesArray = await fetchInvoices(
      networkId,
      accessKey,
      functionParam,
      firstTransByDate,
      nextTransByDate,
      parseXmlString,
      urlMagaya
    );

    if (invoicesArray.length === 0) {
      logger.info("📭 No se encontraron facturas en el rango de fechas.");
      return [];
    }

    logger.info(`📋 Total de facturas obtenidas: ${invoicesArray.length}`);
    const processedInvoices = [];

    for (const invoice of invoicesArray) {
      const objectInvoice = await fetchAndProcessInvoice(
        networkId,
        accessKey,
        invoice.Number,
        urlMagaya
      );
      if (objectInvoice && shouldProcessInvoice(objectInvoice)) {
        processedInvoices.push(objectInvoice);
      }
    }

    if (processedInvoices.length > 0) {
      const result = await cachearTransaccion(processedInvoices);
      logger.info(`🗃️ Facturas almacenadas en caché: ${result}`);
    }

    return processedInvoices;
  } catch (error) {
    logger.error(`❌ Error obteniendo facturas: ${error.message}`);
    return [];
  }
};

/**
 * Procesa manualmente un conjunto de facturas.
 */
const processInvoices = async (
  invoices,
  networkId,
  invoicesArray,
  accessKey,
  urlMagaya
) => {
  for (const invoice of invoices) {
    try {
      const objectInvoice = await fetchAndProcessInvoice(
        networkId,
        accessKey,
        invoice.Number,
        urlMagaya
      );
      if (objectInvoice && shouldProcessInvoice(objectInvoice)) {
        invoicesArray.push(objectInvoice);
      }
    } catch (error) {
      logger.error(
        `❌ Error procesando factura ${invoice.Number}: ${error.message}`
      );
    }
  }
};

/**
 * Verifica si una factura debe procesarse.
 */
const shouldProcessInvoice = (invoice) => {
  const { solicitudFactura, estadoFactura } = invoice;
  return (
    solicitudFactura === "Emitir Factura Electronica" &&
    (estadoFactura === "Sin Factura Electronica" ||
      estadoFactura === "Error en Factura Electronica")
  );
};

/**
 * Obtiene y transforma la información de una factura individual.
 */
const fetchAndProcessInvoice = async (
  networkId,
  accessKey,
  invoiceNumber,
  urlMagaya
) => {
  try {
    const returnInvoice = await getTransaction({
      networkId,
      access_key: accessKey,
      type: "IN",
      flags: "90",
      transaction: invoiceNumber,
      urlMagaya,
    });

    const jsonResult = await parseXmlString(returnInvoice.transXmlContext);
    return await getInfoInvoice(jsonResult, networkId);
  } catch (error) {
    logger.error(
      `❌ Error obteniendo transacción ${invoiceNumber}: ${error.message}`
    );
    return null;
  }
};

/**
 * Extrae la información principal de una factura desde Magaya.
 */
const getInfoInvoice = async (value, networkId) => {
  try {
    const invoice = value.Invoice;
    return {
      networkId,
      intId: invoice.Number,
      type: "IN",
      guid: invoice.GUID,
      solicitudFactura: await getValueCustomField(
        invoice.CustomFields.CustomField,
        "solicitud_factura"
      ),
      estadoFactura: await getValueCustomField(
        invoice.CustomFields.CustomField,
        "estado_factura"
      ),
      tasCode: await getValueCustomField(
        invoice.CustomFields.CustomField,
        "tas_code"
      ),
    };
  } catch (error) {
    logger.error(
      `❌ Error extrayendo información de factura: ${error.message}`
    );
    return null;
  }
};

module.exports = getAllInvoiceToProcess;
