const { startMongoDb } = require('@xazab/dp-services-ctl');

const getDataContractFixture = require('@xazab/dpp/lib/test/fixtures/getDataContractFixture');

const DocumentDatabaseManager = require('../../../../lib/document/mongoDbRepository/DocumentDatabaseManager');
const convertToMongoDbIndices = require('../../../../lib/document/mongoDbRepository/convertToMongoDbIndices');
const createDocumentMongoDbRepositoryFactory = require('../../../../lib/document/mongoDbRepository/createDocumentMongoDbRepositoryFactory');
const getDocumentDatabaseFactory = require('../../../../lib/document/mongoDbRepository/getDocumentDatabaseFactory');
const convertWhereToMongoDbQuery = require('../../../../lib/document/mongoDbRepository/convertWhereToMongoDbQuery');
const validateQueryFactory = require('../../../../lib/document/query/validateQueryFactory');
const findConflictingConditions = require('../../../../lib/document/query/findConflictingConditions');
const getIndexedFieldsFromDocumentSchema = require('../../../../lib/document/query/getIndexedFieldsFromDocumentSchema');
const findNotIndexedFields = require('../../../../lib/document/query/findNotIndexedFields');
const findNotIndexedOrderByFields = require('../../../../lib/document/query/findNotIndexedOrderByFields');

describe('DocumentDatabaseManager', function main() {
  this.timeout(25000);

  let createDocumentRepository;
  let getDocumentDatabase;
  let dataContract;
  let mongoDB;
  let connectToDocumentMongoDB;
  let blockExecutionDBTransactionsMock;

  before(async () => {
    mongoDB = await startMongoDb();
  });

  beforeEach(async () => {
    dataContract = getDataContractFixture();

    const documentMongoDBPrefix = 'test';
    const mongoClient = mongoDB.getClient();

    const validateQuery = validateQueryFactory(
      findConflictingConditions,
      getIndexedFieldsFromDocumentSchema,
      findNotIndexedFields,
      findNotIndexedOrderByFields,
    );

    connectToDocumentMongoDB = async () => mongoClient;

    getDocumentDatabase = getDocumentDatabaseFactory(
      connectToDocumentMongoDB,
      documentMongoDBPrefix,
    );

    const dataContractRepositoryMock = {
      fetch: () => dataContract,
    };

    blockExecutionDBTransactionsMock = {
      getTransaction: () => ({
        isStarted: () => false,
      }),
    };

    createDocumentRepository = createDocumentMongoDbRepositoryFactory(
      convertWhereToMongoDbQuery,
      validateQuery,
      getDocumentDatabase,
      dataContractRepositoryMock,
      blockExecutionDBTransactionsMock,
    );
  });

  afterEach(async () => {
    await mongoDB.clean();
  });

  after(async () => {
    await mongoDB.remove();
  });

  it('should create a database for documents', async () => {
    const documentDatabaseManager = new DocumentDatabaseManager(
      createDocumentRepository,
      convertToMongoDbIndices,
      getDocumentDatabase,
    );

    await documentDatabaseManager.create(dataContract);

    const db = await getDocumentDatabase(dataContract.getId());
    const createdCollections = await db.collections();
    expect(createdCollections).to.have.lengthOf(Object.keys(dataContract.documents).length);

    const createdCollectionNames = createdCollections
      .map((collection) => collection.collectionName);

    const collectionNamesToCreate = Object
      .keys(dataContract.documents)
      .map((documentType) => `documents_${documentType}`);

    expect(collectionNamesToCreate).to.have.deep.members(createdCollectionNames);
  });

  it('should drop database', async () => {
    const documentDatabaseManager = new DocumentDatabaseManager(
      createDocumentRepository,
      convertToMongoDbIndices,
      getDocumentDatabase,
    );

    await documentDatabaseManager.create(dataContract);

    const db = await getDocumentDatabase(dataContract.getId());
    let dbCollections = await db.collections();
    expect(dbCollections).to.have.lengthOf(Object.keys(dataContract.documents).length);

    await documentDatabaseManager.drop(dataContract);

    dbCollections = await db.collections();
    expect(dbCollections).to.have.lengthOf(0);
  });
});
