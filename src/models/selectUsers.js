// models/selectUsers.js
/**
 * @file Servicio para obtener los usuarios activos de la base de datos.
 * @description Consulta los usuarios activos necesarios para inicializar sesiones de Magaya y facturación.
 */

const executeQuery = require("../utils/executeQuery");
const logger = require("../utils/logger");

/**
 * Selecciona los usuarios activos de la base de datos.
 *
 * @returns {Promise<Array>} Arreglo de usuarios activos.
 */
const selectUsers = async () => {
  try {
    const selectQuery = `
      SELECT 
        nombre, 
        contacto, 
        tel, 
        email,
        urlMagaya, 
        networkid, 
        magaya_user, 
        magaya_pass, 
        userLaFactura, 
        passLaFactura 
      FROM usuarios 
      WHERE activo = 1
    `;

    const users = await executeQuery(selectQuery);
    logger.info(`✅ Usuarios activos obtenidos: ${users.length}`);
    return users;
  } catch (error) {
    logger.error(`❌ Error al seleccionar los usuarios: ${error.message}`);
    throw error;
  }
};

module.exports = selectUsers;
