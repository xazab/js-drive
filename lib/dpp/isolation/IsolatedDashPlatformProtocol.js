const XazabPlatformProtocol = require('@xazab/dpp');

class IsolatedXazabPlatformProtocol extends XazabPlatformProtocol {
  /**
   * @param {Isolate} isolate
   * @param {Object} options
   * @param {StateRepository} options.stateRepository
   * @param {JsonSchemaValidator} options.jsonSchemaValidator
   */
  constructor(isolate, options) {
    super(options);

    this.isolate = isolate;
  }

  /**
   * Get Isolate
   *
   * @return {Isolate}
   */
  getIsolate() {
    return this.isolate;
  }

  /**
   * Dispose isolation
   */
  dispose() {
    this.getIsolate().dispose();
  }
}

module.exports = IsolatedXazabPlatformProtocol;
