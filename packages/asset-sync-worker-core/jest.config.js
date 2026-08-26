const merge = require('deepmerge');
const path = require('path');

const baseConfig = require('../../jest.config.packages');

module.exports = merge(baseConfig, {
  displayName: path.basename(__dirname),
});
