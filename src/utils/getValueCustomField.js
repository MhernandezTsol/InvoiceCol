// utils/getValueCustomField.js
/**
 * @file Utilidad para obtener el valor de un campo personalizado basado en su InternalName.
 */

/**
 * Obtiene el valor de un CustomField específico.
 *
 * @param {Array} customFields - Lista de objetos CustomField.
 * @param {string} internalName - InternalName del campo que deseas buscar.
 * @returns {string|null} - Valor del campo encontrado o `null` si no existe.
 */
function getCustomFieldValue(customFields, internalName) {
  if (!Array.isArray(customFields)) {
    console.error(`❌ customFields no es un arreglo válido.`);
    return null;
  }
  if (typeof internalName !== "string") {
    console.error(`❌ internalName debe ser un string.`);
    return null;
  }

  for (const field of customFields) {
    if (field.CustomFieldDefinition?.InternalName === internalName) {
      return field.Value ?? null;
    }
  }

  return null;
}

module.exports = getCustomFieldValue;
