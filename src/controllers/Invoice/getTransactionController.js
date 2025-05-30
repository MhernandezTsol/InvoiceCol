// controllers/Invoice/getTransactionController.js
/**
 * @file Controlador para obtener, validar y transformar transacciones de Magaya a JSON para LaFactura.co
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
 * Redondeo tipo bancario (Half Even)
 */
function roundBankers(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  const n = value * factor;
  const fractional = n - Math.floor(n);
  const isEven = Math.floor(n) % 2 === 0;

  if (fractional === 0.5) {
    return (isEven ? Math.floor(n) : Math.ceil(n)) / factor;
  }
  return Math.round(n) / factor;
}

/**
 * Controlador principal para obtener una transacción y transformarla
 */
const getTransactionController = async (data) => {
  const errors = [];
  try {
    const prefixResult = await getRanges(
      data.userLaFactura,
      data.passLaFactura,
      { getRanges: { mode: "active", type: "all" } }
    );

    const rangePrefix = Array.isArray(prefixResult.generalResult.ranges)
      ? prefixResult.generalResult.ranges
      : [prefixResult.generalResult.ranges];

    const prefix = rangePrefix.find((r) => r.type === "invoice")?.prefix || "";

    const response = await getTransaction(data);
    const jsonResult = await parseXmlString(response.transXmlContext);

    if (!jsonResult) {
      return {
        errors: [{ Error: "Parseo fallido", Mensaje: "Sin resultados" }],
      };
    }

    const invoice = jsonResult.Invoice;
    validateInvoiceFields(invoice, errors);

    const { paymentCode, paymentType } = extractCustomFields(
      invoice.CustomFields.CustomField,
      errors
    );

    const invoiceObj = await buildInvoiceObject(
      invoice,
      prefix,
      paymentCode,
      paymentType,
      errors
    );
    console.log(
      JSON.stringify(
        { data: invoiceObj, errors: errors.length > 0 ? errors : null },
        null,
        2
      )
    );
    return {
      data: invoiceObj,
      errors: errors.length > 0 ? errors : null,
    };
  } catch (error) {
    logger.error(`❌ Error al procesar transacción: ${error.message}`);
    return {
      errors: [{ Error: "Excepción capturada", Mensaje: error.message }],
    };
  }
};

/**
 * Valida los campos esenciales de una factura
 */
const validateInvoiceFields = (invoice, errors) => {
  try {
    validateObjectField(
      invoice,
      [
        "Number",
        "CreatedOn",
        "TotalAmountInCurrency._",
        "TotalAmountInCurrency.Currency",
        "Entity.Name",
        "Entity.Address.Country._",
        "Entity.Address.City",
        "Entity.EntityID",
        "Entity.Email",
        "Charges.Charge",
        {
          path: "CustomFields.CustomField",
          requiredNames: ["paymentcode", "paymenttype"],
        },
      ],
      "Invoice"
    );
  } catch (err) {
    errors.push({ Error: "Validación fallida", Detalles: err.message });
  }
};

/**
 * Extrae campos personalizados paymentcode y paymenttype
 */
const extractCustomFields = (customFields, errors) => {
  const paymentCodeCustom = getCustomFieldValue(customFields, "paymentcode");
  const paymentTypeCustom = getCustomFieldValue(customFields, "paymenttype");

  if (!paymentCodeCustom)
    errors.push({
      Campo: "paymentcode",
      Mensaje: "Campo no encontrado o vacío",
    });

  if (!paymentTypeCustom)
    errors.push({
      Campo: "paymenttype",
      Mensaje: "Campo no encontrado o vacío",
    });

  return {
    paymentCode: paymentCodeCustom?.substring(0, 2).trim(),
    paymentType: paymentTypeCustom?.substring(0, 2).trim(),
  };
};

/**
 * Construye el objeto JSON de la factura
 */
const buildInvoiceObject = async (
  invoice,
  prefix,
  paymentCode,
  paymentType,
  errors
) => {
  const intID = invoice.Number;
  const dateMagaya = invoice.CreatedOn;
  const issueDate = formatDate(dateMagaya);
  const issueTime = formatHour(dateMagaya);
  const totalAmount = invoice.TotalAmountInCurrency._;
  const currency = invoice.TotalAmountInCurrency.Currency;
  const note1 = numberToWords(totalAmount, currency);

  const customerInfoObj = await getCustomerInfo(errors, invoice.Entity);
  const totalAmountsObj = await totalAmounts(invoice);
  const itemsDetailsObj = await itemDetails(invoice.Charges.Charge);
  const retentionObj = await retentionItemsTax(invoice.Charges.Charge);

  const exchangeSystem = parseFloat(invoice.Currency.ExchangeRate);
  const exchangeUser = parseFloat(invoice.ExchangeRate);
  const rate =
    1 / (exchangeSystem === exchangeUser ? exchangeSystem : exchangeUser);

  const exchangeRate = {
    currencyCode: invoice.Currency.Code,
    currencyRate: roundBankers(rate).toFixed(2),
    currencyDate: issueDate,
  };

  return {
    invoice: {
      prefix,
      intID,
      issueDate,
      issueTime,
      paymentType,
      paymentCode,
      note1,
      customer: customerInfoObj,
      amounts: totalAmountsObj,
      ...(customerInfoObj.countryCode !== "CO" && { exchangeRate }),
      items: itemsDetailsObj,
      ...(retentionObj.length > 0 && { whTaxes: retentionObj }),
    },
  };
};

/**
 * Extrae la información del cliente
 */
const getCustomerInfo = (errors, dataCustomer) => {
  const customFieldEntity = dataCustomer?.CustomFields?.CustomField;

  const getOrError = (condition, message) => {
    if (!condition) errors.push(message);
    return condition;
  };

  const additionalAccountID = getCustomFieldValue(
    customFieldEntity,
    "additionalaccountid"
  );
  const documentType = getCustomFieldValue(customFieldEntity, "documenttype");
  const email = getCustomFieldValue(customFieldEntity, "correo_facturacion");

  return {
    additionalAccountID: getOrError(
      additionalAccountID,
      "Falta el campo adicional: additionalaccountid"
    )?.charAt(0),
    name: getOrError(dataCustomer?.Name, "Falta el campo: Name"),
    countryName: getOrError(
      dataCustomer?.Address?.Country?._,
      "Falta el campo: Address.Country._"
    ),
    countryCode: getOrError(
      dataCustomer?.Address?.Country?.Code,
      "Falta el campo: Address.Country.Code"
    ),
    city: getOrError(
      dataCustomer?.Address?.City,
      "Falta el campo: Address.City"
    ),
    countrySubentity: getOrError(
      dataCustomer?.Address?.ZipCode,
      "Falta el campo: Address.ZipCode"
    ),
    addressLine: getOrError(
      dataCustomer?.Address?.Street,
      "Falta el campo: Address.Street"
    )
      ? Array.isArray(dataCustomer.Address.Street)
        ? dataCustomer.Address.Street.join(" ")
        : dataCustomer.Address.Street
      : "",
    documentNumber: getOrError(
      dataCustomer?.EntityID,
      "Falta el campo: EntityID"
    ),
    documentType: getOrError(
      documentType,
      "Falta el campo adicional: documenttype"
    )
      ?.substring(0, 2)
      .trim(),
    telephone: getOrError(dataCustomer?.Phone, "Falta el campo: Phone"),
    email: getOrError(email, "Falta el campo adicional: correo_facturacion"),
    internalID: getOrError(dataCustomer?.GUID, "Falta el campo: GUID"),
  };
};

/**
 * Calcula los montos totales de la factura
 */
const totalAmounts = (invoice) => {
  const taxAmount = invoice.TaxAmountInCurrency
    ? roundBankers(parseFloat(invoice.TaxAmountInCurrency._))
    : 0.0;
  const retentionAmount = invoice.RetentionAmountInCurrency
    ? roundBankers(parseFloat(invoice.RetentionAmountInCurrency._))
    : 0.0;
  const totalInvoice = invoice.TotalAmountInCurrency
    ? roundBankers(parseFloat(invoice.TotalAmountInCurrency._))
    : 0.0;

  const totalAmountWithoutTax = roundBankers(totalInvoice - taxAmount);
  const totalAmount = roundBankers(totalAmountWithoutTax + retentionAmount);

  const discountAmount = 0.0;
  const extraAmount = 0.0;
  const prepaidAmount = 0.0;

  const payAmount = roundBankers(
    totalAmount - discountAmount + extraAmount + taxAmount + prepaidAmount
  );

  return {
    totalAmount: totalAmount.toFixed(2),
    discountAmount: roundBankers(discountAmount).toFixed(2),
    extraAmount: roundBankers(extraAmount).toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    whTaxAmount: retentionAmount.toFixed(2),
    prepaidAmount: roundBankers(prepaidAmount).toFixed(2),
    payAmount: payAmount.toFixed(2),
  };
};

/**
 * Extrae detalles de los items facturados
 */
const itemDetails = (charges) => {
  if (!Array.isArray(charges)) charges = [charges];
  return charges.map((charge) => {
    const unitPriceDecimal = roundBankers(
      parseFloat(charge.PriceInCurrency._)
    ).toFixed(2);
    const totalDecimal = roundBankers(
      parseFloat(charge.AmountInCurrency._)
    ).toFixed(2);

    let taxCharge = "0.00";
    if (charge.TaxDefinition?.TaxDefinitions) {
      const typeTaxes = charge.TaxDefinition.TaxDefinitions.TaxDefinition;
      for (const type of typeTaxes) {
        if (type.Type === "Tax") taxCharge = type.Rate;
      }
    } else if (charge.TaxDefinition) {
      taxCharge = charge.TaxDefinition.Rate;
    }

    const taxAmount = charge.TaxAmountInCurrency?._
      ? roundBankers(parseFloat(charge.TaxAmountInCurrency._)).toFixed(2)
      : "0.00";

    return {
      quantity: charge.Quantity,
      unitPrice: unitPriceDecimal,
      total: totalDecimal,
      description: charge.ChargeDefinition.Description,
      brand: "LF",
      model: "Service",
      code: charge.ChargeDefinition.Code,
      taxes: [{ ID: "01", taxAmount, percent: taxCharge }],
    };
  });
};

/**
 * Extrae retenciones aplicadas
 */
const retentionItemsTax = (charges) => {
  if (!Array.isArray(charges)) charges = [charges];
  return charges.flatMap((charge) => {
    if (!charge.RetentionAmountInCurrency) return [];
    const retentionTaxes =
      charge.TaxDefinition.TaxDefinitions.TaxDefinition.filter(
        (t) => t.Type === "Retention"
      );
    return retentionTaxes.map((element) => ({
      type: element.Name,
      percent: element.Rate,
      amount: charge.RetentionAmountInCurrency._,
    }));
  });
};

module.exports = getTransactionController;
