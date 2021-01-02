const {
  tendermint: {
    abci: {
      ResponseQuery,
    },
  },
} = require('@xazab/abci/types');
const cbor = require('cbor');

const getIdentityFixture = require('@xazab/dpp/lib/test/fixtures/getIdentityFixture');

const identityQueryHandlerFactory = require('../../../../../lib/abci/handlers/query/identityQueryHandlerFactory');

const NotFoundAbciError = require('../../../../../lib/abci/errors/NotFoundAbciError');
const AbciError = require('../../../../../lib/abci/errors/AbciError');

describe('identityQueryHandlerFactory', () => {
  let identityQueryHandler;
  let previousIdentityRepositoryMock;
  let identity;
  let params;
  let data;
  let previousRootTreeMock;
  let previousIdentitiesStoreRootTreeLeafMock;

  beforeEach(function beforeEach() {
    previousIdentityRepositoryMock = {
      fetch: this.sinon.stub(),
    };

    previousRootTreeMock = {
      getFullProof: this.sinon.stub(),
    };

    previousIdentitiesStoreRootTreeLeafMock = this.sinon.stub();

    identityQueryHandler = identityQueryHandlerFactory(
      previousIdentityRepositoryMock,
      previousRootTreeMock,
      previousIdentitiesStoreRootTreeLeafMock,
    );

    identity = getIdentityFixture();

    params = {};
    data = {
      id: identity.getId(),
    };
  });

  it('should return serialized identity', async () => {
    previousIdentityRepositoryMock.fetch.resolves(identity);

    const result = await identityQueryHandler(params, data, {});

    expect(previousIdentityRepositoryMock.fetch).to.be.calledOnceWith(data.id);
    expect(result).to.be.an.instanceof(ResponseQuery);
    expect(result.code).to.equal(0);
    expect(result.value).to.deep.equal(cbor.encode({
      data: identity.toBuffer(),
    }));
  });

  it('should throw NotFoundAbciError if identity not found', async () => {
    try {
      await identityQueryHandler(params, data, {});

      expect.fail('should throw NotFoundAbciError');
    } catch (e) {
      expect(e).to.be.an.instanceof(NotFoundAbciError);
      expect(e.getCode()).to.equal(AbciError.CODES.NOT_FOUND);
      expect(e.message).to.equal('Identity not found');
      expect(previousIdentityRepositoryMock.fetch).to.be.calledOnceWith(data.id);
    }
  });

  it('should return serialized identity with proof', async () => {
    const proof = {
      rootTreeProof: Buffer.from('0100000001f0faf5f55674905a68eba1be2f946e667c1cb5010101', 'hex'),
      storeTreeProof: Buffer.from('03046b657931060076616c75653103046b657932060076616c75653210', 'hex'),
    };

    previousIdentityRepositoryMock.fetch.resolves(identity);
    previousRootTreeMock.getFullProof.returns(proof);

    const result = await identityQueryHandler(params, data, { prove: 'true' });
    expect(previousIdentityRepositoryMock.fetch).to.be.calledOnceWith(data.id);
    expect(result).to.be.an.instanceof(ResponseQuery);
    expect(result.code).to.equal(0);

    const value = {
      data: identity.toBuffer(),
      proof,
    };

    expect(result.value).to.deep.equal(cbor.encode(value));
    expect(previousRootTreeMock.getFullProof).to.be.calledOnceWith(
      previousIdentitiesStoreRootTreeLeafMock,
      [identity.getId()],
    );
  });
});
