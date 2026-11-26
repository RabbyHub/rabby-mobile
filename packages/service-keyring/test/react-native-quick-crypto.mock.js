const crypto = require('crypto');

module.exports = {
  pbkdf2: crypto.pbkdf2,
  pbkdf2Sync: crypto.pbkdf2Sync,
};
