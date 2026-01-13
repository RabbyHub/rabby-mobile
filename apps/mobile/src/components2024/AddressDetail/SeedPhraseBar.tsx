import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { apiMnemonic } from '@/core/apis';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useTranslation } from 'react-i18next';
import ArrowSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { Text, TouchableOpacity } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '../GlobalBottomSheetModal';
import { MODAL_NAMES } from '../GlobalBottomSheetModal/types';
import { KeyringAccountWithAlias } from '@/hooks/account';

interface Props {
  account: KeyringAccountWithAlias;
  onCancel: () => void;
}

export const SeedPhraseBar: React.FC<Props> = ({ account, onCancel }) => {
  const { address } = account;
  const { t } = useTranslation();
  const invokeEnterPassphrase = useEnterPassphraseModal('address');
  const { styles, colors2024 } = useTheme2024({ getStyle });

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

        const id = createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.IMPORT_MORE_ADDRESS,
          params: {
            type: KEYRING_TYPE.HdKeyring,
            mnemonics,
            passphrase,
            keyringId: keyringId || undefined,
            isExistedKR: result.isExistedKR,
            account,
            brandName: KEYRING_CLASS.MNEMONIC,
          },
          onCancel: () => {
            removeGlobalBottomSheetModal2024(id);
            onCancel();
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
      <ArrowSVG color={colors2024['neutral-foot']} width={16} height={16} />
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  main: {
    flex: 1,
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
  },
  text: {
    fontSize: 16,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
  },
}));
