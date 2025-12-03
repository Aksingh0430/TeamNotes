// server/utils/log.js
// Small logger that respects process.env.DEBUG === 'true'
function log(...args) {
  if (process.env.DEBUG === 'true') {
    console.log(...args);
  }
}
module.exports = log;
