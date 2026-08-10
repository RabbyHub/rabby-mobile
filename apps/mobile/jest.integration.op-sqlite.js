const unavailable = () => {
  throw new Error(
    'The native op-sqlite module is unavailable in Node integration tests. Use the Node in-memory SQLite driver or a Hermes device scenario.',
  );
};

module.exports = {
  ANDROID_DATABASE_PATH: '',
  ANDROID_FILES_PATH: '',
  IOS_LIBRARY_PATH: '',
  open: unavailable,
};
