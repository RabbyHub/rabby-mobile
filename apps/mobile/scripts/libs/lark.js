const fs = require('fs');
const path = require('path');
const { createHmac } = require('crypto');
const { Buffer } = require('buffer');
// @see https://www.npmjs.com/package/qrcode
const QRCode = require('qrcode');
const FormData = require('form-data'); // npm install --save form-data
const Axios = require('axios');

const LARK_OPEN_API_BASE_URL = 'https://open.larksuite.com/open-apis';
const LARK_DRIVE_FILE_URL_BASE = (
  process.env.RABBY_MOBILE_LARK_DRIVE_FILE_URL_BASE ||
  'https://debankglobal.sg.larksuite.com/file'
).replace(/\/+$/, '');

const { RABBY_ROBOT_LARK_APP_ID, RABBY_ROBOT_LARK_APP_SECRET } = process.env;
if (!RABBY_ROBOT_LARK_APP_ID) {
  throw new Error('RABBY_ROBOT_LARK_APP_ID is not set');
}
if (!RABBY_ROBOT_LARK_APP_SECRET) {
  throw new Error('RABBY_ROBOT_LARK_APP_SECRET is not set');
}

async function getLarkToken() {
  const resp = await Axios.post(
    `${LARK_OPEN_API_BASE_URL}/auth/v3/tenant_access_token/internal/`,
    {
      app_id: RABBY_ROBOT_LARK_APP_ID,
      app_secret: RABBY_ROBOT_LARK_APP_SECRET,
    },
  );

  const body = assertLarkSuccess(resp, 'tenant access token');
  const accessToken =
    body.tenant_access_token || (body.data && body.data.tenant_access_token);
  if (!accessToken) {
    throw new Error('[lark] tenant access token response is missing a token');
  }

  return accessToken;
}
exports.getLarkToken = getLarkToken;

function assertLarkSuccess(response, operation) {
  const body = response && response.data;
  const code = body && body.code;
  if (Number(code) !== 0) {
    const message = String((body && body.msg) || 'unknown error').slice(0, 200);
    throw new Error(
      `[lark] ${operation} failed: code=${String(
        code === undefined ? 'unknown' : code,
      )} message=${message}`,
    );
  }
  return body;
}

function getLarkApiOptions(accessToken) {
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  };
}

/**
 * Upload a package to the bot's Drive root using the multipart API.
 * The API requires 4 MB-sized chunks for files over 20 MB.
 */
async function uploadFileToLarkDrive(
  filePath,
  { fileName = path.basename(filePath), onProgress } = {},
) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`[lark] package path is not a file: ${filePath}`);
  }

  const accessToken = await getLarkToken();
  const requestOptions = getLarkApiOptions(accessToken);
  const prepareResponse = await Axios.post(
    `${LARK_OPEN_API_BASE_URL}/drive/v1/files/upload_prepare`,
    {
      file_name: path.basename(fileName),
      parent_type: 'explorer',
      parent_node: '',
      size: stat.size,
    },
    requestOptions,
  );
  const prepare = assertLarkSuccess(prepareResponse, 'Drive upload prepare');
  const uploadId = prepare.data && prepare.data.upload_id;
  const blockSize = Number(prepare.data && prepare.data.block_size);
  const blockNum = Number(prepare.data && prepare.data.block_num);

  if (!uploadId || !Number.isSafeInteger(blockSize) || blockSize <= 0) {
    throw new Error(
      '[lark] Drive upload prepare returned an invalid block plan',
    );
  }
  if (!Number.isSafeInteger(blockNum) || blockNum <= 0) {
    throw new Error(
      '[lark] Drive upload prepare returned an invalid block count',
    );
  }

  const fileDescriptor = fs.openSync(filePath, 'r');
  let uploadedBytes = 0;
  try {
    for (let seq = 0; seq < blockNum; seq += 1) {
      const remainingBytes = stat.size - uploadedBytes;
      const partSize = Math.min(blockSize, remainingBytes);
      if (partSize <= 0) {
        throw new Error('[lark] Drive upload block plan exceeded file size');
      }

      const part = Buffer.allocUnsafe(partSize);
      let bytesRead = 0;
      while (bytesRead < partSize) {
        const read = fs.readSync(
          fileDescriptor,
          part,
          bytesRead,
          partSize - bytesRead,
          uploadedBytes + bytesRead,
        );
        if (read === 0) {
          throw new Error('[lark] package changed while uploading to Drive');
        }
        bytesRead += read;
      }

      const form = new FormData();
      form.append('upload_id', uploadId);
      form.append('seq', String(seq));
      form.append('size', String(partSize));
      form.append('file', part, {
        filename: path.basename(fileName),
        contentType: 'application/octet-stream',
        knownLength: partSize,
      });

      const partResponse = await Axios.post(
        `${LARK_OPEN_API_BASE_URL}/drive/v1/files/upload_part`,
        form,
        {
          ...requestOptions,
          headers: {
            ...requestOptions.headers,
            ...form.getHeaders(),
          },
        },
      );
      assertLarkSuccess(partResponse, `Drive upload block ${seq + 1}`);
      uploadedBytes += partSize;
      if (onProgress) {
        onProgress({
          blockNumber: seq + 1,
          blockCount: blockNum,
          uploadedBytes,
          totalBytes: stat.size,
        });
      }
    }
  } finally {
    fs.closeSync(fileDescriptor);
  }

  if (uploadedBytes !== stat.size) {
    throw new Error('[lark] Drive upload did not consume the complete package');
  }

  const finishResponse = await Axios.post(
    `${LARK_OPEN_API_BASE_URL}/drive/v1/files/upload_finish`,
    {
      upload_id: uploadId,
      block_num: blockNum,
    },
    requestOptions,
  );
  const finish = assertLarkSuccess(finishResponse, 'Drive upload finish');
  const fileToken = finish.data && finish.data.file_token;
  if (!fileToken) {
    throw new Error('[lark] Drive upload finish did not return a file token');
  }

  return {
    fileToken,
    url: `${LARK_DRIVE_FILE_URL_BASE}/${encodeURIComponent(fileToken)}`,
    size: stat.size,
    blockCount: blockNum,
  };
}
exports.uploadFileToLarkDrive = uploadFileToLarkDrive;

function makeSign(secret) {
  const timestamp = Date.now();
  const timeSec = Math.floor(timestamp / 1000);
  const stringToSign = `${timeSec}\n${secret}`;
  const hash = createHmac('sha256', stringToSign).digest();

  const Signature = hash.toString('base64');

  return {
    timeSec,
    Signature,
  };
}
exports.makeSign = makeSign;

async function generateQRCodeImageBuffer(text) {
  return new Promise((resolve, reject) => {
    QRCode.toBuffer(text, (err, buffer) => {
      if (err) {
        reject(err);
      } else {
        resolve(buffer);
      }
    });
  });
}
exports.generateQRCodeImageBuffer = generateQRCodeImageBuffer;

/**
 * @sample
 *
    curl --location --request POST 'https://open.larksuite.com/open-apis/im/v1/images' \
    --header 'Content-Type: multipart/form-data' \
    --header 'Authorization: Bearer $RABBY_BOT_LARK_ACCESS_TOKEN' \
    --form 'image_type="message"' \
    --form 'image=@file_path'

    response: {"code":0,"data":{"image_key":"key"},"msg":"success"}
 */
async function uploadImageToLark(imageBuffer) {
  const accessToken = await getLarkToken();
  const headers = {
    'Content-Type': 'multipart/form-data',
    Authorization: `Bearer ${accessToken}`,
  };

  const form = new FormData();
  form.append('image_type', 'message');
  form.append('image', imageBuffer);

  const res = await Axios.post(
    'https://open.larksuite.com/open-apis/im/v1/images',
    form,
    { headers },
  );

  if (res.data.code !== 0) {
    throw new Error('upload image to lark failed');
  }

  return res.data.data.image_key;
}
exports.uploadImageToLark = uploadImageToLark;
