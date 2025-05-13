// creditNote/getCreditNoteController.js
/**
 * @file Controlador para procesar una Nota de Crédito desde Magaya y transformarla a formato de LaFactura.co.
 */

const getTransaction = require("../../services/magayaGetTransaction");
const parseXmlString = require("../../utils/parseXmlString");
const { validateObjectField } = require("../../utils/validateData");
const { formatDate, formatHour } = require("../../utils/formatDate");
const getCustomFieldValue = require("../../utils/getValueCustomField");
const numberToWords = require("../../utils/numbersToWord");
const getRanges = require("../../services/getRanges");
const logger = require("../../utils/logger");

/**
 * Procesa la información de una nota de crédito obtenida desde Magaya.
 *
 * @param {Object} data - Datos de conexión y autenticación necesarios.
 * @returns {Promise<Object>} - Nota de Crédito formateada o errores.
 */
const getCreditNoteController = async (data) => {
  const errors = [];
  try {
    const prefixResult = await getRanges(
      data.userLaFactura,
      data.passLaFactura,
      {
        getRanges: { mode: "active", type: "all" },
      }
    );

    let rangePrefix = prefixResult.generalResult.ranges;
    if (!Array.isArray(rangePrefix)) rangePrefix = [rangePrefix];

    let prefix = "";
    for (const range of rangePrefix) {
      if (range.type === "creditNote") {
        prefix = range.prefix;
        break;
      }
    }

    const response = await getTransaction(data);
    const jsonResult = await parseXmlString(response.transXmlContext);

    if (!jsonResult) {
      errors.push({
        Error: "Error al parsear",
        Mensaje: "No se encontró resultado para parsear",
      });
      return { errors };
    }

    const creditNote = jsonResult.CreditMemo;

    validateCreditNoteFields(creditNote, errors);

    const { discrepancyCode, note2, tasCode } = extractCustomFields(
      creditNote.CustomFields.CustomField,
      errors
    );

    const creditNoteObj = await buildCreditNoteObject(
      creditNote,
      prefix,
      discrepancyCode,
      note2,
      tasCode,
      errors
    );

    return JSON.stringify(
      { data: creditNoteObj, errors: errors.length > 0 ? errors : null },
      null,
      2
    );
  } catch (error) {
    logger.error("❌ Error al procesar la nota de crédito:", error.message);
    return {
      errors: [{ Error: "Excepción capturada", Mensaje: error.message }],
    };
  }
};

/**
 * Valida los campos obligatorios en la nota de crédito.
 */
const validateCreditNoteFields = (creditNote, errors) => {
  try {
    validateObjectField(
      creditNote,
      [
        "Number",
        "TotalAmountInCurrency._",
        "TotalAmountInCurrency.Currency",
        "Charges.Charge",
      ],
      "CreditNote"
    );
  } catch (validationError) {
    errors.push({
      Error: "Validación fallida",
      Detalles: validationError.message,
    });
  }
};

/**
 * Extrae campos personalizados de una nota de crédito.
 */
const extractCustomFields = (customFields, errors) => {
  const discrepancyCodeCustom = getCustomFieldValue(
    customFields,
    "discrepancycode"
  );
  if (!discrepancyCodeCustom)
    errors.push({
      Campo: "discrepancycode",
      Mensaje: "Campo no encontrado o vacío",
    });

  const note2 = getCustomFieldValue(customFields, "note2");
  if (!note2)
    errors.push({ Campo: "note2", Mensaje: "Campo no encontrado o vacío" });

  const tasCode = getCustomFieldValue(customFields, "tas_code_factura");
  if (!tasCode)
    errors.push({
      Campo: "tas_code_factura",
      Mensaje: "Campo no encontrado o vacío",
    });

  return {
    discrepancyCode: discrepancyCodeCustom?.substring(0, 2).trim(),
    note2,
    tasCode,
  };
};

/**
 * Construye el objeto final de la nota de crédito.
 */
const buildCreditNoteObject = async (
  creditNote,
  prefix,
  discrepancyCode,
  note2,
  tasCode,
  errors
) => {
  try {
    const intID = creditNote.Number;
    const dateMagaya = creditNote.CreatedOn;
    const issueDate = formatDate(dateMagaya);
    const issueTime = formatHour(dateMagaya);
    const totalAmount = creditNote.TotalAmountInCurrency._;
    const currency = creditNote.TotalAmountInCurrency.Currency;
    const note1 = numberToWords(totalAmount, currency);

    const totalAmountsObj = await totalAmounts(creditNote);
    const itemsDetailsObj = await itemsDetails(creditNote.Charges.Charge);
    const retentionObj = await retentionItemsTax(creditNote.Charges.Charge);

    const exchangeSystem = parseFloat(creditNote.Currency.ExchangeRate);
    const exchangeUser = parseFloat(creditNote.ExchangeRate);
    const rate =
      1 / (exchangeSystem === exchangeUser ? exchangeSystem : exchangeUser);

    return {
      creditNote: {
        prefix,
        tascode: tasCode,
        intID,
        issueDate,
        issueTime,
        discrepancyCode,
        note1,
        note2,
        amounts: totalAmountsObj,
        items: itemsDetailsObj,
        ...(retentionObj.length > 0 && { whTaxes: retentionObj }),
      },
    };
  } catch (error) {
    logger.error(
      `❌ Error construyendo el objeto de nota de crédito: ${error.message}`
    );
    throw error;
  }
};

const totalAmounts = async (creditNote) => {
  try {
    let amounts = {};

    let totalAmount = "0.00";

    let taxAmount = creditNote.TaxAmountInCurrency
      ? parseFloat(creditNote.TaxAmountInCurrency._)
      : 0.0;

    let retentionAmount = creditNote.RetentionAmountInCurrency
      ? parseFloat(creditNote.RetentionAmountInCurrency._)
      : 0.0;
    let prepaidAmount = 0.0;
    let discountAmount = 0.0;
    let extraAmount = 0.0;

    totalAmountWithoutTax = (
      parseFloat(
        creditNote.TotalAmountInCurrency
          ? creditNote.TotalAmountInCurrency._
          : 0.0
      ) - parseFloat(taxAmount)
    ).toFixed(2);

    totalAmount = (parseFloat(totalAmountWithoutTax) + retentionAmount).toFixed(
      2
    );

    let payAmount = (
      parseFloat(totalAmount) -
      parseFloat(discountAmount) +
      parseFloat(extraAmount) +
      parseFloat(taxAmount) +
      parseFloat(prepaidAmount)
    ).toFixed(2);

    amounts.totalAmount = totalAmount;
    amounts.discountAmount = discountAmount.toFixed(2);
    amounts.extraAmount = extraAmount.toFixed(2);
    amounts.taxAmount = taxAmount.toFixed(2);
    amounts.whTaxAmount = retentionAmount.toFixed(2);
    amounts.prepaidAmount = prepaidAmount.toFixed(2);
    amounts.payAmount = payAmount;

    return amounts;
  } catch (error) {
    logger.error(`Error al obtener totalAmount ${error.message}`);
    throw error;
  }
};

const itemsDetails = async (charges) => {
  if (!Array.isArray(charges)) charges = [charges];
  return Promise.all(
    charges.map(async (charge) => {
      const unitPriceDecimal = parseFloat(charge.PriceInCurrency._).toFixed(2);

      let taxCharge = "";
      if (!charge.TaxDefinition) {
        taxCharge = "0.00";
      } else if (charge.TaxDefinition.TaxDefinitions) {
        const typeTaxes = charge.TaxDefinition.TaxDefinitions.TaxDefinition;

        for (const type of typeTaxes) {
          if (type.Type === "Tax") {
            taxCharge = type.Rate;
          }
        }
      } else {
        taxCharge = charge.TaxDefinition.Rate;
      }

      return {
        quantity: charge.Quantity,
        unitPrice: unitPriceDecimal,
        total: charge.AmountInCurrency._,
        description: charge.ChargeDefinition.Description,
        brand: "LF",
        model: "Service",
        code: charge.ChargeDefinition.Code,
        taxes: [
          {
            ID: "01",
            taxAmount: charge.TaxAmountInCurrency?._ ?? "0.00",
            percent: taxCharge,
          },
        ],
      };
    })
  );
};

const retentionItemsTax = async (charges) => {
  if (!Array.isArray(charges)) charges = [charges];
  return Promise.all(
    charges.map(async (charge) => {
      if (!charge.RetentionAmountInCurrency) return null;

      const retentionTaxes =
        charge.TaxDefinition.TaxDefinitions.TaxDefinition.filter(
          (element) => element.Type === "Retention"
        );
      return retentionTaxes.map((element) => ({
        type: element.Name,
        percent: element.Rate,
        amount: charge.RetentionAmountInCurrency._,
      }));
    })
  ).then((results) => results.filter(Boolean).flat());
};

// Funciones auxiliares totalAmounts, itemsDetails, retentionItemsTax se mantienen como las tienes (puedes aplicar mismo patrón de validación si quieres).

module.exports = getCreditNoteController;
