const { expect } = require('chai');
const sanitizeUrl = require('../../../lib/util/sanitizeUrl');

describe('sanitizeUrl', () => {
  it('should sanitize an url', () => {
    const sanitized = sanitizeUrl('https://xazab.xyz?something=true');
    expect(sanitized).to.equal('https://xazab.xyz');
  });
  it('should handle non RFC path', () => {
    const sanitized = sanitizeUrl('/foo;jsessionid=123456');
    expect(sanitized).to.equal('/foo');
  });
});
