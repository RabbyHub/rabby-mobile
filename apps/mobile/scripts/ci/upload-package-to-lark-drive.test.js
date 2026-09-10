/* eslint-env jest */

const fs = require('fs');
const os = require('os');
const path = require('path');
const nock = require('nock');

const testEnv = process.env;
Object.assign(testEnv, {
  RABBY_ROBOT_LARK_APP_ID: 'test-app-id',
  RABBY_ROBOT_LARK_APP_SECRET: 'test-app-secret',
});

const { uploadFileToLarkDrive } = require('../libs/lark');

describe('uploadFileToLarkDrive', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  test('uploads a package through prepare, parts, and finish', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lark-drive-test-'));
    const filePath = path.join(tempDir, 'package.apk');
    fs.writeFileSync(filePath, '0123456789');

    nock('https://open.larksuite.com')
      .post('/open-apis/auth/v3/tenant_access_token/internal/', {
        app_id: 'test-app-id',
        app_secret: 'test-app-secret',
      })
      .reply(200, {
        code: 0,
        tenant_access_token: 'test-tenant-token',
      })
      .post('/open-apis/drive/v1/files/upload_prepare', {
        file_name: 'package.apk',
        parent_type: 'explorer',
        parent_node: '',
        size: 10,
      })
      .reply(200, {
        code: 0,
        data: {
          upload_id: 'test-upload-id',
          block_size: 4,
          block_num: 3,
        },
      })
      .post('/open-apis/drive/v1/files/upload_part')
      .times(3)
      .reply(200, { code: 0 })
      .post('/open-apis/drive/v1/files/upload_finish', {
        upload_id: 'test-upload-id',
        block_num: 3,
      })
      .reply(200, {
        code: 0,
        data: { file_token: 'test-file-token' },
      });

    const progress = [];
    const result = await uploadFileToLarkDrive(filePath, {
      fileName: 'package.apk',
      onProgress: value => progress.push(value),
    });

    expect(result).toEqual({
      fileToken: 'test-file-token',
      url: 'https://debankglobal.sg.larksuite.com/file/test-file-token',
      size: 10,
      blockCount: 3,
    });
    expect(progress.map(value => value.uploadedBytes)).toEqual([4, 8, 10]);
    expect(nock.isDone()).toBe(true);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
