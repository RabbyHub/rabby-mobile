import i18n from '@/utils/i18n';
import { ParsedTypedDataActionData } from '@rabby-wallet/rabby-action';
import { getActionTypeText as getTransactionActionTypeText } from '../Actions/utils';
import { decodeSingle, encodeSingle } from '@metamask/abi-utils';
import {
  TypedDataUtils,
  SignTypedDataVersion,
  type MessageTypes,
  type TypedMessage,
} from '@metamask/eth-sig-util';

export const getActionTypeText = (data: ParsedTypedDataActionData | null) => {
  const { t } = i18n;

  if (data?.permit) {
    return t('page.signTypedData.permit.title');
  }
  if (data?.permit2 || data?.batchPermit2) {
    return t('page.signTypedData.permit2.title');
  }
  if (data?.approveNFT) {
    return t('page.signTx.nftApprove.title');
  }
  if (data?.swapTokenOrder) {
    return t('page.signTypedData.swapTokenOrder.title');
  }
  if (data?.buyNFT || data?.sellNFT || data?.batchSellNFT) {
    return t('page.signTypedData.sellNFT.title');
  }
  if (data?.signMultiSig) {
    return t('page.signTypedData.signMultiSig.title');
  }
  if (data?.createKey) {
    return t('page.signTypedData.createKey.title');
  }
  if (data?.verifyAddress) {
    return t('page.signTypedData.verifyAddress.title');
  }
  if (data?.contractCall) {
    return t('page.signTx.unknownAction');
  }
  if (data?.coboSafeCreate) {
    return t('page.signTx.coboSafeCreate.title');
  }
  if (data?.coboSafeModificationRole) {
    return t('page.signTx.coboSafeModificationRole.title');
  }
  if (data?.coboSafeModificationDelegatedAddress) {
    return t('page.signTx.coboSafeModificationDelegatedAddress.title');
  }
  if (data?.coboSafeModificationTokenApproval) {
    return t('page.signTx.coboSafeModificationTokenApproval.title');
  }
  if (data?.send) {
    return t('page.signTx.send.title');
  }
  if (data?.revokePermit) {
    return t('page.signTx.revokePermit.title');
  }
  if (data?.assetOrder) {
    return t('page.signTx.assetOrder.title');
  }
  if (data?.common) {
    return data.common.title;
  }
  if (data && getTransactionActionTypeText(data)) {
    return getTransactionActionTypeText(data);
  }

  return t('page.signTx.unknownAction');
};

type TypedDataPayload = {
  primaryType: string;
  types: Record<string, any>;
  domain: Record<string, any>;
  message: Record<string, any>;
};

export type NormalizeTypeDataVersion =
  | SignTypedDataVersion.V3
  | SignTypedDataVersion.V4;

export type NormalizeTypeDataFailure = {
  reason: 'field' | 'digest';
  path: string;
  type: string;
  error?: unknown;
};

const ARRAY_TYPE_REG = /^(.*)\[\d*\]$/;

export const getNormalizeTypeDataVersion = (
  method: string,
): NormalizeTypeDataVersion =>
  /v3$/i.test(method) ? SignTypedDataVersion.V3 : SignTypedDataVersion.V4;

export function normalizeTypeData(
  data: TypedDataPayload,
  version: NormalizeTypeDataVersion,
): { typedData: TypedDataPayload; failures: NormalizeTypeDataFailure[] } {
  const types = Object.assign({ EIP712Domain: [] }, data.types);
  const failures: NormalizeTypeDataFailure[] = [];

  const normalizeAtom = (value: any, type: string, name: string) => {
    if (type.startsWith('bytes')) {
      return value;
    }
    const [, encodedValue] = TypedDataUtils.encodeField(
      types,
      name,
      type,
      value,
      version,
    );
    const encoded = encodeSingle(
      type,
      type === 'string' ? value : encodedValue,
    );
    const decoded = decodeSingle(type, encoded);
    if (type === 'bool') {
      if (decoded === 0n) return false;
      if (decoded === 1n) return true;
    }
    if (
      type.startsWith('uint') ||
      type.startsWith('int') ||
      type.startsWith('ufixed') ||
      type.startsWith('fixed')
    ) {
      return (decoded as bigint).toString();
    }
    return decoded;
  };

  const normalizeStruct = (value: any, type: string, path: string) => {
    const normalized: Record<string, any> = {};
    for (const field of types[type]) {
      const fieldValue = value[field.name];
      if (version === SignTypedDataVersion.V3 && fieldValue === undefined) {
        continue;
      }
      normalized[field.name] = normalizeValue(
        fieldValue,
        field.type,
        field.name,
        `${path}.${field.name}`,
      );
    }
    return normalized;
  };

  const normalizeValue = (
    value: any,
    type: string,
    name: string,
    path: string,
  ): any => {
    try {
      if (types[type] !== undefined) {
        if (value === null || value === undefined) return value;
        return normalizeStruct(value, type, path);
      }
      const arrayMatch = ARRAY_TYPE_REG.exec(type);
      if (arrayMatch) {
        return (value as any[]).map((item, i) =>
          normalizeValue(item, arrayMatch[1], name, `${path}[${i}]`),
        );
      }
      return normalizeAtom(value, type, name);
    } catch (error) {
      failures.push({ reason: 'field', path, type, error });
      return value;
    }
  };

  const typedData = {
    ...data,
    domain: normalizeValue(data.domain, 'EIP712Domain', 'domain', 'domain'),
    message: normalizeValue(
      data.message,
      data.primaryType,
      'message',
      'message',
    ),
  };

  const hash = (payload: TypedDataPayload) =>
    TypedDataUtils.eip712Hash(
      payload as TypedMessage<MessageTypes>,
      version,
    ).toString('hex');
  let originalHash: string | undefined;
  try {
    originalHash = hash(data);
  } catch (e) {
    // The signer rejects it as well.
  }
  if (originalHash !== undefined) {
    const digestFailure = {
      reason: 'digest' as const,
      path: '',
      type: String(data.primaryType),
    };
    try {
      if (hash(typedData) !== originalHash) failures.push(digestFailure);
    } catch (error) {
      failures.push({ ...digestFailure, error });
    }
  }

  return { typedData, failures };
}
