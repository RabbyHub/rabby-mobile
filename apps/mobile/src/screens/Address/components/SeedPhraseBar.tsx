import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { RootNames } from '@/constant/layout';
import { apiMnemonic } from '@/core/apis';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { navigateDeprecated } from '@/utils/navigation';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useTranslation } from 'react-i18next';
import IconArrowRight from '@/assets/icons/approval/edit-arrow-right.svg';
import { Text, TouchableOpacity } from 'react-native';
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';

interface Props {
  address: string;
}

export const SeedPhraseBar: React.FC<Props> = ({ address }) => {
  const { t } = useTranslation();
  const invokeEnterPassphrase = useEnterPassphraseModal('address');
  const { styles } = useThemeStyles(getStyle);

  const goToHDManager = async () => {
    AuthenticationModal.show({
      confirmText: t('global.Confirm'),
      cancelText: t('global.Cancel'),
      title: t('page.addressDetail.manage-seed-phrase'),
      validationHandler: async (password: string) => {
        await apiMnemonic.getMnemonics(password, address);
      },
      async onFinished() {
        const passphrase = await invokeEnterPassphrase(address);
        const mnemonics = await apiMnemonic.getMnemonicByAddress(address)!;
        const result = await apiMnemonic.generateKeyringWithMnemonic(
          mnemonics,
          passphrase,
        );
        const keyringId = result.keyringId;
        navigateDeprecated(RootNames.StackAddress, {
          screen: RootNames.ImportMoreAddress,
          params: {
            type: KEYRING_TYPE.HdKeyring,
            mnemonics,
            passphrase,
            keyringId: keyringId || undefined,
            isExistedKR: result.isExistedKR,
          },
        });
      },
    });
  };
  return (
    <TouchableOpacity onPress={goToHDManager} style={styles.main}>
      <Text style={styles.text}>
        {t('page.addressDetail.manage-addresses-under-this-seed-phrase')}{' '}
      </Text>
      <IconArrowRight width={16} height={16} />
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles(colors => ({
  main: {
    flex: 1,
    backgroundColor: colors['neutral-card-2'],
    borderRadius: 4,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  text: {
    fontSize: 13,
    color: colors['neutral-body'],
  },
}));
