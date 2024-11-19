import React, { useMemo } from 'react';
import { ReadRisk } from './ReadRisk';
import { SeedPhrase } from './SeedPhrase';
import { BottomSheetView } from '@gorhom/bottom-sheet';

interface Props {
  onDone: (isNoMnemonic?: boolean) => void;
  delaySetPassword?: boolean;
}

export const SeedPhraseManualBackup: React.FC<Props> = ({
  onDone,
  delaySetPassword,
}) => {
  const [step, setStep] = React.useState<'read_risk' | 'seed_phrase'>(
    'read_risk',
  );

  const handleNextTick = () => {
    switch (step) {
      case 'read_risk':
        setStep('seed_phrase');
        break;
      case 'seed_phrase':
        onDone();
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
      case 'seed_phrase':
        return SeedPhrase;
      default:
        return ReadRisk;
    }
  }, [step]);

  return (
    <BottomSheetView>
      <Components
        onConfirm={handleNextTick}
        delaySetPassword={delaySetPassword}
      />
    </BottomSheetView>
  );
};
