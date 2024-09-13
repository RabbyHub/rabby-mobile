import { RcIconUser } from '@/assets/icons/gnosis';
import { getProtocol } from '@rabby-wallet/rabby-action';
import { Button } from '@/components/Button';
import { openapi } from '@/core/request';
import { useThemeColors } from '@/hooks/theme';
import { RcIconUnknown } from '@/screens/Approvals/icons';
import { splitNumberByStep } from '@/utils/number';
import { createGetStyles } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import {
  ApproveAction,
  ParseTxResponse,
  RevokeTokenApproveAction,
  SendAction,
} from '@rabby-wallet/rabby-api/dist/types';
import { useRequest } from 'ahooks';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';

export type ConfirmationProps = {
  owner: string;
  type: string;
  hash: string;
  signature: string | null;
};

interface Props {
  explain: ParseTxResponse;
  isViewLoading: boolean;
  onView: () => void;
  serverId: string;
  canExec?: boolean;
}

export const GnosisTransactionExplain: React.FC<Props> = ({
  explain,
  isViewLoading,
  onView,
  serverId,
  canExec,
}) => {
  const { t } = useTranslation();
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);

  let icon: React.ReactNode = <RcIconUnknown style={styles.icon} />;
  let content: string | React.ReactNode = t('page.safeQueue.unknownTx');

  const { data: spenderProtocol } = useRequest(async () => {
    if (explain?.action?.data && 'spender' in explain.action.data) {
      const { desc } = await openapi.addrDesc(explain?.action?.data?.spender);
      return getProtocol(desc.protocol, serverId);
    }
  });

  const { data: contractProtocol } = useRequest(async () => {
    if (
      explain?.action?.data &&
      !('spender' in (explain?.action?.data || {})) &&
      explain?.contract_call?.contract?.id
    ) {
      const { desc } = await openapi.addrDesc(
        explain?.contract_call?.contract?.id,
      );
      return getProtocol(desc.protocol, serverId);
    }
  });

  if (explain) {
    if (explain?.action?.type === 'revoke_token') {
      const data = explain.action.data as RevokeTokenApproveAction;
      icon = spenderProtocol?.logo_url ? (
        <Image
          source={{ uri: spenderProtocol?.logo_url }}
          style={styles.icon}
        />
      ) : (
        <RcIconUnknown style={styles.icon} />
      );
      content = (
        <Text style={styles.explainText} numberOfLines={2}>
          {t('page.safeQueue.cancelExplain', {
            token: getTokenSymbol(data.token),
            protocol:
              spenderProtocol?.name || t('page.safeQueue.unknownProtocol'),
          })}
        </Text>
      );
    } else if (explain?.action?.type === 'approve_token') {
      const data = explain.action.data as ApproveAction;
      icon = spenderProtocol?.logo_url ? (
        <Image
          source={{ uri: spenderProtocol?.logo_url }}
          style={styles.icon}
        />
      ) : (
        <RcIconUnknown style={styles.icon} />
      );
      content = (
        <Text style={styles.explainText} numberOfLines={2}>
          {t('page.safeQueue.approvalExplain', {
            token: getTokenSymbol(data.token),
            counts:
              data.token.amount < 1e9
                ? splitNumberByStep(data.token.amount)
                : t('page.safeQueue.unlimited'),
            protocol:
              spenderProtocol?.name || t('page.safeQueue.unknownProtocol'),
          })}
        </Text>
      );
    } else if (explain?.action?.type === 'send_token') {
      const data = explain.action.data as SendAction;
      icon = <RcIconUser style={styles.icon} />;
      content = (
        <Text style={styles.explainText} numberOfLines={2}>{`${t(
          'page.safeQueue.action.send',
        )} ${splitNumberByStep(data.token.amount)} ${getTokenSymbol(
          data.token,
        )}`}</Text>
      );
    } else if (explain?.action?.type === 'cancel_tx') {
      content = (
        <Text style={styles.explainText} numberOfLines={2}>
          {t('page.safeQueue.action.cancel')}
        </Text>
      );
    } else if (explain?.contract_call) {
      icon = contractProtocol?.logo_url ? (
        <Image
          source={{ uri: contractProtocol?.logo_url }}
          style={styles.icon}
        />
      ) : (
        <RcIconUnknown style={styles.icon} />
      );

      content = (
        <Text style={styles.explainText} numberOfLines={2}>
          {explain.contract_call.func}
        </Text>
      );
    }
  }

  return (
    <View style={styles.container}>
      {icon || <RcIconUnknown style={styles.icon} />}
      <View style={styles.content}>
        {content || (
          <Text style={styles.explainText}>
            {t('page.safeQueue.unknownTx')}
          </Text>
        )}
      </View>
      <Button
        title={t('page.safeQueue.viewBtn')}
        loading={isViewLoading}
        onPress={onView}
        containerStyle={styles.buttonContainer}
        buttonStyle={[styles.button, canExec && styles.buttonCanExec]}
        titleStyle={[styles.buttonTitle, canExec && styles.buttonTitleCanExec]}
      />
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
  content: {
    marginLeft: 8,
    flex: 1,
  },
  buttonContainer: {
    marginLeft: 'auto',
  },
  button: {
    borderRadius: 2,
    width: 60,
    height: 26,
  },
  buttonCanExec: {
    backgroundColor: 'rgba(134, 151, 255, 0.2)',
  },
  buttonTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  buttonTitleCanExec: {
    color: colors['blue-default'],
  },
  explainText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 18,
    color: colors['neutral-title-1'],
  },
}));
