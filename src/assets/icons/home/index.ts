import {default as RcIconHeaderSettingsCC} from './header-settings-cc.svg';
import {default as RcIconSignatureRecordCC} from './header-signature-record-cc.svg';

import {makeThemeIconByCC} from '@/hooks/makeThemeIcon';

export const RcIconHeaderSettings = makeThemeIconByCC(RcIconHeaderSettingsCC, {
  onLight: 'white',
  onDark: 'white',
});

export const RcIconSignatureRecord = makeThemeIconByCC(
  RcIconSignatureRecordCC,
  {
    onLight: 'white',
    onDark: 'white',
  },
);
