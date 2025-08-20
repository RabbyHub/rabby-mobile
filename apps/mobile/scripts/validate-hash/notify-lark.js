#!/usr/bin/env node

const Axios = require('axios');

const { getLarkToken, makeSign } = require('../libs/lark');

const chatURL =
  process.env.RABBY_MOBILE_LARK_CHAT_URL || process.env.LARK_CHAT_URL;
if (!chatURL) {
  throw new Error('RABBY_MOBILE_LARK_CHAT_URL is not set');
}
const chatSecret =
  process.env.RABBY_MOBILE_LARK_CHAT_SECRET || process.env.LARK_CHAT_SECRET;
if (!chatSecret) {
  throw new Error('RABBY_MOBILE_LARK_CHAT_SECRET is not set');
}

// sendMessage with axios
async function sendMessage({
  androidHash = '',
  iosHash = '',
  overallHash = '',
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

  let body = {
    timestamp: timeSec,
    sign: Signature,
    msg_type: 'post',
  };

  body = {
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
          title: `Hash 验证已结束`,
          content: [
            androidHash && [
              { tag: 'text', text: `🤖 Android Hash: ` },
              { tag: 'text', text: androidHash },
            ],
            iosHash && [
              { tag: 'text', text: `🍏 iOS Hash: ` },
              { tag: 'text', text: iosHash },
            ],
            overallHash && [
              { tag: 'text', text: `🔗 总哈希: ` },
              { tag: 'text', text: overallHash },
            ],
            [{ tag: 'text', text: `--------------------` }],
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
    androidHash: args[0],
    iosHash: args[1],
    overallHash: args[2],
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
