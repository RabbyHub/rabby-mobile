import {
  parseERC681URI,
  getRecipientAddress,
  getTransferAmount,
} from '../erc681';

describe('ERC-681 Parser', () => {
  describe('parseERC681URI', () => {
    it('should parse simple ETH transfer', () => {
      const uri =
        'ethereum:0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7?value=1000000000000000000';
      const result = parseERC681URI(uri);

      expect(result.isValid).toBe(true);
      expect(result.target_address).toBe(
        '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
      );
      expect(result.amount).toBe('1000000000000000000');
      expect(result.isERC20Transfer).toBe(false);
    });

    it('should parse ETH transfer with chain ID', () => {
      const uri =
        'ethereum:0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7@1?value=2300000000000000000';
      const result = parseERC681URI(uri);

      expect(result.isValid).toBe(true);
      expect(result.target_address).toBe(
        '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
      );
      expect(result.chain_id).toBe(1);
      expect(result.amount).toBe('2300000000000000000');
    });

    it('should parse ERC20 transfer', () => {
      const uri =
        'ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/transfer?address=0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7&uint256=100000000';
      const result = parseERC681URI(uri);

      expect(result.isValid).toBe(true);
      expect(result.target_address).toBe(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      );
      expect(result.function_name).toBe('transfer');
      expect(result.isERC20Transfer).toBe(true);
      expect(result.tokenAddress).toBe(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      );
      expect(result.parameters?.address).toBe(
        '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
      );
      expect(result.parameters?.uint256).toBe('100000000');
      expect(result.amount).toBe('100000000');
    });

    it('should parse with pay- prefix', () => {
      const uri =
        'ethereum:pay-0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7?value=1000000000000000000';
      const result = parseERC681URI(uri);

      expect(result.isValid).toBe(true);
      expect(result.target_address).toBe(
        '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
      );
    });

    it('should parse with gas parameters', () => {
      const uri =
        'ethereum:0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7?value=1000000000000000000&gas=21000&gasPrice=20000000000';
      const result = parseERC681URI(uri);

      expect(result.isValid).toBe(true);
      expect(result.gasLimit).toBe('21000');
      expect(result.gasPrice).toBe('20000000000');
    });

    it('should handle custom function calls', () => {
      const uri =
        'ethereum:0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7/someFunction?uint256=123&address=0x0000000000000000000000000000000000000000';
      const result = parseERC681URI(uri);

      expect(result.isValid).toBe(true);
      expect(result.function_name).toBe('someFunction');
      expect(result.parameters?.uint256).toBe('123');
      expect(result.parameters?.address).toBe(
        '0x0000000000000000000000000000000000000000',
      );
    });

    it('should handle invalid addresses', () => {
      const uri = 'ethereum:invalidaddress?value=1000000000000000000';
      const result = parseERC681URI(uri);

      expect(result.isValid).toBe(false);
    });

    it('should handle non-ethereum URIs', () => {
      const uri = 'bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
      const result = parseERC681URI(uri);

      expect(result.isValid).toBe(false);
    });
  });

  describe('getRecipientAddress', () => {
    it('should return target address for ETH transfers', () => {
      const parsed = {
        isValid: true,
        target_address: '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
        isERC20Transfer: false,
      };

      expect(getRecipientAddress(parsed)).toBe(
        '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
      );
    });

    it('should return recipient from parameters for ERC20 transfers', () => {
      const parsed = {
        isValid: true,
        target_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        isERC20Transfer: true,
        parameters: {
          address: '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
        },
      };

      expect(getRecipientAddress(parsed)).toBe(
        '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
      );
    });
  });

  describe('getTransferAmount', () => {
    it('should convert wei to ether', () => {
      const parsed = {
        isValid: true,
        amount: '1000000000000000000',
      };

      expect(getTransferAmount(parsed)).toBe('1.0');
    });

    it('should handle undefined amount', () => {
      const parsed = {
        isValid: true,
      };

      expect(getTransferAmount(parsed)).toBeUndefined();
    });

    it('should handle invalid amount', () => {
      const parsed = {
        isValid: true,
        amount: 'invalid',
      };

      expect(getTransferAmount(parsed)).toBe('invalid');
    });
  });
});
