// src/util/logging.ts
function logInfo(msg) {
  console.log(msg);
}
function logWarn(msg) {
  console.warn(`\x1B[33mWarning:\x1B[0m ${msg}`);
}
function logError(msg) {
  console.error(`\x1B[31mError:\x1B[0m ${msg}`);
}
function logSuccess(msg) {
  console.log(`\x1B[32m${msg}\x1B[0m`);
}
function logHeader(msg) {
  console.log(`
\x1B[1m${msg}\x1B[0m`);
}
function logSub(msg) {
  console.log(`  ${msg}`);
}
function logDivider() {
  console.log("");
}

export {
  logInfo,
  logWarn,
  logError,
  logSuccess,
  logHeader,
  logSub,
  logDivider
};
//# sourceMappingURL=chunk-OPCWHN3N.js.map