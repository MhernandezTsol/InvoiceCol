// controllers/activeUsersController.js
/**
 * @file Controlador para gestionar usuarios activos y establecer sesiones con Magaya.
 * @description Obtiene usuarios desde base de datos, inicia sesión por usuario y almacena los usuarios activos en memoria.
 */

const selectUsers = require("../models/selectUsers");
const startSessionMagaya = require("../services/magayaAuthService");
const logger = require("../utils/logger");

const activeUsers = new Map();

/**
 * Inicializa sesiones activas de usuarios en Magaya.
 * @returns {Promise<Map>} Mapa de usuarios activos con sesión iniciada.
 */
const activeUsersController = async () => {
  try {
    const users = await selectUsers();
    logger.info(`🔍 Usuarios encontrados en base de datos: ${users.length}`);

    for (const user of users) {
      const { networkid, magaya_user, magaya_pass, urlMagaya } = user;

      if (activeUsers.has(magaya_user)) {
        logger.info(`✅ Usuario ${magaya_user} ya tiene una sesión activa.`);
        continue;
      }

      logger.info(`🔐 Iniciando sesión para usuario: ${magaya_user}`);

      try {
        const sessionResponse = await startSessionMagaya(
          networkid,
          magaya_user,
          magaya_pass,
          urlMagaya
        );

        if (sessionResponse?.returnContext !== "access_denied") {
          logger.info(`✅ Sesión iniciada exitosamente para ${magaya_user}`);
          user.access_key = sessionResponse.access_key;
          activeUsers.set(magaya_user, user);
        } else {
          logger.warn(`⚠️ Acceso denegado para usuario ${magaya_user}`);
        }
      } catch (error) {
        logger.error(
          `❌ Error al iniciar sesión para ${magaya_user}: ${error.message}`
        );
      }
    }

    return activeUsers;
  } catch (error) {
    logger.error(
      `❌ Error al obtener usuarios de la base de datos: ${error.message}`
    );
    return activeUsers; // Siempre retornar, aunque esté vacío
  }
};

module.exports = activeUsersController;
