const { Isolate } = require('isolated-vm');

const dataContractMetaSchema = require('@xazab/dpp/schema/dataContract/dataContractMeta');

const dataContractFixture = require('@xazab/dpp/lib/test/fixtures/getDataContractFixture');

const compileJsonSchemaValidatorCode = require('./compileJsonSchemaValidatorCode');

/**
 * @return {Promise<ExternalCopy<ArrayBuffer>>}
 */
async function createIsolatedValidatorSnapshot() {
  const jsonSchemaValidatorCode = await compileJsonSchemaValidatorCode();

  const dataContractSchema = dataContractFixture().toJSON();
  const warmUpCode = `
    jsonSchemaValidator.validate(
      ${JSON.stringify(dataContractMetaSchema)},
      ${JSON.stringify(dataContractSchema)},
    );
  `;

  return Isolate.createSnapshot([
    { code: jsonSchemaValidatorCode },
  ], warmUpCode);
}

module.exports = createIsolatedValidatorSnapshot;
