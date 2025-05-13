// controllers/Invoice/processInvoiceController.js
/**
 * @file Controlador para procesamiento de facturas electrónicas.
 * @description Procesa facturas, actualiza campos personalizados, envía a LaFactura.co y gestiona estados en Magaya.
 */

const processInvoices = require("./processInvoice");
const activeUsersController = require("../activeUsersController");
const sendInvoice = require("./sendInvoiceController");
const getTransactionController = require("./getTransactionController");
const setCustomFieldValue = require("../../services/magayaSetCustomFieldValue");
const statusInvoice = require("../verifyInvoiceStatusController");
const attachInvoice = require("../attachController");
const cacheTransactions = require("../../models/cacheDb");
const NodeCache = require("node-cache");
const logger = require("../../utils/logger");

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Constantes
const CUSTOM_FIELDS = {
  ESTADO_FACTURA: "estado_factura",
  INVOICE_MESSAGES: "invoice_messages",
  SOLICITUD_FACTURA: "solicitud_factura",
  TAS_CODE: "tas_code",
  VALOR_CUFE: "valor_cufe",
};

const INVOICE_STATUS = {
  EN_PROCESO: "En Proceso",
  FACTURA_ELECTRONICA_EXITOSA: "Factura Electronica Exitosa",
  ERROR_EN_FACTURA_ELECTRONICA: "Error en Factura Electronica",
  PENDIENTE: "Pendiente",
};

/**
 * Actualiza un campo personalizado en Magaya.
 */
const updateCustomField = async (data) => {
  try {
    const response = await setCustomFieldValue(data);
    logger.info(`🛠️ Actualización exitosa: ${data.fieldInternalName}`);
    return response;
  } catch (error) {
    logger.error(
      `❌ Error actualizando campo: ${data.fieldInternalName} - ${error.message}`
    );
    throw error;
  }
};

/**
 * Retenta la verificación del estado de factura hasta completar o alcanzar intentos máximos.
 */
const retryVerifyStatus = async (
  tasCode,
  userLaFactura,
  passLaFactura,
  maxAttempts = 10
) => {
  const dataStatus = { verifyStatus: { tascode: tasCode } };

  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    const statusResult = await statusInvoice(
      userLaFactura,
      passLaFactura,
      dataStatus
    );
    const { process, URL: url } = statusResult.invoiceResult.document;

    if (process !== 0) {
      return { process, url };
    }

    logger.info(
      `⏳ Esperando para re-verificar estado (intent ${attempts + 1})...`
    );
    await new Promise((resolve) => setTimeout(resolve, 15000));
  }

  logger.warn("⚠️ Máximo de intentos de verificación alcanzado sin éxito.");
  return { process: 0, url: null };
};

/**
 * Procesa una factura individual.
 */
const processSingleInvoice = async (user, invoice, accessKey) => {
  const { networkid, userLaFactura, passLaFactura, urlMagaya } = user;
  const invoiceId = invoice.intId;

  const processingCacheKey = `processing_${invoiceId}`;
  if (cache.get(processingCacheKey)) {
    logger.warn(`⚠️ Factura ${invoiceId} ya en proceso. Ignorando.`);
    return;
  }
  cache.set(processingCacheKey, true);

  try {
    logger.info(`🚀 Iniciando procesamiento de factura ${invoiceId}`);

    await updateCustomField({
      networkId: networkid,
      accessKey,
      type: "IN",
      number: invoiceId,
      fieldInternalName: CUSTOM_FIELDS.ESTADO_FACTURA,
      fieldValue: INVOICE_STATUS.EN_PROCESO,
      urlMagaya,
    });

    let dataJson = cache.get(`transaction_${invoiceId}`);
    if (!dataJson) {
      logger.info(`🔎 Obteniendo datos de transacción para ${invoiceId}`);
      const transactionData = await getTransactionController({
        userLaFactura,
        passLaFactura,
        networkId: networkid,
        access_key: accessKey,
        type: "IN",
        flags: "45",
        transaction: invoiceId,
        urlMagaya,
      });

      if (!transactionData)
        throw new Error(`Sin datos de transacción para factura ${invoiceId}`);
      dataJson = JSON.parse(transactionData);
      cache.set(`transaction_${invoiceId}`, dataJson);
    }

    const sendResult = await sendInvoice(
      userLaFactura,
      passLaFactura,
      dataJson.data
    );
    const { code: statusCode, text: statusText } =
      sendResult.invoiceResult.status;

    const transaction = {
      intId: invoiceId,
      type: "IN",
      networkId: networkid,
      guid: invoice.guid,
      solicitudFactura:
        statusCode === 200
          ? INVOICE_STATUS.FACTURA_ELECTRONICA_EXITOSA
          : INVOICE_STATUS.PENDIENTE,
      estadoFactura:
        statusCode === 200
          ? INVOICE_STATUS.FACTURA_ELECTRONICA_EXITOSA
          : INVOICE_STATUS.ERROR_EN_FACTURA_ELECTRONICA,
    };

    // Actualizar campos y caché en paralelo
    await Promise.all([
      updateCustomField({
        networkId: networkid,
        accessKey,
        type: "IN",
        number: invoiceId,
        fieldInternalName: CUSTOM_FIELDS.INVOICE_MESSAGES,
        fieldValue: statusText,
        urlMagaya,
      }),
      (async () => {
        await updateCustomField({
          networkId: networkid,
          accessKey,
          type: "IN",
          number: invoiceId,
          fieldInternalName: CUSTOM_FIELDS.ESTADO_FACTURA,
          fieldValue: transaction.estadoFactura,
          urlMagaya,
        });
        await cacheTransactions([transaction]);
      })(),
      (async () => {
        await updateCustomField({
          networkId: networkid,
          accessKey,
          type: "IN",
          number: invoiceId,
          fieldInternalName: CUSTOM_FIELDS.SOLICITUD_FACTURA,
          fieldValue: transaction.solicitudFactura,
          urlMagaya,
        });
        await cacheTransactions([transaction]);
      })(),
    ]);

    if (statusCode !== 200) {
      logger.error(`❌ Error timbrando factura ${invoiceId}: ${statusText}`);
      cache.del(`transaction_${invoiceId}`);
      return;
    }

    const tasCode = sendResult.invoiceResult.documento.tascode;
    const cufe = sendResult.invoiceResult.documento.CUFE;

    await updateCustomField({
      networkId: networkid,
      accessKey,
      type: "IN",
      number: invoiceId,
      fieldInternalName: CUSTOM_FIELDS.TAS_CODE,
      fieldValue: tasCode,
      urlMagaya,
    });

    await updateCustomField({
      networkId: networkid,
      accessKey,
      type: "IN",
      number: invoiceId,
      fieldInternalName: CUSTOM_FIELDS.VALOR_CUFE,
      fieldValue: cufe,
      urlMagaya,
    });

    const { process, url } = await retryVerifyStatus(
      tasCode,
      userLaFactura,
      passLaFactura
    );

    if (process === 2) {
      await attachInvoice(
        { networkId: networkid, accessKey, number: invoiceId, urlMagaya },
        url
      );
      logger.info(`📎 Factura ${invoiceId} adjuntada correctamente.`);
    } else {
      logger.warn(
        `⚠️ No se pudo adjuntar la factura ${invoiceId} tras reintentos.`
      );
    }

    cache.del(`transaction_${invoiceId}`);
  } catch (error) {
    logger.error(`❌ Error procesando factura ${invoiceId}: ${error.message}`);
  } finally {
    cache.del(processingCacheKey);
  }
};

/**
 * Procesa todas las facturas activas por usuario.
 */
const processInvoiceController = async () => {
  try {
    const activeUsers = await activeUsersController();

    for (const [magaya_user, user] of activeUsers.entries()) {
      const { networkid, access_key, urlMagaya } = user;
      const cacheKey = `invoices_${magaya_user}`;

      logger.info(`👤 Procesando facturas para ${magaya_user}`);

      let result = cache.get(cacheKey);
      if (!result) {
        result = await processInvoices(
          networkid,
          access_key,
          "IsSolicitudCol",
          urlMagaya
        );

        if (!result) {
          logger.error(`❌ Error obteniendo facturas para ${magaya_user}`);
          continue;
        }

        if (!Array.isArray(result)) result = [result];
        if (result.length === 0) {
          logger.info(`📭 No hay facturas para procesar de ${magaya_user}`);
          continue;
        }

        cache.set(cacheKey, result);
      }

      for (const invoice of result) {
        try {
          await processSingleInvoice(user, invoice, access_key);
        } catch (err) {
          logger.error(
            `❌ Error al procesar factura ${invoice.intId}: ${err.message}`
          );
        }
      }

      cache.del(cacheKey);
      activeUsers.clear();
      logger.info(`🗑️ Facturas de ${magaya_user} eliminadas de caché.`);
    }
  } catch (error) {
    logger.error(`❌ Error procesando usuarios activos: ${error.message}`);
  }
};

module.exports = processInvoiceController;
