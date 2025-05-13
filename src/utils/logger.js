// utils/logger.js
/**
 * @file Configuración del logger centralizado usando Winston.
 * @description Define la estructura de logs para consola, archivos de errores, combinados y excepciones no capturadas.
 */

const { createLogger, format, transports } = require("winston");

const logFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

const logger = createLogger({
  level: "info", // Nivel mínimo de logs (info, warn, error, etc.)
  format: logFormat,
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()), // Coloreado solo en consola
    }),
    new transports.File({ filename: "logs/error.log", level: "error" }),
    new transports.File({ filename: "logs/combined.log" }),
  ],
  exceptionHandlers: [new transports.File({ filename: "logs/exceptions.log" })],
  rejectionHandlers: [new transports.File({ filename: "logs/rejections.log" })],
});

module.exports = logger;
