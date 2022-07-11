const { QldbDriver } = require('amazon-qldb-driver-nodejs');

function createQldbDriver(
  ledgerName = process.env.LEDGER_NAME,
  serviceConfigurationOptions = {},
) {
  const qldbDriver = new QldbDriver(ledgerName, serviceConfigurationOptions);
  return qldbDriver;
}

const qldbDriver = createQldbDriver();

/**
 * Retrieve a driver for interacting with QLDB.
 * @returns The driver for interacting with the specified ledger.
 */
function getQldbDriver() {
  return qldbDriver;
}

module.exports = {
  createQldbDriver,
  getQldbDriver,
};
