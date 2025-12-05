import { startSyncUserAssetSettings } from './hooks/useTokenSettings';
import {
  startSubscribeTokenSource,
  startSubscribeTokenStatics,
} from './databases/hooks/token';

startSyncUserAssetSettings();
startSubscribeTokenStatics();
startSubscribeTokenSource();
