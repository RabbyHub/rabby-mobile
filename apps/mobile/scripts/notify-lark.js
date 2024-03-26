#!/usr/bin/env node

const Axios = require('axios');

const {
  getLarkToken,
  makeSign,
  generateQRCodeImageBuffer,
  uploadImageToLark,
} = require('./libs/lark');

const chatURL = process.env.LARK_CHAT_URL;
if (!chatURL) {
  throw new Error('LARK_CHAT_URL is not set');
}
const chatSecret = process.env.LARK_CHAT_SECRET;
if (!chatSecret) {
  throw new Error('LARK_CHAT_SECRET is not set');
}

// sendMessage with axios
async function sendMessage({
  platform = 'android',
  downloadURL = '',
  actionsJobUrl = '',
  gitCommitURL = '',
  gitRefURL = '',
  triggers = [],
}) {
  const { timeSec, Signature } = makeSign(chatSecret);

  // dedupe
  triggers = [...new Set(triggers)];

  const headers = {
    'Content-Type': 'application/json',
    Signature: Signature,
  };

  const platformName = platform
    .replace('android', 'Android')
    .replace('ios', 'iOS');

  const qrcodeImgBuf = await generateQRCodeImageBuffer(downloadURL);
  const image_key = await uploadImageToLark(qrcodeImgBuf);

  const body = {
    timestamp: timeSec,
    sign: Signature,
    // msg_type: 'text',
    // content: {
    //     text: message,
    // },
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title: `📱 [${platformName}] Rabby Mobile 预览包已生成 🚀 `,
          content: [
            platform !== 'ios' && [
              { tag: 'text', text: `下载链接: ` },
              { tag: 'a', href: downloadURL, text: downloadURL },
            ],
            [
              { tag: 'text', text: `二维码，拿 📱 扫一下 🔽` },
              { tag: 'img', image_key },
            ],
            // [
            //   { tag: 'img', image_key: 'img_1' },
            // ]
            [{ tag: 'text', text: `---------` }],
            [
              { tag: 'text', text: `Actions Job: ` },
              { tag: 'a', href: actionsJobUrl, text: actionsJobUrl },
            ],
            [
              { tag: 'text', text: `Git Commit: ` },
              { tag: 'a', href: gitCommitURL, text: gitCommitURL },
            ],
            gitRefURL && [
              { tag: 'text', text: `Git Ref: ` },
              { tag: 'text', text: gitRefURL },
            ],
            triggers.length && [
              { tag: 'text', text: `Triggers: ` },
              { tag: 'text', text: triggers.join(', ') },
            ],
          ].filter(Boolean),
        },
      },
    },
  };

  const res = await Axios.post(chatURL, body, { headers });
  console.log(res.data);
}

const args = process.argv.slice(2);

if (!process.env.CI && args[0] === 'get-token') {
  getLarkToken().then(accessToken => {
    console.log(`[notify-lark] get-token accessToken: ${accessToken}`);
  });
} else if (args[0]) {
  sendMessage({
    downloadURL: args[0],
    platform: args[1],
    actionsJobUrl: process.env.GIT_ACTIONS_JOB_URL,
    gitCommitURL: process.env.GIT_COMMIT_URL,
    gitRefURL: process.env.GIT_REF_URL,
    triggers: [
      process.env.GITHUB_TRIGGERING_ACTOR,
      process.env.GITHUB_ACTOR,
    ].filter(Boolean),
  });
} else {
  console.log('[notify-lark] no message');
}
