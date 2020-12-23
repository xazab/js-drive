const IsolatedXazabPlatformProtocol = require('./IsolatedXazabPlatformProtocol');
const bootstrapIsolateFromSnapshot = require('./bootstrapIsolateFromSnapshot');
const IsolatedJsonSchemaValidator = require('./IsolatedJsonSchemaValidator');

/**
 * @param {ExternalCopy<ArrayBuffer>} isolatedJsonSchemaValidatorSnapshot
 * @param {Object} isolatedSTUnserializationOptions
 * @param [isolatedSTUnserializationOptions.timeout] - Timeout ms
 * @param [isolatedSTUnserializationOptions.memoryLimit] - Memory limit mb
 * @param {StateRepository} stateRepository
 * @param {Object} dppOptions
 * @return {createIsolatedDpp}
 */
function createIsolatedDppFactory(
  isolatedJsonSchemaValidatorSnapshot,
  isolatedSTUnserializationOptions,
  stateRepository,
  dppOptions,
) {
  /**
   * @typedef {createIsolatedDpp}
   * @return {Promise<IsolatedXazabPlatformProtocol>}
   */
  async function createIsolatedDpp() {
    const { context, isolate } = await bootstrapIsolateFromSnapshot(
      isolatedJsonSchemaValidatorSnapshot,
      isolatedSTUnserializationOptions,
    );

    try {
      const jsonSchemaValidator = new IsolatedJsonSchemaValidator(
        context,
        isolatedSTUnserializationOptions.timeout,
      );

      return new IsolatedXazabPlatformProtocol(
        isolate, {
          ...dppOptions,
          stateRepository,
          jsonSchemaValidator,
        },
      );
    } catch (e) {
      if (!isolate.isDisposed) {
        isolate.dispose();
      }

      throw e;
    }
  }

  return createIsolatedDpp;
}

module.exports = createIsolatedDppFactory;
