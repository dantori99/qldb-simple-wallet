const { getQldbDriver } = require('./ConnectToLedger');
const CustomError = require('../lib/CustomError');
const ErrorNotFound = require('../lib/ErrorNotFound');

async function checkEmailUnique(txn, email, logger) {
  const query = 'SELECT email FROM DanielWallet AS d WHERE d.email = ?';
  let recordsReturned;
  await txn.execute(query, email).then((result) => {
    recordsReturned = result.getResultList().length;
    if (recordsReturned === 0) {
      logger.debug(`No records found for ${email}`);
    } else {
      logger.info(`Record already exists for ${email}`);
    }
  });
  return recordsReturned;
}

async function createWalletData(txn, walletDoc) {
  const statement = 'INSERT INTO DanielWallet ?';
  return txn.execute(statement, walletDoc);
}

async function addGuid(txn, id, walletId, email) {
  const statement = 'UPDATE DanielWallet as d SET d.guid = ?, d.walletId = ? WHERE d.email = ?';
  return txn.execute(statement, id, walletId, email);
}

const createWallet = async (email, name, event, logger) => {
  let wallet;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Check if the record already exists assuming email unique for demo
    const recordsReturned = await checkEmailUnique(txn, email, logger);
    if (recordsReturned === 0) {
      const walletDoc = [{
        email, name, currentBalance: 0, previousBalance: 0, events: event,
      }];
      // Create the record. This returns the unique document ID in an array as the result set
      const result = await createWalletData(txn, walletDoc, logger);
      const docIdArray = result.getResultList();
      const docId = docIdArray[0].get('documentId').stringValue();
      // Update the record to add the document ID as the GUID in the payload
      await addGuid(txn, docId, docId.toUpperCase(), email, logger);
      wallet = {
        guid: docId,
        walletId: docId.toUpperCase(),
        email,
        name,
        currentBalance: 0,
        previousBalance: 0,
      };
    } else {
      throw new CustomError(400, 'wallet Integrity Error', `wallet record with email ${email} already exists. No new record created`);
    }
  }, () => logger.info('Retrying due to OCC conflict...'));
  return wallet;
};

const getBalanceById = async (txn, id, logger) => {
  logger.debug('In getBalanceById function');
  const query = 'SELECT * FROM DanielWallet AS d WHERE d.guid = ?';
  return txn.execute(query, id);
};

const deleteWalletById = async (txn, id, logger) => {
  logger.debug('In getBalanceByEmail function');
  const query = 'DELETE FROM DanielWallet AS d WHERE d.guid = ?';
  return txn.execute(query, id);
};

const getBalance = async (id, logger) => {
  logger.debug(`In getBalance function with id ${id}`);

  let wallet;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    await getBalanceById(txn, id, logger).then((result) => {
      const resultList = result.getResultList();
      if (resultList.length === 0) {
        throw new ErrorNotFound(400, `wallet record with id ${id} does not exist`);
      } else {
        wallet = JSON.stringify(resultList[0]);
      }
    });
  }, () => logger.info('Retrying due to OCC conflict...'));
  return wallet;
};

const updateBalanceFunc = async (txn, id, currentBalance, previousBalance, logger) => {
  logger.debug('In updateBalance function');
  const query = 'UPDATE DanielWallet AS d SET d.currentBalance = ?, d.previousBalance = ? WHERE d.guid = ?';
  return txn.execute(query, currentBalance, previousBalance, id);
}

const addBalance = async (id, amounts, logger) => {
  let wallet;
  let amountToAdd = amounts;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // choose the id you want to update
    const result = await getBalanceById(txn, id, logger);
    const resultList = result.getResultList();
    
    if (resultList.length !== 0) {
      let totalAmount = resultList[0].currentBalance + amountToAdd;
    const newCBalance = totalAmount;
    const newPBalance = totalAmount - amountToAdd;
    
    await updateBalanceFunc(txn, id, newCBalance, newPBalance, logger);

    const newResult = await getBalanceById(txn, id, logger);
    const newResultList = newResult.getResultList();

    wallet = {
      message: `Success to add ${amountToAdd}`,
      detail: {
        guid: id,
        name: newResultList[0].name,
        currentBalance: newCBalance,
        previousBalance: newPBalance,
      }
    }
    }
  })
  return wallet;
};

const withdrawBalance = async (id, amountWithdraw, logger) => {
  let wallet;
  let amountToWithdraw = amountWithdraw;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // choose the id you want to update
    const result = await getBalanceById(txn, id, logger);
    const resultList = result.getResultList();

    if(resultList.length !== 0) {
      let totalAmount = resultList[0].currentBalance - amountToWithdraw;
      if (totalAmount >= 0) {
        const newAfterWithdrawBalance = totalAmount;
        const newAfterWithdrawPBalance = totalAmount + amountToWithdraw;

        await updateBalanceFunc(txn, id, newAfterWithdrawBalance, newAfterWithdrawPBalance, logger);

        const newResult = await getBalanceById(txn, id, logger);
        const newResultList = newResult.getResultList();

        wallet = {
          message: `Success to withdraw ${amountToWithdraw}`,
          detail: {
            guid: id,
            name: newResultList[0].name,
            currentBalance: newAfterWithdrawBalance,
            previousBalance: newAfterWithdrawPBalance,
          }
        }        
      } else {
        throw new CustomError(400, `Insufficient Balance, your balance is: ${resultList[0].currentBalance}`);
      }
    }
  })
  return wallet;
};

const deleteWallet = async (id, logger) => {
  let wallet;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    const result = await getBalanceById(txn, id, logger);
    const resultList = result.getResultList();

    if (resultList.length !== 0) {
      await deleteWalletById(txn, id, logger);

      wallet = {
        message: `Wallet with id: ${id} has been deleted successfully!`
      };
    } else {
      throw new CustomError(`Wallet with id: ${id} is not registered!`);
    }
  })
  return wallet;
}

module.exports = {
  createWallet,
  getBalance,
  addBalance,
  withdrawBalance,
  deleteWallet,
};
