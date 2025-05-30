// cronControllerOptimizado.js

const cron = require("node-cron");
const NodeCache = require("node-cache");
const startSession = require("../../services/magayaAuthService");
const processInvoiceController = require("./processInvoiceController");
const selectUsers = require("../../models/selectUsers");
const logger = require("../../utils/logger");

// Cache para sesiones con TTL de 15 minutos
const sessionCache = new NodeCache({ stdTTL: 900 });

// Retry con backoff exponencial
const retryWithBackoff = async (fn, retries = 3, delay = 1000) => {
  try {
    return await fn();
  } catch (err) {
    if (retries === 0) throw err;
    logger.warn(`Retrying after failure... (${retries} retries left)`);
    await new Promise((res) => setTimeout(res, delay));
    return retryWithBackoff(fn, retries - 1, delay * 2);
  }
};

// Iniciar proceso completo para un usuario
const processAllForUser = async (user) => {
  const { networkid, magaya_user, magaya_pass, urlMagaya } = user;

  logger.info(`🧩 Iniciando proceso para ${magaya_user}`);

  // Obtener o reutilizar access_key
  let accessKey = sessionCache.get(`access_key_${magaya_user}`);

  if (!accessKey) {
    logger.info(`🔐 Generando nueva sesión para ${magaya_user}`);
    const session = await retryWithBackoff(() =>
      startSession(networkid, magaya_user, magaya_pass, urlMagaya)
    );

    if (!session?.access_key) {
      logger.error(`❌ No se pudo iniciar sesión para ${magaya_user}`);
      return;
    }

    accessKey = session.access_key;
    sessionCache.set(`access_key_${magaya_user}`, accessKey);
  }

  // Agregar access_key al usuario
  user.access_key = accessKey;

  try {
    await processInvoiceController(user);
    await new Promise((r) => setTimeout(r, 1000));
  } catch (err) {
    logger.error(`💥 Error procesando usuario ${magaya_user}: ${err.message}`);
  }
};

// CRON programado cada 5 minutos
const startCronInvoice = async () => {
  logger.info("🔄 Iniciando ciclo global de facturación...");

  const users = await selectUsers();
  for (const user of users) {
    await processAllForUser(user);
    await new Promise((r) => setTimeout(r, 1500)); // evitar saturación Magaya
  }

  logger.info("✅ Ciclo completo ejecutado.");
};

startCronInvoice();
