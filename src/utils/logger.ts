// src/utils/logger.ts

// Define log levels
type LogLevel = "INFO" | "ERROR" | "DEBUG" | "WARN";

// Format messages with timestamp and level
const formatMessage = (level: LogLevel, msg: any) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${msg}`;
};

// Logger object
const logger = {
  info: (...msgs: any[]) =>
    console.log(...msgs.map((msg) => formatMessage("INFO", msg))),

  error: (...msgs: any[]) =>
    console.error(...msgs.map((msg) => formatMessage("ERROR", msg))),

  debug: (...msgs: any[]) =>
    console.debug(...msgs.map((msg) => formatMessage("DEBUG", msg))),

  warn: (...msgs: any[]) =>
    console.warn(...msgs.map((msg) => formatMessage("WARN", msg))),
};

// ✅ Only **one** default export
export default logger;