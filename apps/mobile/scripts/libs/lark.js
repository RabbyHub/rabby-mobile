const fs = require('fs');
const path = require('path');
const { createHmac } = require('crypto');
// @see https://www.npmjs.com/package/qrcode
const QRCode = require('qrcode');
const FormData = require('form-data'); // npm install --save form-data
const Axios = require('axios');

const { RABBY_ROBOT_LARK_APP_ID, RABBY_ROBOT_LARK_APP_SECRET } = process.env;
if (!RABBY_ROBOT_LARK_APP_ID) {
  throw new Error('RABBY_ROBOT_LARK_APP_ID is not set');
}
if (!RABBY_ROBOT_LARK_APP_SECRET) {
  throw new Error('RABBY_ROBOT_LARK_APP_SECRET is not set');
}

async function getLarkToken() {
  const resp = await Axios.post(
    'https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal/',
    {
      app_id: RABBY_ROBOT_LARK_APP_ID,
      app_secret: RABBY_ROBOT_LARK_APP_SECRET,
    },
  );

  return resp.data.tenant_access_token;
}
exports.getLarkToken = getLarkToken;

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
