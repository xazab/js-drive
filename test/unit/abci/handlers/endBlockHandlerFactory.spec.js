const {
  tendermint: {
    abci: {
      ResponseEndBlock,
    },
    types: {
      CoreChainLock,
    },
  },
} = require('@xazab/abci/types');

const generateRandomIdentifier = require('@xazab/dpp/lib/test/utils/generateRandomIdentifier');

const endBlockHandlerFactory = require('../../../../lib/abci/handlers/endBlockHandlerFactory');

const BlockExecutionContextMock = require('../../../../lib/test/mock/BlockExecutionContextMock');

const NoDPNSContractFoundError = require('../../../../lib/abci/handlers/errors/NoDPNSContractFoundError');

describe('endBlockHandlerFactory', () => {
  let endBlockHandler;
  let requestMock;
  let headerMock;
  let blockExecutionContextMock;
  let dpnsContractId;
  let dpnsContractBlockHeight;
  let latestCoreChainLockMock;
  let loggerMock;
  let chainLockMock;

  beforeEach(function beforeEach() {
    headerMock = {
      coreChainLockedHeight: 2,
    };

    blockExecutionContextMock = new BlockExecutionContextMock(this.sinon);

    blockExecutionContextMock.hasDataContract.returns(true);
    blockExecutionContextMock.getHeader.returns(headerMock);

    chainLockMock = {
      height: 1,
      blockHash: Buffer.alloc(0),
      signature: Buffer.alloc(0),
    };

    latestCoreChainLockMock = {
      getChainLock: this.sinon.stub().returns(chainLockMock),
    };

    loggerMock = {
      debug: this.sinon.stub(),
      info: this.sinon.stub(),
      trace: this.sinon.stub(),
    };

    dpnsContractId = generateRandomIdentifier();
    dpnsContractBlockHeight = 2;

    endBlockHandler = endBlockHandlerFactory(
      blockExecutionContextMock,
      dpnsContractBlockHeight,
      dpnsContractId,
      latestCoreChainLockMock,
      loggerMock,
    );

    requestMock = {
      height: dpnsContractBlockHeight,
    };
  });

  it('should simply return a response if DPNS contract was not set', async () => {
    endBlockHandler = endBlockHandlerFactory(
      blockExecutionContextMock,
      undefined,
      undefined,
      latestCoreChainLockMock,
      loggerMock,
    );

    const response = await endBlockHandler(requestMock);

    expect(response).to.be.an.instanceOf(ResponseEndBlock);
    expect(response.toJSON()).to.be.empty();

    expect(blockExecutionContextMock.hasDataContract).to.not.have.been.called();
  });

  it('should return a response if DPNS contract is present at specified height', async () => {
    const response = await endBlockHandler(requestMock);

    expect(response).to.be.an.instanceOf(ResponseEndBlock);

    expect(response.toJSON()).to.be.empty();

    expect(blockExecutionContextMock.hasDataContract).to.have.been.calledOnceWithExactly(
      dpnsContractId,
    );
  });

  it('should throw and error if DPNS contract is not present at specified height', async () => {
    blockExecutionContextMock.hasDataContract.returns(false);

    try {
      await endBlockHandler(requestMock);

      expect.fail('Error was not thrown');
    } catch (e) {
      expect(e).to.be.an.instanceOf(NoDPNSContractFoundError);
      expect(e.getContractId()).to.equal(dpnsContractId);
      expect(e.getHeight()).to.equal(dpnsContractBlockHeight);

      expect(blockExecutionContextMock.hasDataContract).to.have.been.calledOnceWithExactly(
        dpnsContractId,
      );

      expect(latestCoreChainLockMock.getChainLock).to.have.not.been.called();
    }
  });

  it('should return nextCoreChainLockUpdate if latestCoreChainLock above header height', async () => {
    chainLockMock.height = 3;

    const response = await endBlockHandler(requestMock);

    expect(latestCoreChainLockMock.getChainLock).to.have.been.calledOnceWithExactly();

    const expectedCoreChainLock = new CoreChainLock({
      coreBlockHeight: chainLockMock.height,
      coreBlockHash: chainLockMock.blockHash,
      signature: chainLockMock.signature,
    });

    expect(response.nextCoreChainLockUpdate).to.deep.equal(expectedCoreChainLock);
  });
});
