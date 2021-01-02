const { startMongoDb, startXazabCore } = require('@xazab/dp-services-ctl');

const createTestDIContainer = require('../../../lib/test/createTestDIContainer');

describe('waitForCoreSyncFactory', function main() {
  this.timeout(90000);

  let mongoDB;
  let firstXazabCore;
  let secondXazabCore;
  let thirdXazabCore;
  let container;
  let waitForCoreSync;

  before(async () => {
    mongoDB = await startMongoDb();
  });

  after(async () => {
    await mongoDB.remove();
    if (firstXazabCore) {
      await firstXazabCore.remove();
    }

    if (secondXazabCore) {
      await secondXazabCore.remove();
    }

    if (thirdXazabCore) {
      await thirdXazabCore.remove();
    }
  });

  afterEach(async () => {
    if (container) {
      await container.dispose();
    }
  });

  it('should wait until Xazab Core in regtest mode with peers is synced', async () => {
    firstXazabCore = await startXazabCore();
    const { result: randomAddress } = await firstXazabCore.getApi().getNewAddress();
    await firstXazabCore.getApi().generateToAddress(1000, randomAddress);

    secondXazabCore = await startXazabCore();
    await secondXazabCore.connect(firstXazabCore);

    container = await createTestDIContainer(mongoDB, secondXazabCore);
    waitForCoreSync = container.resolve('waitForCoreSync');

    await waitForCoreSync(() => {});

    const secondApi = secondXazabCore.getApi();

    const {
      result: {
        blocks: currentBlockHeight,
        headers: currentHeadersNumber,
      },
    } = await secondApi.getBlockchainInfo();

    expect(currentBlockHeight).to.equal(1000);
    expect(currentHeadersNumber).to.equal(1000);
  });
});
