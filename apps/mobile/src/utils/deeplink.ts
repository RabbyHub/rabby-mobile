import { Linking } from 'react-native';
import {
  parseERC681URI,
  getRecipientAddress,
  getTransferAmount,
} from './erc681';
import { findChainByID } from '@/utils/chain';
import { CHAINS_ENUM } from '@/constant/chains';

export interface DeepLinkHandlerResult {
  handled: boolean;
  navigation?: {
    screen: string;
    params?: any;
  };
}

export async function handleDeepLink(
  url: string,
): Promise<DeepLinkHandlerResult> {
  try {
    // Handle ERC-681 ethereum: URIs
    if (url.startsWith('ethereum:')) {
      const parsed = parseERC681URI(url);

      if (!parsed.isValid) {
        return { handled: false };
      }

      const recipientAddress = getRecipientAddress(parsed);
      const amount = getTransferAmount(parsed);

      // Determine chain
      let chainEnum: CHAINS_ENUM | undefined;
      if (parsed.chain_id) {
        const chain = findChainByID(parsed.chain_id);
        chainEnum = chain?.enum;
      }

      // Prepare navigation params
      const params: any = {
        toAddress: recipientAddress,
      };

      if (chainEnum) {
        params.chainEnum = chainEnum;
      }

      if (parsed.isERC20Transfer && parsed.tokenAddress) {
        // For ERC20 transfers, we need to set the token
        // Token ID format in Rabby is "address" only, chain is handled separately
        params.tokenId = parsed.tokenAddress.toLowerCase();
      }

      if (parsed.isERC20Transfer && parsed.parameters?.uint256) {
        // For ERC20 tokens, we pass a special marker to indicate raw amount
        // The Send screen needs to convert this based on token decimals
        params.rawAmount = parsed.parameters.uint256;
        params.isRawAmount = true;
      } else if (amount) {
        // For ETH transfers, amount is already converted to ether in getTransferAmount
        params.amount = amount;
      }

      if (parsed.gasLimit) {
        params.gasLimit = parsed.gasLimit;
      }

      if (parsed.gasPrice) {
        params.gasPrice = parsed.gasPrice;
      }

      // Store any additional parameters for the transaction
      if (parsed.function_name && parsed.function_name !== 'transfer') {
        // For custom function calls, we'll need to handle this differently
        params.customFunction = {
          name: parsed.function_name,
          parameters: parsed.parameters,
        };
      }

      return {
        handled: true,
        navigation: {
          screen: 'SendERC681',
          params,
        },
      };
    }

    // Handle other deep link types here in the future

    return { handled: false };
  } catch (error) {
    console.error('Error handling deep link:', error);
    return { handled: false };
  }
}

export function setupDeepLinkListener(
  onDeepLink: (result: DeepLinkHandlerResult) => void,
) {
  // Handle initial URL (app opened from deep link)
  Linking.getInitialURL().then(url => {
    if (url) {
      handleDeepLink(url).then(onDeepLink);
    }
  });

  // Handle URLs when app is already open
  const subscription = Linking.addEventListener('url', event => {
    if (event.url) {
      handleDeepLink(event.url).then(onDeepLink);
    }
  });

  return () => {
    subscription.remove();
  };
}
