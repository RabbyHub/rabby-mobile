import {
  expectedTestAccountsPath,
  isAllowedTestAccountsPath,
} from './testAccountsPath';

describe('testAccountsPath', () => {
  it('accepts the fixed file inside the app container', () => {
    const docs = '/var/mobile/Containers/Data/Application/ABC/Documents';
    expect(
      isAllowedTestAccountsPath(`${docs}/kpi-test-accounts.txt`, docs),
    ).toBe(true);
  });

  it('accepts the /sdcard alias for the Android external files dir', () => {
    const external =
      '/storage/emulated/0/Android/data/com.debank.rabbymobile.regression/files';
    expect(
      isAllowedTestAccountsPath(
        '/sdcard/Android/data/com.debank.rabbymobile.regression/files/kpi-test-accounts.txt',
        external,
      ),
    ).toBe(true);
  });

  it('rejects traversal and other file names', () => {
    const docs = '/var/mobile/Containers/Data/Application/ABC/Documents';
    expect(
      isAllowedTestAccountsPath(`${docs}/../Library/Preferences/x.plist`, docs),
    ).toBe(false);
    expect(isAllowedTestAccountsPath(`${docs}/other.txt`, docs)).toBe(false);
  });

  it('rejects a path outside the app-owned directory', () => {
    const docs = '/var/mobile/Containers/Data/Application/ABC/Documents';
    expect(
      isAllowedTestAccountsPath(
        '/var/mobile/Containers/Data/Application/XYZ/Documents/kpi-test-accounts.txt',
        docs,
      ),
    ).toBe(false);
  });

  it('builds the expected path without a duplicated slash', () => {
    expect(expectedTestAccountsPath('/tmp/abc/')).toBe(
      '/tmp/abc/kpi-test-accounts.txt',
    );
  });
});
