const { startMongoDb, startXazabCore } = require('@xazab/dp-services-ctl');

const createTestDIContainer = require('../../../lib/test/createTestDIContainer');

describe('detectStandaloneRegtestModeFactory', function main() {
  this.timeout(90000);

  let mongoDB;
  let container;
  let firstXazabCore;
  let secondXazabCore;

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
  });

  afterEach(async () => {
    if (container) {
      await container.dispose();
    }
  });

  it('should return true if chain is regtest and has no peers', async () => {
    firstXazabCore = await startXazabCore();

    container = await createTestDIContainer(mongoDB, firstXazabCore);

    const detectStandaloneRegtestMode = container.resolve('detectStandaloneRegtestMode');

    const result = await detectStandaloneRegtestMode();

    expect(result).to.be.true();
  });

  it('should return false if peers count > 0', async () => {
    firstXazabCore = await startXazabCore();

    secondXazabCore = await startXazabCore();
    await secondXazabCore.connect(firstXazabCore);

    container = await createTestDIContainer(mongoDB, firstXazabCore);

    const detectStandaloneRegtestMode = container.resolve('detectStandaloneRegtestMode');

    const result = await detectStandaloneRegtestMode();

    expect(result).to.be.false();
  });
});
