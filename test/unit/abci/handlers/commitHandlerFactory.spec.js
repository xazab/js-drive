const {
  tendermint: {
    abci: {
      ResponseCommit,
    },
  },
} = require('@xazab/abci/types');

const Long = require('long');

const getDataContractFixture = require('@xazab/dpp/lib/test/fixtures/getDataContractFixture');
const createDPPMock = require('@xazab/dpp/lib/test/mocks/createDPPMock');

const commitHandlerFactory = require('../../../../lib/abci/handlers/commitHandlerFactory');

const RootTreeMock = require('../../../../lib/test/mock/RootTreeMock');

const BlockExecutionDBTransactionsMock = require('../../../../lib/test/mock/BlockExecutionStoreTransactionsMock');
const BlockExecutionContextMock = require('../../../../lib/test/mock/BlockExecutionContextMock');
const NoPreviousBlockExecutionStoreTransactionsFoundError = require('../../../../lib/abci/handlers/errors/NoPreviousBlockExecutionStoreTransactionsFoundError');
const DataCorruptedError = require('../../../../lib/abci/handlers/errors/DataCorruptedError');

describe('commitHandlerFactory', () => {
  let commitHandler;
  let appHash;
  let chainInfoMock;
  let chainInfoRepositoryMock;
  let creditsDistributionPoolMock;
  let creditsDistributionPoolRepositoryMock;
  let blockExecutionStoreTransactionsMock;
  let blockExecutionContextMock;
  let documentsDatabaseManagerMock;
  let dataContract;
  let accumulativeFees;
  let rootTreeMock;
  let dppMock;
  let previousBlockExecutionStoreTransactionsRepositoryMock;
  let containerMock;
  let previousDocumentDatabaseManagerMock;
  let nextPreviousBlockExecutionStoreTransactionsMock;
  let previousBlockExecutionStoreTransactionsMock;
  let previousDataContractTransactionMock;
  let updates;
  let populateMongoDbTransactionFromObjectMock;
  let mongoDbTransactionMock;
  let cloneToPreviousStoreTransactionsMock;

  beforeEach(function beforeEach() {
    nextPreviousBlockExecutionStoreTransactionsMock = 'nextPreviousBlockExecutionStoreTransactionsMock';
    appHash = Buffer.alloc(0);

    chainInfoMock = {
      setLastBlockHeight: this.sinon.stub(),
    };

    creditsDistributionPoolMock = {
      setAmount: this.sinon.stub(),
    };

    dataContract = getDataContractFixture();

    chainInfoRepositoryMock = {
      store: this.sinon.stub(),
      createTransaction: this.sinon.stub(),
    };

    blockExecutionStoreTransactionsMock = new BlockExecutionDBTransactionsMock(this.sinon);
    creditsDistributionPoolRepositoryMock = {
      store: this.sinon.stub(),
    };

    blockExecutionContextMock = new BlockExecutionContextMock(this.sinon);

    blockExecutionContextMock.getDataContracts.returns([dataContract]);
    blockExecutionContextMock.getAccumulativeFees.returns(accumulativeFees);
    blockExecutionContextMock.getHeader.returns({
      height: 1,
    });

    documentsDatabaseManagerMock = {
      create: this.sinon.stub(),
      drop: this.sinon.stub(),
    };

    rootTreeMock = new RootTreeMock(this.sinon);
    rootTreeMock.getRootHash.returns(appHash);

    dppMock = createDPPMock(this.sinon);
    dppMock.dataContract.createFromBuffer.resolves(dataContract);

    previousBlockExecutionStoreTransactionsRepositoryMock = {
      fetch: this.sinon.stub(),
      store: this.sinon.stub(),
    };

    containerMock = {
      register: this.sinon.stub(),
      resolve: this.sinon.stub(),
      has: this.sinon.stub(),
    };

    const loggerMock = {
      debug: this.sinon.stub(),
      info: this.sinon.stub(),
      error: this.sinon.stub(),
    };

    previousBlockExecutionStoreTransactionsMock = {
      getTransaction: this.sinon.stub(),
      commit: this.sinon.stub(),
    };

    updates = {
      dataContract: dataContract.toBuffer(),
    };

    mongoDbTransactionMock = 'mongoDbTransactionMock';

    previousDataContractTransactionMock = {
      getMongoDbTransaction: this.sinon.stub().returns(mongoDbTransactionMock),
      toObject: this.sinon.stub().returns({
        updates,
      }),
    };

    previousDocumentDatabaseManagerMock = {
      create: this.sinon.stub(),
    };

    populateMongoDbTransactionFromObjectMock = this.sinon.stub();
    cloneToPreviousStoreTransactionsMock = this.sinon.stub();

    cloneToPreviousStoreTransactionsMock.returns(
      nextPreviousBlockExecutionStoreTransactionsMock,
    );

    commitHandler = commitHandlerFactory(
      chainInfoMock,
      chainInfoRepositoryMock,
      creditsDistributionPoolMock,
      creditsDistributionPoolRepositoryMock,
      blockExecutionStoreTransactionsMock,
      blockExecutionContextMock,
      documentsDatabaseManagerMock,
      previousDocumentDatabaseManagerMock,
      dppMock,
      rootTreeMock,
      previousBlockExecutionStoreTransactionsRepositoryMock,
      populateMongoDbTransactionFromObjectMock,
      containerMock,
      loggerMock,
      cloneToPreviousStoreTransactionsMock,
    );
  });

  it('should commit db transactions, update chain info, create document dbs and return ResponseCommit', async () => {
    const response = await commitHandler();

    expect(response).to.be.an.instanceOf(ResponseCommit);
    expect(response.data).to.deep.equal(appHash);

    expect(blockExecutionContextMock.getHeader).to.be.calledOnce();

    expect(blockExecutionContextMock.getDataContracts).to.be.calledOnce();

    expect(documentsDatabaseManagerMock.create).to.be.calledOnceWith(dataContract);

    expect(blockExecutionStoreTransactionsMock.commit).to.be.calledOnce();

    expect(creditsDistributionPoolMock.setAmount).to.be.calledOnceWith(
      accumulativeFees,
    );

    expect(blockExecutionContextMock.getAccumulativeFees).to.be.calledOnce();

    expect(blockExecutionStoreTransactionsMock.getTransaction).to.be.calledOnceWithExactly('common');

    expect(chainInfoRepositoryMock.store).to.be.calledOnceWith(chainInfoMock);
    expect(creditsDistributionPoolRepositoryMock.store).to.be.calledOnceWith(
      creditsDistributionPoolMock,
    );

    expect(cloneToPreviousStoreTransactionsMock).to.be.calledOnce();

    expect(blockExecutionStoreTransactionsMock.commit).to.be.calledOnce();

    expect(blockExecutionContextMock.reset).to.be.calledOnce();

    expect(rootTreeMock.rebuild).to.be.calledOnce();
    expect(rootTreeMock.getRootHash).to.be.calledOnce();

    expect(previousBlockExecutionStoreTransactionsRepositoryMock.store).to.be.calledOnceWithExactly(
      nextPreviousBlockExecutionStoreTransactionsMock,
    );
  });

  it('should commit db transactions, update chain info, create document dbs and return ResponseCommit ion height > 1', async () => {
    blockExecutionContextMock.getHeader.returns({
      height: 2,
    });

    containerMock.resolve.withArgs('previousBlockExecutionStoreTransactions').returns(
      previousBlockExecutionStoreTransactionsMock,
    );

    containerMock.has.withArgs('previousBlockExecutionStoreTransactions').returns(true);

    previousBlockExecutionStoreTransactionsMock.getTransaction.withArgs('dataContracts').returns(
      previousDataContractTransactionMock,
    );

    previousBlockExecutionStoreTransactionsMock.getTransaction.withArgs('documents').returns(
      previousDataContractTransactionMock,
    );

    const response = await commitHandler();

    expect(response).to.be.an.instanceOf(ResponseCommit);
    expect(response.data).to.deep.equal(appHash);

    expect(blockExecutionContextMock.getHeader).to.be.calledOnce();

    expect(containerMock.has).to.be.calledOnceWithExactly('previousBlockExecutionStoreTransactions');
    expect(containerMock.resolve).to.be.calledOnceWithExactly('previousBlockExecutionStoreTransactions');
    expect(blockExecutionContextMock.getDataContracts).to.be.calledOnce();
    expect(documentsDatabaseManagerMock.create).to.be.calledOnceWithExactly(dataContract);
    expect(creditsDistributionPoolMock.setAmount).to.be.calledOnceWith(accumulativeFees);
    expect(blockExecutionContextMock.getAccumulativeFees).to.be.calledOnce();

    expect(blockExecutionStoreTransactionsMock.getTransaction).to.be.calledOnceWithExactly('common');
    expect(chainInfoRepositoryMock.store).to.be.calledOnceWith(chainInfoMock);
    expect(creditsDistributionPoolRepositoryMock.store).to.be.calledOnceWith(
      creditsDistributionPoolMock,
    );

    expect(cloneToPreviousStoreTransactionsMock).to.be.calledOnce();
    expect(blockExecutionStoreTransactionsMock.commit).to.be.calledOnce();

    expect(previousBlockExecutionStoreTransactionsMock.getTransaction).to.be.calledTwice();
    expect(previousBlockExecutionStoreTransactionsMock.getTransaction.getCall(0).args).to.have.deep.members(['dataContracts']);
    expect(previousBlockExecutionStoreTransactionsMock.getTransaction.getCall(1).args).to.have.deep.members(['documents']);

    expect(previousDataContractTransactionMock.toObject).to.be.calledTwice();

    expect(previousDocumentDatabaseManagerMock.create).to.be.calledOnceWithExactly(dataContract);

    expect(populateMongoDbTransactionFromObjectMock).to.be.calledOnce();
    expect(populateMongoDbTransactionFromObjectMock.getCall(0).args).to.have.deep.members([
      mongoDbTransactionMock,
      { updates },
    ]);

    expect(previousBlockExecutionStoreTransactionsMock.commit).to.be.calledOnce();

    expect(blockExecutionContextMock.reset).to.be.calledOnce();

    expect(rootTreeMock.rebuild).to.be.calledOnce();
    expect(rootTreeMock.getRootHash).to.be.calledOnce();

    expect(previousBlockExecutionStoreTransactionsRepositoryMock.store).to.be.calledOnceWithExactly(
      nextPreviousBlockExecutionStoreTransactionsMock,
    );
  });

  it('should throw NoPreviousBlockExecutionStoreTransactionsFoundError', async () => {
    blockExecutionContextMock.getHeader.returns({
      height: 2,
    });

    containerMock.has.withArgs('previousBlockExecutionStoreTransactions').returns(false);

    previousBlockExecutionStoreTransactionsRepositoryMock.fetch.resolves(false);

    try {
      await commitHandler();

      expect.fail('should throw NoPreviousBlockExecutionStoreTransactionsFoundError');
    } catch (e) {
      expect(e).to.be.an.instanceOf(NoPreviousBlockExecutionStoreTransactionsFoundError);
    }
  });

  it('should abort DB transactions', async () => {
    blockExecutionContextMock.getHeader.returns({
      height: 2,
    });

    containerMock.has.withArgs('previousBlockExecutionStoreTransactions').returns(false);

    previousBlockExecutionStoreTransactionsRepositoryMock.fetch.resolves(
      previousBlockExecutionStoreTransactionsMock,
    );

    previousBlockExecutionStoreTransactionsMock.getTransaction.withArgs('dataContracts').returns(
      previousDataContractTransactionMock,
    );

    previousBlockExecutionStoreTransactionsMock.getTransaction.withArgs('documents').returns(
      previousDataContractTransactionMock,
    );

    const error = new Error('commit error');

    blockExecutionStoreTransactionsMock.commit.throws(error);

    try {
      await commitHandler();

      expect.fail('should throw error');
    } catch (e) {
      expect(previousBlockExecutionStoreTransactionsRepositoryMock.fetch).to.be.calledOnce();
      expect(blockExecutionStoreTransactionsMock.abort).to.be.calledOnce();
      expect(documentsDatabaseManagerMock.drop).to.be.calledOnce();
      expect(blockExecutionContextMock.reset).to.be.calledOnce();

      expect(e).to.deep.equal(error);
    }
  });

  it('should throw DataCorruptedError', async () => {
    const error = new Error('store error');

    previousBlockExecutionStoreTransactionsRepositoryMock.store.throws(error);

    try {
      await commitHandler();

      expect.fail('should throw DataCorruptedError');
    } catch (e) {
      expect(e).to.be.an.instanceOf(DataCorruptedError);

      expect(chainInfoMock.setLastBlockHeight).to.be.calledOnceWithExactly(Long.fromInt(0));
      expect(chainInfoRepositoryMock.store).to.be.calledTwice();
    }
  });
});
