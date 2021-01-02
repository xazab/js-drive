const {
  tendermint: {
    abci: {
      ResponseQuery,
    },
  },
} = require('@xazab/abci/types');

const cbor = require('cbor');

const NotFoundAbciError = require('../../errors/NotFoundAbciError');

/**
 *
 * @param {DataContractStoreRepository} previousDataContractRepository
 * @param {RootTree} previousRootTree
 * @param {DataContractsStoreRootTreeLeaf} previousDataContractsStoreRootTreeLeaf
 * @return {dataContractQueryHandler}
 */
function dataContractQueryHandlerFactory(
  previousDataContractRepository,
  previousRootTree,
  previousDataContractsStoreRootTreeLeaf,
) {
  /**
   * @typedef dataContractQueryHandler
   * @param {Object} params
   * @param {Object} data
   * @param {Buffer} data.id
   * @param {Object} request
   * @param {boolean} [request.prove]
   * @return {Promise<ResponseQuery>}
   */
  async function dataContractQueryHandler(params, { id }, request) {
    const dataContract = await previousDataContractRepository.fetch(id);

    if (!dataContract) {
      throw new NotFoundAbciError('Data Contract not found');
    }

    const includeProof = request.prove === 'true';

    const value = {
      data: dataContract.toBuffer(),
    };

    if (includeProof) {
      value.proof = previousRootTree.getFullProof(previousDataContractsStoreRootTreeLeaf, [id]);
    }

    return new ResponseQuery({
      value: cbor.encode(value),
    });
  }

  return dataContractQueryHandler;
}

module.exports = dataContractQueryHandlerFactory;
