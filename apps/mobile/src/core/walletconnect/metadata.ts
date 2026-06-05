import { WALLETCONNECT_REDIRECT_UNIVERSAL_LINK } from '@/constant/universalLink';
import { WALLETCONNECT_METADATA } from './constants';

export const WALLETCONNECT_CLIENT_METADATA = {
  ...WALLETCONNECT_METADATA,
  redirect: {
    ...WALLETCONNECT_METADATA.redirect,
    universal: WALLETCONNECT_REDIRECT_UNIVERSAL_LINK,
  },
};
