// app.js
/**
 * @file Punto de entrada de la API eNvoice 2.0
 * @description Configura middlewares, inicializa conexión a base de datos, sesión con Magaya y cron jobs antes de levantar el servidor.
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const logger = require("./utils/logger");
const { testConnection } = require("./database/db");
const startSessionController = require("./controllers/startSessionController");
const cronController = require("./controllers/cronController");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors()); // Podrías configurar orígenes permitidos en producción
app.use(express.json());
app.use(morgan("dev"));

// Endpoint de verificación
app.get("/status", (req, res) => {
  res.json({ status: "✅ API envoice2.0 operativa" });
});

// Inicializar sistema
const initialize = async () => {
  try {
    logger.info("🔌 Verificando conexión a la base de datos...");
    await testConnection();

    logger.info("🔐 Iniciando sesión con Magaya...");
    await startSessionController();

    logger.info("⏲️ Iniciando procesos programados...");
    cronController();

    // Servidor escucha SOLO si todo salió bien
    app.listen(PORT, () => {
      logger.info(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error("❌ Error durante la inicialización:", error);
    process.exit(1); // Detiene el proceso si hay errores
  }
};

// Ejecutar inicialización
initialize();
