type RetryUpdateType = 'nonce' | 'gasPrice' | false;
type HintRule = {
  keywords: string[];
  result: [string, RetryUpdateType];
};

const defaultHint: HintRule['result'] = [
  'Something is wrong. Please retry later.',
  false,
];
const hintRules: HintRule[] = [
  {
    keywords: ['insufficient funds for gas'],
    result: [
      'Your gas balance isn’t enough to cover the network gas fee. Add funds for gas and try again.',
      false,
    ],
  },
  {
    keywords: [
      'max fee per gas less than block base fee',
      'replacement transaction underpriced',
    ],
    result: [
      'Gas price too low. We’ll adjust it by 30% to help your transaction confirm. Click “Retry” to confirm and try again.',
      'gasPrice',
    ],
  },
  {
    keywords: ['nonce too low'],
    result: [
      // TODO display x
      'Nonce too low. We’ll update it to X. Click “Retry” to confirm and try again.',
      'nonce',
    ],
  },
  {
    keywords: ['nonce too high'],
    result: ['Nonce too high. Please adjust the nonce and try again.', false],
  },
  {
    keywords: ['already known'],
    result: [
      'Transaction already submitted. Duplicate transaction detected.',
      false,
    ],
  },
  {
    keywords: ['exceeds block gas limit'],
    result: [
      'Gas exceeds block gas limit. Please adjust and try again.',
      false,
    ],
  },
  {
    keywords: ['invalid transaction', 'invalid sender'],
    result: ['Invalid transaction. ', false],
  },
  {
    keywords: ['intrinsic gas too low'],
    result: ['Gas limit too low. Please adjust and try again.', false],
  },
];

export const getTxFailedResult = (origin: string) => {
  const lowerText = origin.toLowerCase();

  for (const rule of hintRules) {
    if (
      rule.keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
    ) {
      return rule.result;
    }
  }

  return defaultHint;
};
