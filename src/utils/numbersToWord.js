// utils/numbersToWord.js
/**
 * @file Utilidad para convertir un número en palabras en español para facturación electrónica (mercado colombiano).
 */

/**
 * Convierte un número a su representación textual en español.
 *
 * @param {number|string} num - Número a convertir (puede ser string numérico).
 * @param {string} currency - Moneda a añadir al final (ej. "PESOS").
 * @returns {string} Representación en palabras del número con moneda.
 */
function numberToWords(num, currency) {
  const units = [
    "",
    "uno",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
  ];
  const teens = [
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
    "dieciséis",
    "diecisiete",
    "dieciocho",
    "diecinueve",
  ];
  const tens = [
    "",
    "",
    "veinte",
    "treinta",
    "cuarenta",
    "cincuenta",
    "sesenta",
    "setenta",
    "ochenta",
    "noventa",
  ];
  const hundreds = [
    "",
    "cien",
    "doscientos",
    "trescientos",
    "cuatrocientos",
    "quinientos",
    "seiscientos",
    "setecientos",
    "ochocientos",
    "novecientos",
  ];

  function convert(num) {
    if (num === 0) return "cero";
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    if (num < 100)
      return (
        tens[Math.floor(num / 10)] + (num % 10 ? " y " + units[num % 10] : "")
      );
    if (num < 1000)
      return (
        hundreds[Math.floor(num / 100)] +
        (num % 100 ? " " + convert(num % 100) : "")
      );
    if (num < 1000000) {
      const thousands = Math.floor(num / 1000);
      const remainder = num % 1000;
      return (
        (thousands === 1 ? "mil" : convert(thousands) + " mil") +
        (remainder ? " " + convert(remainder) : "")
      );
    }
    if (num < 1000000000) {
      const millions = Math.floor(num / 1000000);
      const remainder = num % 1000000;
      return (
        (millions === 1 ? "un millón" : convert(millions) + " millones") +
        (remainder ? " " + convert(remainder) : "")
      );
    }
    return "Cantidad no soportada";
  }

  // Intentar convertir a número si es string
  if (typeof num === "string") {
    num = num.replace(/,/g, ""); // Eliminar comas si vienen tipo "1,234.56"
    num = parseFloat(num);
  }

  if (typeof num !== "number" || isNaN(num)) {
    console.error(`❌ Valor inválido recibido en numberToWords: ${num}`);
    return `Valor inválido ${currency}`;
  }

  let integerPart = Math.floor(num);
  let decimalPart = Math.round((num - integerPart) * 100);

  let integerWords = convert(integerPart);
  let decimalWords =
    decimalPart > 0
      ? "con " + decimalPart.toString().padStart(2, "0") + "/100"
      : "";

  return `${integerWords} ${decimalWords} ${currency}`.trim();
}

module.exports = numberToWords;
