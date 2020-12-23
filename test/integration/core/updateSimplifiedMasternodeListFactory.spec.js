const { startMongoDb, startXazabCore } = require('@xazab/dp-services-ctl');
const SimplifiedMNListStore = require('@xazab/xazabcore-lib/lib/deterministicmnlist/SimplifiedMNListStore');

const createTestDIContainer = require('../../../lib/test/createTestDIContainer');

describe('updateSimplifiedMasternodeListFactory', function main() {
  this.timeout(90000);

  let mongoDB;
  let container;
  let xazabCore;

  before(async () => {
    mongoDB = await startMongoDb();
  });

  after(async () => {
    await mongoDB.remove();
    if (xazabCore) {
      await xazabCore.remove();
    }
  });

  afterEach(async () => {
    if (container) {
      await container.dispose();
    }
  });

  it('should wait until SML will be retrieved', async () => {
    xazabCore = await startXazabCore();

    container = await createTestDIContainer(mongoDB, xazabCore);

    const simplifiedMasternodeList = container.resolve('simplifiedMasternodeList');

    expect(simplifiedMasternodeList.getStore()).to.equal(undefined);

    const { result: randomAddress } = await xazabCore.getApi().getNewAddress();

    await xazabCore.getApi().generateToAddress(1000, randomAddress);

    const updateSimplifiedMasternodeList = container.resolve('updateSimplifiedMasternodeList');

    await updateSimplifiedMasternodeList(1000);

    expect(simplifiedMasternodeList.getStore())
      .to.be.an.instanceOf(SimplifiedMNListStore);
  });
});
