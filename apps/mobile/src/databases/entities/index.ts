import { AccountInfoEntity } from './accountInfo';
import { AppChainEntity } from './appchain';
import { BalanceEntity } from './balance';
import { BuyItemEntity } from './buyItem';
import { CexEntity } from './cex';
import { HistoryItemEntity } from './historyItem';
import { LocalHistoryItemEntity } from './localhistoryItem';
import { NFTItemEntity } from './nftItem';
import { ProtocolItemEntity } from './portocolItem';
import { TokenItemEntity } from './tokenitem';

export const ALL_ORM_ENTITIES = {
  TokenItemEntity,
  NFTItemEntity,
  HistoryItemEntity,
  LocalHistoryItemEntity,
  BalanceEntity,
  ProtocolItemEntity,
  BuyItemEntity,
  CexEntity,
  AccountInfoEntity,
  AppChainEntity,
};
