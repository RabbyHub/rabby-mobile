import IconSafe from '@/assets/icons/security-engine/safe.svg';
import IconDanger from '@/assets/icons/security-engine/danger.svg';
import IconForbidden from '@/assets/icons/security-engine/forbidden.svg';
import IconWarning from '@/assets/icons/security-engine/warning.svg';
import IconError from '@/assets/icons/security-engine/error.svg';
import IconProceed from '@/assets/icons/security-engine/processed.svg';
import IconClosed from '@/assets/icons/security-engine/closed.svg';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';

export const SecurityEngineLevelOrder = [
  Level.FORBIDDEN,
  Level.DANGER,
  Level.WARNING,
  Level.SAFE,
  null,
  Level.ERROR,
  'proceed',
];

export const SecurityEngineLevel = {
  [Level.SAFE]: {
    color: '#27C193',
    icon: IconSafe,
    text: 'Safe',
  },
  [Level.WARNING]: {
    color: '#FFB020',
    icon: IconWarning,
    text: 'Warning',
  },
  [Level.DANGER]: {
    color: '#EC5151',
    icon: IconDanger,
    text: 'Danger',
  },
  [Level.FORBIDDEN]: {
    color: '#AF160E',
    icon: IconForbidden,
    text: 'Forbidden',
  },
  [Level.ERROR]: {
    color: '#B4BDCC',
    icon: IconError,
    text: 'Security engine failed',
  },
  closed: {
    color: '#B4BDCC',
    icon: IconClosed,
    text: 'Closed',
  },
  proceed: {
    color: '#707280',
    icon: IconProceed,
    text: 'Proceed',
  },
};
