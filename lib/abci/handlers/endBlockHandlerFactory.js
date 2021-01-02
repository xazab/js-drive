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

const NoDPNSContractFoundError = require('./errors/NoDPNSContractFoundError');
const NoXazabContractFoundError = require('./errors/NoXazabContractFoundError');

/**
 * Begin block ABCI handler
 *
 * @param {BlockExecutionContext} blockExecutionContext
 * @param {number|undefined} dpnsContractBlockHeight
 * @param {Identifier|undefined} dpnsContractId
 * @param {number|undefined} xazabContractBlockHeight
 * @param {Identifier|undefined} xazabContractId
 * @param {LatestCoreChainLock} latestCoreChainLock
 * @param {BaseLogger} logger
 *
 * @return {endBlockHandler}
 */
function endBlockHandlerFactory(
  blockExecutionContext,
  dpnsContractBlockHeight,
  dpnsContractId,
  xazabContractBlockHeight,
  xazabContractId,
  latestCoreChainLock,
  logger,
) {
  /**
   * @typedef endBlockHandler
   *
   * @param {abci.RequestBeginBlock} request
   *
   * @return {Promise<abci.ResponseBeginBlock>}
   */
  async function endBlockHandler({ height }) {
    logger.info(`Block end #${height}`);

    if (dpnsContractId && height === dpnsContractBlockHeight) {
      if (!blockExecutionContext.hasDataContract(dpnsContractId)) {
        throw new NoDPNSContractFoundError(dpnsContractId, dpnsContractBlockHeight);
      }
    }

    if (xazabContractId && height === xazabContractBlockHeight) {
      if (!blockExecutionContext.hasDataContract(xazabContractId)) {
        throw new NoXazabContractFoundError(xazabContractId, xazabContractBlockHeight);
      }
    }

    const header = blockExecutionContext.getHeader();
    const coreChainLock = latestCoreChainLock.getChainLock();

    if (coreChainLock && coreChainLock.height > header.coreChainLockedHeight) {
      logger.trace(`Provide next chain lock for height ${coreChainLock.height}`);

      return new ResponseEndBlock({
        nextCoreChainLockUpdate: new CoreChainLock({
          coreBlockHeight: coreChainLock.height,
          coreBlockHash: coreChainLock.blockHash,
          signature: coreChainLock.signature,
        }),
      });
    }

    return new ResponseEndBlock();
  }

  return endBlockHandler;
}

module.exports = endBlockHandlerFactory;
