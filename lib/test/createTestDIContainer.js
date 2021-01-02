const createDIContainer = require('../createDIContainer');

async function createTestDIContainer(mongoDB, xazabCore = undefined) {
  const documentMongoDBUrl = `mongodb://127.0.0.1:${mongoDB.options.getMongoPort()}`
    + `/?replicaSet=${mongoDB.options.options.replicaSetName}`;

  let coreOptions = {};
  if (xazabCore) {
    coreOptions = {
      CORE_JSON_RPC_HOST: '127.0.0.1',
      CORE_JSON_RPC_PORT: xazabCore.options.getRpcPort(),
      CORE_JSON_RPC_USERNAME: xazabCore.options.getRpcUser(),
      CORE_JSON_RPC_PASSWORD: xazabCore.options.getRpcPassword(),
    };
  }

  return createDIContainer({
    ...process.env,
    DOCUMENT_MONGODB_URL: documentMongoDBUrl,
    COMMON_STORE_MERK_DB_FILE: './db/common-merkdb-test',
    PREVIOUS_COMMON_STORE_MERK_DB_FILE: './db/common-merkdb-previous-test',
    DATA_CONTRACTS_STORE_MERK_DB_FILE: './db/data-contracts-merkdb-test',
    PREVIOUS_DATA_CONTRACTS_STORE_MERK_DB_FILE: './db/data-contracts-merkdb-previous-test',
    DOCUMENTS_STORE_MERK_DB_FILE: './db/documents-merkdb-test',
    PREVIOUS_DOCUMENTS_STORE_MERK_DB_FILE: './db/documents-merkdb-previous-test',
    IDENTITIES_STORE_MERK_DB_FILE: './db/identities-merkdb-test',
    PREVIOUS_IDENTITIES_STORE_MERK_DB_FILE: './db/identities-merkdb-previous-test',
    PUBLIC_KEY_TO_IDENTITY_STORE_MERK_DB_FILE: './db/public-key-to-identity-id-merkdb-test',
    PREVIOUS_PUBLIC_KEY_TO_IDENTITY_STORE_MERK_DB_FILE: './db/public-key-to-identity-id-merkdb-previous-test',
    EXTERNAL_STORE_LEVEL_DB_FILE: './db/external-leveldb-test',
    PREVIOUS_EXTERNAL_STORE_LEVEL_DB_FILE: './db/external-leveldb-previous-test',
    ...coreOptions,
  });
}

module.exports = createTestDIContainer;
