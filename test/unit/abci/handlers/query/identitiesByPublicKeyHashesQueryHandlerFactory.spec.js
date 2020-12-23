const cbor = require('cbor');

const {
  tendermint: {
    abci: {
      ResponseQuery,
    },
  },
} = require('@xazab/abci/types');

const getIdentityFixture = require('@xazab/dpp/lib/test/fixtures/getIdentityFixture');

const identitiesByPublicKeyHashesQueryHandlerFactory = require(
  '../../../../../lib/abci/handlers/query/identitiesByPublicKeyHashesQueryHandlerFactory',
);
const InvalidArgumentAbciError = require(
  '../../../../../lib/abci/errors/InvalidArgumentAbciError',
);

describe('identitiesByPublicKeyHashesQueryHandlerFactory', () => {
  let identitiesByPublicKeyHashesQueryHandler;
  let previousPublicKeyIdentityIdRepositoryMock;
  let previousIdentityRepositoryMock;
  let publicKeyHashes;
  let identities;
  let identitiesByPublicKeyHashes;
  let maxIdentitiesPerRequest;
  let previousRootTreeMock;
  let previousIdentitiesStoreRootTreeLeafMock;

  beforeEach(function beforeEach() {
    previousPublicKeyIdentityIdRepositoryMock = {
      fetch: this.sinon.stub(),
    };

    previousIdentityRepositoryMock = {
      fetch: this.sinon.stub(),
    };

    previousRootTreeMock = {
      getFullProof: this.sinon.stub(),
    };

    previousIdentitiesStoreRootTreeLeafMock = this.sinon.stub();

    maxIdentitiesPerRequest = 5;

    identitiesByPublicKeyHashesQueryHandler = identitiesByPublicKeyHashesQueryHandlerFactory(
      previousPublicKeyIdentityIdRepositoryMock,
      previousIdentityRepositoryMock,
      maxIdentitiesPerRequest,
      previousRootTreeMock,
      previousIdentitiesStoreRootTreeLeafMock,
    );

    publicKeyHashes = [
      Buffer.from('784ca12495d2e61f992db9e55d1f9599b0cf1328', 'hex'),
      Buffer.from('784ca12495d2e61f992db9e55d1f9599b0cf1329', 'hex'),
      Buffer.from('784ca12495d2e61f992db9e55d1f9599b0cf1330', 'hex'),
    ];

    identities = [
      getIdentityFixture(),
      getIdentityFixture(),
    ];

    previousPublicKeyIdentityIdRepositoryMock
      .fetch
      .withArgs(publicKeyHashes[0])
      .resolves(identities[0].getId());

    previousPublicKeyIdentityIdRepositoryMock
      .fetch
      .withArgs(publicKeyHashes[1])
      .resolves(identities[1].getId());

    previousIdentityRepositoryMock.fetch
      .withArgs(identities[0].getId())
      .resolves(identities[0]);

    previousIdentityRepositoryMock.fetch
      .withArgs(identities[0].getId())
      .resolves(identities[1]);

    identitiesByPublicKeyHashes = [
      identities[0].toBuffer(),
      identities[1].toBuffer(),
      Buffer.alloc(0),
    ];
  });

  it('should throw an error if maximum requested items exceeded', async () => {
    const params = {};
    const data = { publicKeyHashes };

    maxIdentitiesPerRequest = 1;

    identitiesByPublicKeyHashesQueryHandler = identitiesByPublicKeyHashesQueryHandlerFactory(
      previousPublicKeyIdentityIdRepositoryMock,
      previousIdentityRepositoryMock,
      maxIdentitiesPerRequest,
    );

    try {
      await identitiesByPublicKeyHashesQueryHandler(params, data, {});
      expect.fail('Error was not thrown');
    } catch (e) {
      expect(e).to.be.an.instanceOf(InvalidArgumentAbciError);
      expect(e.getData()).to.deep.equal({
        maxIdentitiesPerRequest,
      });
    }
  });

  it('should return identity id map', async () => {
    const params = {};
    const data = { publicKeyHashes };

    const result = await identitiesByPublicKeyHashesQueryHandler(params, data, {});

    expect(previousPublicKeyIdentityIdRepositoryMock.fetch.callCount).to.equal(
      publicKeyHashes.length,
    );

    expect(previousPublicKeyIdentityIdRepositoryMock.fetch.getCall(0).args).to.deep.equal([
      publicKeyHashes[0],
    ]);

    expect(previousPublicKeyIdentityIdRepositoryMock.fetch.getCall(1).args).to.deep.equal([
      publicKeyHashes[1],
    ]);

    expect(previousPublicKeyIdentityIdRepositoryMock.fetch.getCall(2).args).to.deep.equal([
      publicKeyHashes[2],
    ]);

    expect(previousIdentityRepositoryMock.fetch.callCount).to.equal(
      identities.length,
    );

    expect(previousIdentityRepositoryMock.fetch.getCall(0).args).to.deep.equal([
      identities[0].getId(),
    ]);

    expect(previousIdentityRepositoryMock.fetch.getCall(1).args).to.deep.equal([
      identities[1].getId(),
    ]);

    const value = await cbor.encodeAsync({ data: identitiesByPublicKeyHashes });

    expect(result).to.be.an.instanceof(ResponseQuery);
    expect(result.code).to.equal(0);
    expect(result.value).to.deep.equal(value);
  });

  it('should return identity id map with proof', async () => {
    const params = {};
    const data = { publicKeyHashes };
    const proof = {
      rootTreeProof: Buffer.from('0100000001f0faf5f55674905a68eba1be2f946e667c1cb5010101', 'hex'),
      storeTreeProof: Buffer.from('03046b657931060076616c75653103046b657932060076616c75653210', 'hex'),
    };

    previousRootTreeMock.getFullProof.returns(proof);

    const result = await identitiesByPublicKeyHashesQueryHandler(params, data, { prove: 'true' });

    expect(previousPublicKeyIdentityIdRepositoryMock.fetch.callCount).to.equal(
      publicKeyHashes.length,
    );

    expect(previousPublicKeyIdentityIdRepositoryMock.fetch.getCall(0).args).to.deep.equal([
      publicKeyHashes[0],
    ]);

    expect(previousPublicKeyIdentityIdRepositoryMock.fetch.getCall(1).args).to.deep.equal([
      publicKeyHashes[1],
    ]);

    expect(previousPublicKeyIdentityIdRepositoryMock.fetch.getCall(2).args).to.deep.equal([
      publicKeyHashes[2],
    ]);

    expect(previousIdentityRepositoryMock.fetch.callCount).to.equal(
      identities.length,
    );

    expect(previousIdentityRepositoryMock.fetch.getCall(0).args).to.deep.equal([
      identities[0].getId(),
    ]);

    expect(previousIdentityRepositoryMock.fetch.getCall(1).args).to.deep.equal([
      identities[1].getId(),
    ]);

    const value = {
      data: identitiesByPublicKeyHashes,
      proof,
    };

    const identityIds = identities.map((identity) => identity.getId());

    expect(result).to.be.an.instanceof(ResponseQuery);
    expect(result.code).to.equal(0);
    expect(result.value).to.deep.equal(await cbor.encodeAsync(value));
    expect(previousRootTreeMock.getFullProof).to.be.calledOnce();
    expect(previousRootTreeMock.getFullProof.getCall(0).args).to.deep.equal([
      previousIdentitiesStoreRootTreeLeafMock,
      identityIds,
    ]);
  });
});
