// utils/formatDate.js
/**
 * @file Utilidades para formateo de fechas y horas en formatos requeridos por Magaya y LaFactura.co.
 */

/**
 * Formatea una fecha a formato `yyyyMMdd`.
 *
 * @param {string|Date} date - Fecha a formatear.
 * @returns {string|null} Fecha formateada o `null` si es inválida.
 */
const formatDate = (date) => {
  const dateNeed = new Date(date);

  if (isNaN(dateNeed.getTime())) {
    console.error(`❌ Fecha inválida recibida en formatDate: ${date}`);
    return null;
  }

  const yyyyMMdd =
    dateNeed.getFullYear().toString() +
    (dateNeed.getMonth() + 1).toString().padStart(2, "0") +
    dateNeed.getDate().toString().padStart(2, "0");

  return yyyyMMdd;
};

/**
 * Formatea una hora a formato `HHmmss`.
 *
 * @param {string|Date} hour - Hora a formatear.
 * @returns {string|null} Hora formateada o `null` si es inválida.
 */
const formatHour = (hour) => {
  const hourNeed = new Date(hour);

  if (isNaN(hourNeed.getTime())) {
    console.error(`❌ Hora inválida recibida en formatHour: ${hour}`);
    return null;
  }

  const hhmmss =
    hourNeed.getHours().toString().padStart(2, "0") +
    hourNeed.getMinutes().toString().padStart(2, "0") +
    hourNeed.getSeconds().toString().padStart(2, "0");

  return hhmmss;
};

module.exports = { formatDate, formatHour };
