// cancel/processCancelInvoiceController.js
/**
 * @file Controlador para procesar la cancelación de facturas en Magaya y LaFactura.co.
 */

const processInvoiceCancel = require("./processCancel");
const activeUsersController = require("../activeUsersController");
const sendInvoiceCancelController = require("./sendInvoiceCancelController");
const getTransactionCancelController = require("./getTransactionCancelController");
const setCustomFieldValue = require("../../services/magayaSetCustomFieldValue");
const statusInvoice = require("../verifyInvoiceStatusController");
const updateCancelledTransaction = require("../../models/updateCancel");
const logger = require("../../utils/logger");

/**
 * Función auxiliar para esperar un tiempo.
 * @param {number} ms - Milisegundos a esperar.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Actualiza un campo personalizado de Magaya.
 */
const updateCustomField = async (data) => {
  try {
    const response = await setCustomFieldValue(data);
    logger.info(
      `🔧 Actualización exitosa del campo: ${data.fieldInternalName}`
    );
    return response;
  } catch (error) {
    logger.error(
      `❌ Error actualizando campo ${data.fieldInternalName}: ${error.message}`
    );
    throw error;
  }
};

/**
 * Actualiza múltiples campos de una factura relacionada con su estado de cancelación.
 */
const updateInvoiceFields = async (
  invoiceStatus,
  user,
  invoiceId,
  resultSend,
  urlMagaya
) => {
  const { networkid, access_key, magaya_user } = user;
  const { code: statusCode, text: statusText } = invoiceStatus;

  const customFields = [
    {
      fieldInternalName: "avisos_cancelaciones",
      fieldValue: statusText,
    },
    {
      fieldInternalName: "estado_factura",
      fieldValue: statusCode === 200 ? "Cancelado" : "Error de Cancelación",
    },
    {
      fieldInternalName: "solicitud_factura",
      fieldValue: statusCode === 200 ? "Cancelado" : "Pendiente",
    },
  ];

  await Promise.all(
    customFields.map((field) =>
      setCustomFieldValue({
        networkId: networkid,
        accessKey: access_key,
        type: "IN",
        number: invoiceId,
        ...field,
        urlMagaya,
      })
    )
  );

  if (statusCode === 200 && resultSend.invoiceResult.documento?.tascode) {
    await setCustomFieldValue({
      networkId: networkid,
      accessKey: access_key,
      type: "IN",
      number: invoiceId,
      fieldInternalName: "tas_cancel",
      fieldValue: resultSend.invoiceResult.documento.tascode,
      urlMagaya,
    });
  }

  logger.info(
    `✅ Factura ${invoiceId} del usuario ${magaya_user} actualizada con resultado de cancelación.`
  );
};

/**
 * Procesa la cancelación de una sola factura.
 */
const processSingleInvoiceCancel = async (user, invoice, accessKey) => {
  const { networkid, userLaFactura, passLaFactura, magaya_user, urlMagaya } =
    user;
  const invoiceId = invoice.intId;

  try {
    logger.info(
      `⚙️ Iniciando cancelación de factura ${invoiceId} del usuario ${magaya_user}`
    );

    await updateCustomField({
      networkId: networkid,
      accessKey,
      type: "IN",
      number: invoiceId,
      fieldInternalName: "solicitud_factura",
      fieldValue: "En Proceso de Cancelación",
      urlMagaya,
    });

    const transactionData = await getTransactionCancelController({
      networkId: networkid,
      access_key: accessKey,
      type: "IN",
      flags: "45",
      transaction: invoiceId,
      urlMagaya,
    });

    const dataJson = JSON.parse(transactionData);

    const sendResult = await sendInvoiceCancelController(
      userLaFactura,
      passLaFactura,
      dataJson.data
    );

    if (!sendResult?.invoiceResult?.status) {
      throw new Error("Respuesta inválida al cancelar factura");
    }

    await updateInvoiceFields(
      sendResult.invoiceResult.status,
      user,
      invoiceId,
      sendResult,
      urlMagaya
    );

    if (sendResult.invoiceResult.status.code !== 200) {
      logger.error(
        `❌ Error cancelando factura ${invoiceId} del usuario ${magaya_user}: ${sendResult.invoiceResult.status.text}`
      );
      return;
    }

    const tasCode = sendResult.invoiceResult.documento.tascode;

    let retries = 0;
    const maxRetries = 5;
    let process = 0;

    do {
      logger.info(
        `⏳ Verificando estado de cancelación para factura ${invoiceId} del usuario ${magaya_user}... intento ${
          retries + 1
        }`
      );
      await delay(5000);
      const statusResult = await statusInvoice(userLaFactura, passLaFactura, {
        verifyStatus: { tascode: tasCode },
      });
      process = statusResult?.invoiceResult?.document?.process ?? 0;
      retries++;
    } while (process === 0 && retries < maxRetries);

    if (process === 0) {
      throw new Error(
        `Tiempo excedido verificando cancelación de factura ${invoiceId}`
      );
    }

    logger.info(
      `✅ Cancelación confirmada para factura ${invoiceId} del usuario ${magaya_user}`
    );

    await updateCancelledTransaction({
      solicitudFactura: "Cancelado",
      intId: invoiceId,
    });
  } catch (error) {
    logger.error(
      `❌ Error procesando cancelación de factura ${invoiceId} del usuario ${magaya_user}: ${error.message}`
    );
    throw error;
  }
};

/**
 * Controlador principal para procesar la cancelación de todas las facturas.
 */
const processCancelInvoiceController = async () => {
  try {
    const activeUsers = await activeUsersController();

    for (const user of activeUsers.values()) {
      const { networkid, access_key, magaya_user, urlMagaya } = user;

      logger.info(
        `🚀 Procesando facturas para cancelar del usuario ${magaya_user}`
      );

      const functionCancel = "IsCancelacionCol";

      let result = await processInvoiceCancel(
        networkid,
        access_key,
        functionCancel,
        urlMagaya
      );

      if (!result) {
        logger.error(
          `❌ Error al obtener listado para cancelar facturas del usuario ${magaya_user}`
        );
        continue;
      }

      if (!Array.isArray(result)) result = [result];
      if (result.length === 0) {
        logger.info(
          `📭 No hay facturas para cancelar del usuario ${magaya_user}`
        );
        continue;
      }

      for (const invoice of result) {
        try {
          await processSingleInvoiceCancel(
            user,
            invoice,
            access_key,
            urlMagaya
          );
        } catch (err) {
          logger.error(
            `❌ Error al procesar factura ${invoice.intId} del usuario ${magaya_user}: ${err.message}`
          );
        }
      }

      // Limpiar el usuario una vez procesadas todas sus facturas
      activeUsers.delete(magaya_user);
      logger.info(
        `🧹 Usuario ${magaya_user} removido de usuarios activos después de cancelar sus facturas.`
      );
    }
  } catch (error) {
    logger.error(`❌ Error procesando usuarios activos: ${error.message}`);
    throw error;
  }
};

module.exports = processCancelInvoiceController;
