import { apiMnemonic } from '@/core/apis';
import {
  decryptFiles,
  detectCloudIsAvailable,
  getBackupsFromCloud,
  saveMnemonicToCloud,
} from '@/core/utils/cloudBackup';
import { useRequest } from 'ahooks';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { ReadRisk } from './ReadRisk';
import { VerifySeedPhrase } from './VerifySeedPhrase';
import { WriteSeedPhrase } from './WriteSeedPhrase';

interface Props {
  onDone: (isNoMnemonic?: boolean) => void;
}

export const SeedPhraseBackupToCloud: React.FC<Props> = ({ onDone }) => {
  const { data: mnemonic } = useRequest(async () => {
    const res = await apiMnemonic.getPreMnemonics();
    return res as string;
  });
  const [step, setStep] = React.useState<
    | 'read_risk'
    | 'hidden_seed_phrase'
    | 'write_seed_phrase'
    | 'verify_seed_phrase'
  >('read_risk');

  const handleNextTick = () => {
    switch (step) {
      case 'read_risk':
        setStep('write_seed_phrase');
        break;
      // case 'hidden_seed_phrase':
      //   setStep('write_seed_phrase');
      //   break;
      case 'write_seed_phrase':
        setStep('verify_seed_phrase');
        break;
      case 'verify_seed_phrase':
        // goto successful page
        break;
      default:
        break;
    }
  };

  const Components = useMemo(() => {
    switch (step) {
      case 'read_risk':
        return ReadRisk;
      // case 'hidden_seed_phrase':
      //   return WriteSeedPhrase;
      case 'write_seed_phrase':
        return WriteSeedPhrase;
      case 'verify_seed_phrase':
        return VerifySeedPhrase;
      default:
        return ReadRisk;
    }
  }, [step]);

  return (
    <View>
      <Components onConfirm={handleNextTick} />
    </View>
  );
};
