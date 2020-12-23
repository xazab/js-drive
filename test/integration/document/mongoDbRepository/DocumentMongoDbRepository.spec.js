const { mocha: { startMongoDb } } = require('@xazab/dp-services-ctl');

const getDocumentsFixture = require('@xazab/dpp/lib/test/fixtures/getDocumentsFixture');
const getDataContractFixture = require('@xazab/dpp/lib/test/fixtures/getDataContractFixture');
const Document = require('@xazab/dpp/lib/document/Document');
const Identifier = require('@xazab/dpp/lib/Identifier');

const DocumentMongoDbRepository = require('../../../../lib/document/mongoDbRepository/DocumentMongoDbRepository');

const convertWhereToMongoDbQuery = require('../../../../lib/document/mongoDbRepository/convertWhereToMongoDbQuery');
const validateQueryFactory = require('../../../../lib/document/query/validateQueryFactory');
const findConflictingConditions = require('../../../../lib/document/query/findConflictingConditions');
const MongoDBTransaction = require('../../../../lib/mongoDb/MongoDBTransaction');

const InvalidQueryError = require('../../../../lib/document/errors/InvalidQueryError');

const findNotIndexedFields = require('../../../../lib/document/query/findNotIndexedFields');
const findNotIndexedOrderByFields = require('../../../../lib/document/query/findNotIndexedOrderByFields');
const getIndexedFieldsFromDocumentSchema = require('../../../../lib/document/query/getIndexedFieldsFromDocumentSchema');

function convertToRaw(documents) {
  return documents.map((d) => d.toObject());
}

async function createDocuments(documentRepository, documents) {
  return Promise.all(
    documents.map((o) => documentRepository.store(o)),
  );
}

describe('DocumentMongoDbRepository', function main() {
  this.timeout(10000);

  let documentRepository;
  let document;
  let documents;
  let mongoDatabase;
  let mongoClient;
  let stateViewTransaction;
  let documentSchema;
  let dataContract;

  startMongoDb().then((mongoDb) => {
    mongoDatabase = mongoDb.getDb();
    mongoClient = mongoDb.getClient();
  });

  beforeEach(async () => {
    dataContract = getDataContractFixture();
    documents = getDocumentsFixture(dataContract).slice(0, 5);

    [document] = documents;

    // Modify documents for the test cases
    documents = documents.map((doc, i) => {
      const currentDocument = doc;
      const arrayItem = { item: i + 1, flag: true };

      currentDocument.set('order', i);
      currentDocument.set('arrayWithScalar', Array(i + 1)
        .fill(1)
        .map((item, index) => i + index));
      currentDocument.set('arrayWithObjects', Array(i + 1).fill(arrayItem));
      currentDocument.type = document.getType();

      return currentDocument;
    });

    [document] = documents;

    dataContract.documents[document.getType()].properties = {
      ...dataContract.documents[document.getType()].properties,
      order: {
        type: 'number',
      },
      lastName: {
        type: 'string',
      },
      arrayWithScalar: {
        type: 'array',
        items: [
          { type: 'string' },
        ],
      },
      arrayWithObjects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            flag: {
              type: 'string',
            },
          },
        },
      },
    };

    const documentsSchema = dataContract.getDocuments();

    documentSchema = documentsSchema[document.getType()];

    // redeclare indices
    const indices = documentSchema.indices || [];
    documentSchema.indices = indices.concat([
      {
        properties: [{ name: 'asc' }],
      },
      {
        properties: [{ order: 'asc' }],
      },
      {
        properties: [{ lastName: 'asc' }],
      },
      {
        properties: [{ arrayWithScalar: 'asc' }],
      },
      {
        properties: [{ arrayWithObjects: 'asc' }],
      },
      {
        properties: [{ 'arrayWithObjects.item': 'asc' }],
      },
      {
        properties: [{ 'arrayWithObjects.flag': 'asc' }],
      },
      {
        properties: [{ primaryOrder: 'asc' }, { order: 'desc' }],
      },
      {
        properties: [{ $ownerId: 'desc' }],
      },
    ]);

    const validateQuery = validateQueryFactory(
      findConflictingConditions,
      getIndexedFieldsFromDocumentSchema,
      findNotIndexedFields,
      findNotIndexedOrderByFields,
    );

    documentRepository = new DocumentMongoDbRepository(
      mongoDatabase,
      convertWhereToMongoDbQuery,
      validateQuery,
      dataContract,
      document.getType(),
    );

    const connectToDocumentMongoDB = async () => mongoClient;

    stateViewTransaction = new MongoDBTransaction(connectToDocumentMongoDB);
  });

  describe('#store', () => {
    beforeEach(async () => {
      await createDocuments(documentRepository, documents);
    });

    it('should store Document', async () => {
      const result = await documentRepository.find(document.getId());

      expect(result).to.be.an.instanceOf(Document);
      expect(result.toObject()).to.deep.equal(document.toObject());
    });

    it('should store Document in transaction', async () => {
      await documentRepository.delete(document.getId());

      await stateViewTransaction.start();

      await documentRepository.store(document, stateViewTransaction);

      const transactionDocument = await documentRepository
        .find(document.getId(), stateViewTransaction);
      const notFoundDocument = await documentRepository.find(document.getId());

      await stateViewTransaction.commit();

      const createdDocument = await documentRepository.find(document.getId());

      expect(notFoundDocument).to.be.a('null');
      expect(transactionDocument).to.be.an.instanceOf(Document);
      expect(transactionDocument.toObject()).to.deep.equal(document.toObject());
      expect(createdDocument).to.be.an.instanceOf(Document);
      expect(createdDocument.toObject()).to.deep.equal(document.toObject());
    });
  });

  describe('#fetch', () => {
    beforeEach(async () => {
      await createDocuments(documentRepository, documents);
    });

    it('should fetch Documents', async () => {
      const result = await documentRepository.fetch();

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(documents.length);

      const actualRawDocuments = convertToRaw(result);
      const expectedRawDocuments = convertToRaw(documents);

      expect(actualRawDocuments).to.have.deep.members(expectedRawDocuments);
    });

    it('should fetch Documents in transaction', async () => {
      await stateViewTransaction.start();

      const result = await documentRepository.fetch({}, {}, stateViewTransaction);

      await stateViewTransaction.commit();

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(documents.length);

      const actualRawDocuments = convertToRaw(result);
      const expectedRawDocuments = convertToRaw(documents);

      expect(actualRawDocuments).to.have.deep.members(expectedRawDocuments);
    });

    it('should throw InvalidQueryError if query is not valid', async () => {
      const invalidQuery = { invalid: 'query' };

      let error;
      try {
        await documentRepository.fetch(invalidQuery);
      } catch (e) {
        error = e;
      }

      expect(error).to.be.instanceOf(InvalidQueryError);
      expect(error.getErrors()).has.lengthOf(1);
    });

    describe('where', () => {
      it('should find Documents using "<" operator', async () => {
        const query = {
          where: [['order', '<', documents[1].get('order')]],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(1);

        const [expectedDocument] = result;

        expect(expectedDocument.toObject()).to.deep.equal(documents[0].toObject());
      });

      it('should find Documents using "<=" operator', async () => {
        const query = {
          where: [['order', '<=', documents[1].get('order')]],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(2);

        const actualRawDocuments = convertToRaw(result);

        const expectedRawDocuments = convertToRaw(documents.slice(0, 2));

        expect(actualRawDocuments).to.deep.members(expectedRawDocuments);
      });

      it('should find Documents using "==" operator', async () => {
        const query = {
          where: [['name', '==', document.get('name')]],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(1);

        const [expectedDocument] = result;

        expect(expectedDocument.toObject()).to.deep.equal(document.toObject());
      });

      it('should find Documents using ">" operator', async () => {
        const query = {
          where: [['order', '>', documents[1].get('order')]],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(documents.length - 2);

        const actualRawDocuments = convertToRaw(result);

        const expectedRawDocuments = convertToRaw(documents.splice(2, documents.length));

        expect(actualRawDocuments).to.have.deep.members(expectedRawDocuments);
      });

      it('should find Documents using ">=" operator', async () => {
        const query = {
          where: [['order', '>=', documents[1].get('order')]],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(documents.length - 1);

        const actualRawDocuments = convertToRaw(result);

        documents.shift();
        const expectedRawDocuments = convertToRaw(documents);

        expect(actualRawDocuments).to.have.deep.members(expectedRawDocuments);
      });

      it('should find Documents using "in" operator', async () => {
        const query = {
          where: [
            ['$id', 'in', [
              documents[0].getId(),
              documents[1].getId(),
            ]],
          ],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(2);

        const actualRawDocuments = convertToRaw(result);

        const expectedRawDocuments = convertToRaw(documents.slice(0, 2));

        expect(actualRawDocuments).to.have.deep.members(expectedRawDocuments);
      });

      it('should find Documents using "length" operator', async () => {
        const query = {
          where: [['arrayWithObjects', 'length', 2]],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(1);

        const [expectedDocument] = result;

        expect(expectedDocument.toObject()).to.deep.equal(documents[1].toObject());
      });

      it('should find Documents using "startsWith" operator', async () => {
        const query = {
          where: [['lastName', 'startsWith', 'Swe']],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(1);

        const [expectedDocument] = result;

        expect(expectedDocument.toObject()).to.deep.equal(documents[2].toObject());
      });

      it('should find Documents using "elementMatch" operator', async () => {
        const query = {
          where: [
            ['arrayWithObjects', 'elementMatch', [
              ['item', '==', 2], ['flag', '==', true],
            ]],
          ],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(1);

        const [expectedDocument] = result;

        expect(expectedDocument.toObject()).to.deep.equal(documents[1].toObject());
      });

      it('should find Documents using "contains" operator and array value', async () => {
        const query = {
          where: [
            ['arrayWithScalar', 'contains', [2, 3]],
          ],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(1);

        const [expectedDocument] = result;

        expect(expectedDocument.toObject()).to.deep.equal(documents[2].toObject());
      });

      it('should find Documents using "contains" operator and scalar value', async () => {
        const query = {
          where: [
            ['arrayWithScalar', 'contains', 2],
          ],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(2);

        const actualRawDocuments = convertToRaw(result);

        const expectedRawDocuments = convertToRaw(documents.slice(1, 3));

        expect(actualRawDocuments).to.have.deep.members(expectedRawDocuments);
      });

      it('should return empty array if where clause conditions do not match', async () => {
        const query = {
          where: [['name', '==', 'Xazab enthusiast']],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.deep.equal([]);
      });

      it('should find Documents by nested object fields', async () => {
        const query = {
          where: [
            ['arrayWithObjects.item', '==', 2],
          ],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(1);

        const [expectedDocument] = result;

        expect(expectedDocument.toObject()).to.deep.equal(documents[1].toObject());
      });

      it('should return Documents by several conditions', async () => {
        const query = {
          where: [
            ['name', '==', 'Cutie'],
            ['arrayWithObjects', 'elementMatch', [
              ['item', '==', 1],
              ['flag', '==', true],
            ]],
          ],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(1);

        const [expectedDocument] = result;

        expect(expectedDocument.toObject()).to.deep.equal(documents[0].toObject());
      });
    });

    describe('limit', () => {
      it('should limit return to 1 Document if limit is set', async () => {
        const options = {
          limit: 1,
        };

        const result = await documentRepository.fetch(options, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.have.lengthOf(1);
      });

      it('should limit result to 100 Documents if limit is not set', async () => {
        // Store 101 document
        await Promise.all(
          Array(101).fill(document).map((svDoc, i) => {
            // Ensure unique ID

            // eslint-disable-next-line no-param-reassign
            svDoc.id = Identifier.from(Buffer.alloc(32, i + 1));

            return documentRepository.store(svDoc);
          }),
        );

        const result = await documentRepository.fetch();

        expect(result).to.be.an('array');
        expect(result).to.have.lengthOf(100);
      });
    });

    describe('startAt', () => {
      it('should return Documents from 2 document', async () => {
        const query = {
          orderBy: [
            ['order', 'asc'],
          ],
          startAt: 2,
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');

        const actualRawDocuments = result.map((d) => d.toObject());
        const expectedRawDocuments = documents.splice(1).map((d) => d.toObject());

        expect(actualRawDocuments).to.deep.equal(expectedRawDocuments);
      });
    });

    describe('startAfter', () => {
      it('should return Documents after 1 document', async () => {
        const options = {
          orderBy: [
            ['order', 'asc'],
          ],
          startAfter: 1,
        };

        const result = await documentRepository.fetch(options, documentSchema);

        expect(result).to.be.an('array');

        const actualRawDocuments = result.map((d) => d.toObject());
        const expectedRawDocuments = documents.splice(1).map((d) => d.toObject());

        expect(actualRawDocuments).to.deep.equal(expectedRawDocuments);
      });
    });

    describe('orderBy', () => {
      it('should sort Documents in descending order', async () => {
        const query = {
          orderBy: [
            ['order', 'desc'],
          ],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');

        const actualRawDocuments = result.map((d) => d.toObject());
        const expectedRawDocuments = documents.reverse().map((d) => d.toObject());

        expect(actualRawDocuments).to.deep.equal(expectedRawDocuments);
      });

      it('should sort Documents in ascending order', async () => {
        const query = {
          orderBy: [
            ['order', 'asc'],
          ],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');

        const actualRawDocuments = result.map((d) => d.toObject());
        const expectedRawDocuments = documents.map((d) => d.toObject());

        expect(actualRawDocuments).to.deep.equal(expectedRawDocuments);
      });

      it('should sort Documents using two fields', async () => {
        documents[0].set('primaryOrder', 1);
        documents[1].set('primaryOrder', 2);
        documents[2].set('primaryOrder', 2);
        documents[3].set('primaryOrder', 3);
        documents[4].set('primaryOrder', 4);

        await Promise.all(
          documents.map((o) => documentRepository.store(o)),
        );

        const query = {
          orderBy: [
            ['primaryOrder', 'asc'],
            ['order', 'desc'],
          ],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(documents.length);

        expect(result[0].toObject()).to.deep.equal(documents[0].toObject());
        expect(result[1].toObject()).to.deep.equal(documents[2].toObject());
        expect(result[2].toObject()).to.deep.equal(documents[1].toObject());
        expect(result[3].toObject()).to.deep.equal(documents[3].toObject());
        expect(result[4].toObject()).to.deep.equal(documents[4].toObject());
      });

      it('should sort Documents by $id', async () => {
        await Promise.all(
          documents.map((d) => documentRepository.delete(d.getId())),
        );

        await Promise.all(
          documents.map((svDoc, i) => {
            // eslint-disable-next-line no-param-reassign
            svDoc.id = Identifier.from(Buffer.alloc(32, i + 1));

            return documentRepository.store(svDoc);
          }),
        );

        const query = {
          orderBy: [
            ['$id', 'desc'],
          ],
        };

        const result = await documentRepository.fetch(query, documentSchema);

        expect(result).to.be.an('array');
        expect(result).to.be.lengthOf(documents.length);

        expect(result[0].toObject()).to.deep.equal(documents[4].toObject());
        expect(result[1].toObject()).to.deep.equal(documents[3].toObject());
        expect(result[2].toObject()).to.deep.equal(documents[2].toObject());
        expect(result[3].toObject()).to.deep.equal(documents[1].toObject());
        expect(result[4].toObject()).to.deep.equal(documents[0].toObject());
      });
    });
  });

  describe('#delete', () => {
    beforeEach(async () => {
      await createDocuments(documentRepository, documents);
    });

    it('should delete Document', async () => {
      await documentRepository.delete(document.getId());

      const result = await documentRepository.find(document.getId());

      expect(result).to.be.null();
    });

    it('should delete Document in transaction', async () => {
      await stateViewTransaction.start();

      await documentRepository.delete(document.getId(), stateViewTransaction);

      const removedDocument = await documentRepository
        .find(document.getId(), stateViewTransaction);

      const notRemovedDocument = await documentRepository
        .find(document.getId());

      await stateViewTransaction.commit();

      const completelyRemovedDocument = await documentRepository
        .find(document.getId());

      expect(removedDocument).to.be.a('null');
      expect(notRemovedDocument).to.be.an.instanceOf(Document);
      expect(notRemovedDocument.toObject()).to.deep.equal(document.toObject());
      expect(completelyRemovedDocument).to.be.a('null');
    });

    it('should restore document if transaction aborted', async () => {
      await stateViewTransaction.start();

      await documentRepository.delete(document.getId(), stateViewTransaction);

      const removedDocument = await documentRepository
        .find(document.getId(), stateViewTransaction);

      const notRemovedDocument = await documentRepository
        .find(document.getId());

      await stateViewTransaction.abort();

      const restoredDocument = await documentRepository
        .find(document.getId());

      expect(removedDocument).to.be.a('null');
      expect(notRemovedDocument).to.be.an.instanceOf(Document);
      expect(notRemovedDocument.toObject()).to.deep.equal(document.toObject());
      expect(restoredDocument).to.be.an.instanceOf(Document);
      expect(restoredDocument.toObject()).to.deep.equal(document.toObject());
    });
  });

  describe('#find', () => {
    beforeEach(async () => {
      await createDocuments(documentRepository, documents);
    });

    it('should find Document by ID', async () => {
      const result = await documentRepository.find(document.getId());

      expect(result).to.be.an.instanceof(Document);
      expect(result.toObject()).to.deep.equal(document.toObject());
    });

    it('should return null if Document was not found', async () => {
      const unknownDocument = await documentRepository.find('unknown');

      expect(unknownDocument).to.be.null();
    });
  });

  describe('#createCollection', () => {
    it('should create collection for Document', async () => {
      const collectionsBefore = await mongoDatabase.collections();
      await documentRepository.createCollection();
      const collectionsAfter = await mongoDatabase.collections();

      expect(collectionsBefore).to.have.lengthOf(0);
      expect(collectionsAfter).to.have.lengthOf(1);
      expect(collectionsAfter[0].collectionName).to.equal(documentRepository.getCollectionName());
    });

    it('should create indices for Document', async () => {
      const indices = [{
        key: {
          name: 1,
        },
        unique: true,
        name: 'index_name',
      }];

      await documentRepository.createCollection(indices);
      const indexInformation = await mongoDatabase
        .collection(documentRepository.getCollectionName())
        .indexInformation({ full: true });

      expect(indexInformation).to.deep.equal([{
        v: 2,
        key: { _id: 1 },
        name: '_id_',
        ns: 'test.documents_niceDocument',
      }, {
        v: 2,
        unique: true,
        key: {
          name: 1,
        },
        partialFilterExpression: {
          name: {
            $exists: true,
          },
        },
        name: 'index_name',
        ns: 'test.documents_niceDocument',
      }]);
    });
  });

  describe('#createIndices', () => {
    it('should create indices for Document', async () => {
      const indices = [{
        key: {
          name: 1,
          secondName: -1,
        },
        unique: true,
        name: 'index_name',
      }];

      await documentRepository.createCollection();
      let indexInformation = await mongoDatabase
        .collection(documentRepository.getCollectionName())
        .indexInformation({ full: true });

      expect(indexInformation).to.deep.equal([{
        v: 2,
        key: { _id: 1 },
        name: '_id_',
        ns: 'test.documents_niceDocument',
      }]);

      await documentRepository.createIndices(indices);

      indexInformation = await mongoDatabase
        .collection(documentRepository.getCollectionName())
        .indexInformation({ full: true });

      expect(indexInformation).to.deep.equal([{
        v: 2,
        key: { _id: 1 },
        name: '_id_',
        ns: 'test.documents_niceDocument',
      }, {
        v: 2,
        unique: true,
        key: {
          name: 1,
          secondName: -1,
        },
        name: 'index_name',
        ns: 'test.documents_niceDocument',
        partialFilterExpression: {
          name: {
            $exists: true,
          },
          secondName: {
            $exists: true,
          },
        },
      }]);
    });
  });

  describe('#removeCollection', () => {
    beforeEach(async () => {
      await createDocuments(documentRepository, documents);
    });

    it('should remove collection for Document', async () => {
      const collectionsBefore = await mongoDatabase.collections();
      const result = await documentRepository.removeCollection();
      const collectionsAfter = await mongoDatabase.collections();

      expect(result).to.be.true();
      expect(collectionsBefore).to.have.lengthOf(1);
      expect(collectionsAfter).to.have.lengthOf(0);
    });
  });
});
