import { ethers } from 'ethers';
import { isAddress } from 'viem';

export interface ERC681ParsedData {
  isValid: boolean;
  target_address?: string;
  chain_id?: number;
  function_name?: string;
  parameters?: Record<string, any>;
  amount?: string;
  gasLimit?: string;
  gasPrice?: string;
  value?: string;
  isERC20Transfer?: boolean;
  tokenAddress?: string;
}

export function parseERC681URI(uri: string): ERC681ParsedData {
  try {
    // ERC-681 format: ethereum:[pay-]<target_address>[@<chain_id>][/<function_name>]?[<parameters>]

    // Check if it's an ethereum URI
    if (!uri.startsWith('ethereum:')) {
      return { isValid: false };
    }

    // Remove the ethereum: prefix
    const withoutPrefix = uri.substring(9);

    // Split by ? to separate the path from parameters
    const [pathPart, queryPart] = withoutPrefix.split('?');

    // Parse the path part
    let target_address = '';
    let chain_id: number | undefined;
    let function_name: string | undefined;

    // Check for pay- prefix
    const isPay = pathPart.startsWith('pay-');
    const addressPart = isPay ? pathPart.substring(4) : pathPart;

    // Split by / to separate address from function
    const [addressChainPart, functionPart] = addressPart.split('/');

    // Split by @ to separate address from chain
    const [addressOnly, chainPart] = addressChainPart.split('@');

    target_address = addressOnly;

    // Validate address
    if (!isAddress(target_address)) {
      return { isValid: false };
    }

    // Parse chain ID if present
    if (chainPart) {
      chain_id = parseInt(chainPart, 10);
      if (isNaN(chain_id)) {
        return { isValid: false };
      }
    }

    // Parse function name if present
    if (functionPart) {
      function_name = functionPart;
    }

    // Parse query parameters
    const parameters: Record<string, any> = {};
    let amount: string | undefined;
    let gasLimit: string | undefined;
    let gasPrice: string | undefined;
    let value: string | undefined;

    if (queryPart) {
      const params = new URLSearchParams(queryPart);

      for (const [key, val] of params.entries()) {
        if (key === 'value') {
          // Value is in wei, convert to ether for display
          value = val;
          if (!function_name || function_name === 'transfer') {
            amount = val;
          }
        } else if (key === 'gas') {
          gasLimit = val;
        } else if (key === 'gasPrice') {
          gasPrice = val;
        } else {
          // Handle different parameter types
          if (key.endsWith('[address]') || key === 'address' || key === 'to') {
            // Address parameter
            const paramName = key.replace('[address]', '');
            parameters[paramName] = val;
          } else if (key.endsWith('[uint256]') || key.endsWith('[uint]')) {
            // Uint parameter
            const paramName = key.replace(/\[(uint256|uint)\]/, '');
            parameters[paramName] = val;
          } else if (key.endsWith('[bytes]') || key.endsWith('[bytes32]')) {
            // Bytes parameter
            const paramName = key.replace(/\[(bytes|bytes32)\]/, '');
            parameters[paramName] = val;
          } else if (key.endsWith('[bool]')) {
            // Boolean parameter
            const paramName = key.replace('[bool]', '');
            parameters[paramName] = val === 'true';
          } else {
            // Default to string
            parameters[key] = val;
          }
        }
      }
    }

    // Check if this is an ERC20 transfer
    const isERC20Transfer =
      function_name === 'transfer' &&
      parameters.address &&
      isAddress(parameters.address as string);

    // For ERC20 transfers, the target_address is the token contract
    // and parameters.address is the recipient
    let tokenAddress: string | undefined;
    if (isERC20Transfer) {
      tokenAddress = target_address;
      // The actual recipient is in parameters.address
      // Amount for ERC20 is in parameters.uint256 or parameters.amount
      amount = parameters.uint256 || parameters.amount || parameters.value;
    }

    return {
      isValid: true,
      target_address,
      chain_id,
      function_name,
      parameters,
      amount,
      gasLimit,
      gasPrice,
      value,
      isERC20Transfer,
      tokenAddress,
    };
  } catch (error) {
    console.error('Error parsing ERC-681 URI:', error);
    return { isValid: false };
  }
}

export function isERC681URI(uri: string): boolean {
  return uri.startsWith('ethereum:');
}

// Helper to get recipient address from parsed data
export function getRecipientAddress(
  parsedData: ERC681ParsedData,
): string | undefined {
  if (parsedData.isERC20Transfer) {
    // For ERC20 transfers, recipient is in parameters
    return parsedData.parameters?.address || parsedData.parameters?.to;
  } else {
    // For ETH transfers, recipient is the target address
    return parsedData.target_address;
  }
}

// Helper to get transfer amount in human-readable format
export function getTransferAmount(
  parsedData: ERC681ParsedData,
): string | undefined {
  if (!parsedData.amount) return undefined;

  try {
    // Amount is in wei, convert to ether
    return ethers.utils.formatEther(parsedData.amount);
  } catch {
    return parsedData.amount;
  }
}
