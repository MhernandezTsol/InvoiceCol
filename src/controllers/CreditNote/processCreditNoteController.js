// creditNote/processCreditNoteController.js
/**
 * @file Controlador principal para el procesamiento de Notas de Crédito en Magaya y su integración con LaFactura.co.
 */

const NodeCache = require("node-cache");
const logger = require("../../utils/logger");

const activeUsersController = require("../activeUsersController");
const getAllCreditNoteToProcess = require("./processCreditNote");
const getCreditNoteController = require("./getCreditNoteController");
const sendCreditNote = require("./sendCreditNoteController");
const cacheCreditNote = require("../../models/cacheCreditNote");
const cacheTransactions = require("../../models/cacheDb");
const verifyInvoiceStatus = require("../verifyInvoiceStatusController");
const attachInvoice = require("../attachController");
const setCustomFieldValue = require("../../services/magayaSetCustomFieldValue");

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const CUSTOM_FIELDS = {
  ESTADO_NOTA_CREDITO: "estado_nota_credito",
  CREDIT_NOTE_MESSAGES: "credit_note_messages",
  SOLICITUD_NOTA_CREDITO: "solicitud_nota_credito",
  TAS_CODE: "tas_code_nota_credito",
  VALOR_CUFE: "cufe_nota_credito",
};

const CREDIT_NOTE_STATUS = {
  EN_PROCESO: "En Proceso",
  NOTA_CREDITO_EXITOSA: "Nota de Credito Exitosa",
  ERROR_EN_NOTA_CREDITO: "Error en Nota de Credito",
  PENDIENTE: "Pendiente",
};

/**
 * Controlador principal para procesar todas las notas de crédito pendientes.
 */
const processCreditNoteController = async () => {
  try {
    const activeUsers = await activeUsersController();

    for (const [magaya_user, user] of activeUsers.entries()) {
      const { networkid, access_key, urlMagaya } = user;
      logger.info(`🚀 Procesando notas de crédito para ${magaya_user}`);

      const functionSolicitud = "IsSolicitudCreditNoteCol";
      const cacheKey = `creditNotes_${magaya_user}`;
      let result = cache.get(cacheKey);

      if (!result) {
        logger.info(
          `📥 Obteniendo Notas de Crédito para el usuario ${magaya_user}...`
        );
        result = await getAllCreditNoteToProcess(
          networkid,
          access_key,
          functionSolicitud,
          urlMagaya
        );

        if (!result || !Array.isArray(result)) {
          logger.error(`❌ Error al obtener el listado para ${magaya_user}`);
          continue;
        }

        if (result.length === 0) {
          logger.info("📭 No hay notas de crédito para procesar.");
          continue;
        }

        cache.set(cacheKey, result);
        logger.info(
          `✅ Notas de crédito almacenadas en caché para ${magaya_user}`
        );
      }

      for (const creditNote of result) {
        try {
          await processSingleCreditNote(
            user,
            creditNote,
            access_key,
            urlMagaya
          );
        } catch (err) {
          logger.error(
            `❌ Error al procesar nota de crédito ${creditNote.intId}: ${err.message}`
          );
        }
      }

      cache.del(cacheKey);
      activeUsers.clear();
      logger.info(
        `🗑️ Notas de crédito eliminadas de la caché para ${magaya_user}`
      );
    }
  } catch (err) {
    logger.error(`❌ Error procesando usuarios activos: ${err.message}`);
  }
};

/**
 * Procesa una única nota de crédito: envía, actualiza campos y adjunta XML.
 */
const processSingleCreditNote = async (
  user,
  creditNote,
  accessKey,
  urlMagaya
) => {
  const { networkid, userLaFactura, passLaFactura } = user;
  const creditNoteId = creditNote.intId;

  const processingCacheKey = `processing_${creditNoteId}`;
  if (cache.get(processingCacheKey)) {
    logger.info(
      `ℹ️ La nota de crédito ${creditNoteId} ya está siendo procesada.`
    );
    return;
  }
  cache.set(processingCacheKey, true);

  try {
    logger.info(
      `⚙️ Iniciando procesamiento de nota de crédito ${creditNoteId}`
    );

    await updateCustomField({
      networkId: networkid,
      accessKey,
      type: "IN",
      number: creditNoteId,
      fieldInternalName: CUSTOM_FIELDS.ESTADO_NOTA_CREDITO,
      fieldValue: CREDIT_NOTE_STATUS.EN_PROCESO,
      urlMagaya,
    });

    const transactionCacheKey = `transaction_${creditNoteId}`;
    let dataJson = cache.get(transactionCacheKey);

    if (!dataJson) {
      logger.info(
        `📦 Obteniendo datos de transacción para la nota de crédito ${creditNoteId}...`
      );
      const transactionData = await getCreditNoteController({
        userLaFactura,
        passLaFactura,
        networkId: networkid,
        access_key: accessKey,
        type: "IN",
        flags: "45",
        transaction: creditNoteId,
        urlMagaya,
      });

      if (!transactionData) {
        throw new Error(
          `No se pudieron obtener los datos para la nota de crédito ${creditNoteId}`
        );
      }

      dataJson = JSON.parse(transactionData);
      cache.set(transactionCacheKey, dataJson);
    }

    logger.info(
      `📄 Datos de transacción para la nota de crédito ${creditNoteId}: ${JSON.stringify(
        dataJson.data,
        null,
        2
      )}`
    );

    const sendResult = await sendCreditNote(
      userLaFactura,
      passLaFactura,
      dataJson.data
    );
    const { code: statusCode, text: statusText } =
      sendResult.invoiceResult.status;

    const transaction = {
      intId: creditNoteId,
      type: "IN",
      networkId: networkid,
      guid: creditNote.guid,
      solicitudNotaCredito:
        statusCode === 200 ? "Nota de Credito Exitosa" : "Pendiente",
      estadoNotaCredito:
        statusCode === 200
          ? "Nota de Credito Exitosa"
          : "Error en Nota de Credito",
    };

    await Promise.all([
      updateCustomField({
        networkId: networkid,
        accessKey,
        type: "IN",
        number: creditNoteId,
        fieldInternalName: CUSTOM_FIELDS.CREDIT_NOTE_MESSAGES,
        fieldValue: statusText,
        urlMagaya,
      }),
      updateCustomField({
        networkId: networkid,
        accessKey,
        type: "IN",
        number: creditNoteId,
        fieldInternalName: CUSTOM_FIELDS.ESTADO_NOTA_CREDITO,
        fieldValue:
          statusCode === 200
            ? CREDIT_NOTE_STATUS.NOTA_CREDITO_EXITOSA
            : CREDIT_NOTE_STATUS.ERROR_EN_NOTA_CREDITO,
        urlMagaya,
      }),
      updateCustomField({
        networkId: networkid,
        accessKey,
        type: "IN",
        number: creditNoteId,
        fieldInternalName: CUSTOM_FIELDS.SOLICITUD_NOTA_CREDITO,
        fieldValue:
          statusCode === 200
            ? CREDIT_NOTE_STATUS.NOTA_CREDITO_EXITOSA
            : CREDIT_NOTE_STATUS.PENDIENTE,
        urlMagaya,
      }),
    ]);

    await cacheCreditNote([transaction]);
    await cacheTransactions([transaction]);

    if (statusCode !== 200) {
      logger.error(
        `❌ Error emitiendo nota de crédito ${creditNoteId}: ${statusText}`
      );
      cache.del(transactionCacheKey);
      return;
    }

    const tasCode = sendResult.invoiceResult.documento.tascode;
    const cude = sendResult.invoiceResult.documento.CUDE;

    await updateCustomField({
      networkId: networkid,
      accessKey,
      type: "IN",
      number: creditNoteId,
      fieldInternalName: CUSTOM_FIELDS.TAS_CODE,
      fieldValue: tasCode,
      urlMagaya,
    });

    await updateCustomField({
      networkId: networkid,
      accessKey,
      type: "IN",
      number: creditNoteId,
      fieldInternalName: CUSTOM_FIELDS.VALOR_CUFE,
      fieldValue: cude,
      urlMagaya,
    });

    const dataStatus = { verifyStatus: { tascode: tasCode } };
    let statusResult = await verifyInvoiceStatus(
      userLaFactura,
      passLaFactura,
      dataStatus
    );
    let { URL: url, process } = statusResult.invoiceResult.document;

    let attempts = 0;
    while (process === 0 && attempts < 10) {
      logger.info(
        `🕰️ Esperando 15 segundos para verificar estado de la nota de crédito ${creditNoteId}...`
      );
      await new Promise((resolve) => setTimeout(resolve, 15000));

      statusResult = await verifyInvoiceStatus(
        userLaFactura,
        passLaFactura,
        dataStatus
      );
      ({ URL: url, process } = statusResult.invoiceResult.document);
      attempts++;
    }

    if (process === 2) {
      await attachInvoice(
        { networkId: networkid, accessKey, number: creditNoteId, urlMagaya },
        url
      );
      logger.info(
        `✅ Nota de crédito ${creditNoteId} adjuntada correctamente.`
      );
    } else {
      logger.warn(
        `⚠️ No se pudo adjuntar la nota de crédito ${creditNoteId} después de varios intentos.`
      );
    }

    cache.del(transactionCacheKey);
  } catch (error) {
    logger.error(
      `❌ Error procesando nota de crédito ${creditNoteId}: ${error.message}`
    );
  } finally {
    cache.del(processingCacheKey);
  }
};

/**
 * Actualiza un campo personalizado en Magaya.
 */
const updateCustomField = async (data) => {
  try {
    const response = await setCustomFieldValue(data);
    logger.info(
      `🔧 Actualización exitosa para el campo: ${data.fieldInternalName}`
    );
    return response;
  } catch (error) {
    logger.error(
      `❌ Error actualizando campo: ${data.fieldInternalName} - ${error.message}`
    );
    throw error;
  }
};

module.exports = processCreditNoteController;
