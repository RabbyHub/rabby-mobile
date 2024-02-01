// import { ExplainTxResponse } from 'background/service/openapi';
// import React from 'react';
// import { Trans, useTranslation } from 'react-i18next';
// import { SvgIconOpenExternal } from 'ui/assets';
// import IconUser from 'ui/assets/address-management.svg';
// import IconUnknown from 'ui/assets/icon-unknown.svg';
// import { splitNumberByStep } from 'ui/utils/number';

import { ExplainTxResponse } from '@rabby-wallet/rabby-api/dist/types';
import { Trans, useTranslation } from 'react-i18next';
import RcIconUnknown from '@/assets/icons/transaction-record/icon-unknown.svg';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { splitNumberByStep } from '@/utils/number';
import RcIconSend from '@/assets/icons/history/send.svg';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';

const ImageWraper = ({
  src,
  style,
}: {
  src?: string;
  style?: StyleProp<ImageStyle>;
}) => {
  return src ? (
    <Image
      style={style}
      source={{
        uri: src,
      }}
    />
  ) : (
    <RcIconUnknown style={style} />
  );
};

export const TransactionExplain = ({
  explain,
  isFailed,
  isSubmitFailed,
  isCanceled,
  isWithdrawed,
}: {
  isFailed: boolean;
  isSubmitFailed: boolean;
  isCanceled: boolean;
  isWithdrawed: boolean;
  explain?: ExplainTxResponse;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const { t } = useTranslation();
  let icon: React.ReactNode = <RcIconUnknown />;
  let content: string | React.ReactNode = t(
    'page.activities.signedTx.explain.unknown',
  );
  if (explain) {
    if (explain.type_cancel_nft_collection_approval) {
      icon = (
        <ImageWraper
          style={styles.logo}
          src={
            explain.type_cancel_nft_collection_approval
              .spender_protocol_logo_url
          }
        />
      );
      content = (
        <Trans
          i18nKey="page.activities.signedTx.explain.cancelNFTCollectionApproval"
          values={{
            protocol:
              explain.type_cancel_nft_collection_approval
                .spender_protocol_name ||
              t('page.activities.signedTx.common.unknownProtocol'),
          }}
          t={t}
        />
      );
    } else if (explain.type_nft_collection_approval) {
      icon = (
        <ImageWraper
          style={styles.logo}
          src={explain.type_nft_collection_approval.spender_protocol_logo_url}
        />
      );
      content = (
        <Trans
          i18nKey="page.activities.signedTx.explain.nftCollectionApproval"
          values={{
            protocol:
              explain.type_nft_collection_approval.spender_protocol_name ||
              t('page.activities.signedTx.common.unknownProtocol'),
          }}
          t={t}
        />
      );
    } else if (explain.type_cancel_single_nft_approval) {
      icon = (
        <ImageWraper
          style={styles.logo}
          src={
            explain.type_cancel_single_nft_approval.spender_protocol_logo_url
          }
        />
      );
      content = (
        <Trans
          i18nKey="page.activities.signedTx.explain.cancelSingleNFTApproval"
          values={{
            protocol:
              explain.type_cancel_single_nft_approval.spender_protocol_name ||
              t('page.activities.signedTx.common.unknownProtocol'),
          }}
          t={t}
        />
      );
    } else if (explain.type_single_nft_approval) {
      icon = (
        <ImageWraper
          style={styles.logo}
          src={explain.type_single_nft_approval.spender_protocol_logo_url}
        />
      );
      content = (
        <Trans
          i18nKey="page.activities.signedTx.explain.singleNFTApproval"
          values={{
            protocol:
              explain.type_single_nft_approval.spender_protocol_name ||
              t('page.activities.signedTx.common.unknownProtocol'),
          }}
          t={t}
        />
      );
    } else if (explain.type_nft_send) {
      icon = <RcIconSend style={styles.logo} />;
      content = `${t('page.activities.signedTx.explain.send', {
        amount: splitNumberByStep(explain.type_nft_send.token_amount),
        symbol: 'NFT',
      })}`;
    } else if (explain.type_cancel_token_approval) {
      icon = (
        <ImageWraper
          style={styles.logo}
          src={explain.type_cancel_token_approval.spender_protocol_logo_url}
        />
      );
      content = (
        <Trans
          i18nKey="page.activities.signedTx.explain.cancel"
          values={{
            token: explain.type_cancel_token_approval.token_symbol,
            protocol:
              explain.type_cancel_token_approval.spender_protocol_name ||
              t('page.activities.signedTx.common.unknownProtocol'),
          }}
          t={t}
        />
      );
    } else if (explain.type_token_approval) {
      icon = (
        <ImageWraper
          style={styles.logo}
          src={explain.type_token_approval.spender_protocol_logo_url}
        />
      );
      content = (
        <Trans
          i18nKey="page.activities.signedTx.explain.approve"
          values={{
            token: explain.type_token_approval.token_symbol,
            count: explain.type_token_approval.is_infinity
              ? t('page.activities.signedTx.common.unlimited')
              : splitNumberByStep(explain.type_token_approval.token_amount),
            protocol:
              explain.type_token_approval.spender_protocol_name ||
              t('page.activities.signedTx.common.unknownProtocol'),
          }}
          t={t}
        />
      );
    } else if (explain.type_send) {
      icon = <RcIconSend style={styles.logo} />;
      content = `${t('page.activities.signedTx.explain.send', {
        amount: splitNumberByStep(explain.type_send.token_amount),
        symbol: explain.type_send.token_symbol,
      })}`;
    } else if (explain.type_call) {
      icon = (
        <ImageWraper
          style={styles.logo}
          src={explain.type_call.contract_protocol_logo_url}
        />
      );
      content = explain.type_call.action;
    }
  }

  return (
    <View style={styles.explain}>
      {icon || <RcIconUnknown />}
      <Text style={styles.title}>
        {content || t('page.activities.signedTx.explain.unknown')}
      </Text>
      {isCanceled || isFailed || isSubmitFailed || isWithdrawed ? (
        <Text style={styles.status}>
          {isCanceled
            ? t('page.activities.signedTx.status.canceled')
            : isFailed
            ? t('page.activities.signedTx.status.failed')
            : isSubmitFailed
            ? t('page.activities.signedTx.status.submitFailed')
            : isWithdrawed
            ? t('page.activities.signedTx.status.withdrawed')
            : ''}
        </Text>
      ) : null}
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    explain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    logo: {
      width: 20,
      height: 20,
      borderRadius: 2,
    },
    title: {
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title1'],
    },
    status: {
      color: colors['red-default'],
      fontSize: 12,
      lineHeight: 14,
      marginLeft: 'auto',
    },
  });
