// controllers/startSessionController.js
/**
 * @file Controlador para iniciar sesión de usuarios activos en Magaya.
 * @description Selecciona usuarios de la base de datos y establece sesión individualmente usando magayaAuthService.
 */

const startSession = require("../services/magayaAuthService");
const selectUsers = require("../models/selectUsers");
const logger = require("../utils/logger");

const activeUsers = new Map();

const startSessionController = async () => {
  try {
    const users = await selectUsers();
    logger.info(`🔍 Usuarios a procesar: ${users.length}`);

    const userPromises = users.map(async (user) => {
      const { networkid, magaya_user, magaya_pass, urlMagaya } = user;

      if (activeUsers.has(magaya_user)) {
        logger.warn(`⚠️ El usuario ${magaya_user} ya está siendo procesado`);
        return { ...user, mensaje: "Usuario ya procesado" };
      }

      activeUsers.set(magaya_user, true);

      try {
        logger.info(`🔐 Iniciando sesión para el usuario ${magaya_user}...`);

        const sessionResponse = await startSession(
          networkid,
          magaya_user,
          magaya_pass,
          urlMagaya
        );

        if (sessionResponse && sessionResponse.error) {
          logger.error(
            `❌ Error al iniciar sesión: ${sessionResponse.message}`
          );
          return {
            ...user,
            error: sessionResponse.error,
            mensaje: sessionResponse.message,
          };
        }

        logger.info(
          `✅ Sesión iniciada para ${networkid} con access_key: ${sessionResponse.access_key}`
        );

        return { ...user, access_key: sessionResponse.access_key };
      } catch (error) {
        logger.error(
          `❌ Error al iniciar sesión para ${magaya_user}: ${error.message}`
        );
        return { ...user, error: error.message };
      } finally {
        activeUsers.delete(magaya_user);
      }
    });

    return await Promise.all(userPromises);
  } catch (error) {
    logger.error(
      `❌ Error general al iniciar sesión de los usuarios activos: ${error.message}`
    );
    throw error;
  }
};

module.exports = startSessionController;
