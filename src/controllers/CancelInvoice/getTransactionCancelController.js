// cancel/getTransactionCancelController.js
/**
 * @file Controlador para obtener y preparar la información necesaria para cancelar una factura en Magaya.
 */

const getTransaction = require("../../services/magayaGetTransaction");
const parseXmlString = require("../../utils/parseXmlString");
const { validateObjectField } = require("../../utils/validateData");
const getCustomFieldValue = require("../../utils/getValueCustomField");
const logger = require("../../utils/logger"); // Agregamos logger

/**
 * Obtiene, valida y construye el objeto para cancelar una factura.
 *
 * @param {Object} data - Datos necesarios para consultar la transacción.
 * @returns {Promise<string>} - JSON con datos de cancelación y posibles errores.
 */
const getTransactionCancelController = async (data) => {
  const errors = [];

  try {
    const response = await getTransaction(data);
    const jsonResult = await parseXmlString(response.transXmlContext);

    if (!jsonResult) {
      errors.push({
        Error: "Error al parsear",
        Mensaje: "No se encontró resultado para parsear",
      });
      return { errors };
    }

    const invoice = jsonResult.Invoice;

    const existingNames = invoice.CustomFields.CustomField.map(
      (field) => field?.CustomFieldDefinition?.InternalName
    );
    logger.info(
      `🔍 Nombres internos de campos personalizados presentes: ${existingNames.join(
        ", "
      )}`
    );

    try {
      validateObjectField(
        invoice,
        [
          "Number",
          "Notes",
          {
            path: "CustomFields.CustomField",
            requiredNames: ["tas_code", "estado_factura", "description"],
          },
        ],
        "Invoice"
      );
    } catch (validationError) {
      errors.push({
        Error: "Validación fallida",
        Detalles: validationError.message,
      });
    }

    const customFields = invoice.CustomFields.CustomField;
    const tasCode = getCustomFieldValue(customFields, "tas_code");
    const description = getCustomFieldValue(customFields, "description");

    if (!tasCode) {
      errors.push({
        Campo: "tas_code",
        Mensaje: "Campo no encontrado o vacío",
      });
    }

    if (!description) {
      errors.push({
        Campo: "description",
        Mensaje: "Campo no encontrado o vacío",
      });
    }

    const invoiceObj = {
      deleteInvoice: {
        tascode: tasCode,
        description: description,
      },
    };

    return JSON.stringify(
      {
        data: invoiceObj,
        errors: errors.length > 0 ? errors : null,
      },
      null,
      2
    );
  } catch (error) {
    logger.error(
      `❌ Error al procesar la transacción de cancelación: ${error.message}`
    );
    return {
      errors: [
        {
          Error: "Excepción capturada",
          Mensaje: error.message,
        },
      ],
    };
  }
};

module.exports = getTransactionCancelController;
