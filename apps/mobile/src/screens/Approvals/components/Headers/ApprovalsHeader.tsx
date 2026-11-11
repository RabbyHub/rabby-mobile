import React from 'react';
import { useAtom, useAtomValue } from 'jotai';

import type { Account } from '@/core/startupServices/preference';
import { HeaderCenter } from './HeaderCenter';
import { HeaderRight } from './HeaderRight';
import {
  approvalsSearchKwAtom,
  approvalsSearchingAtom,
} from '../../useApprovalsPage';

/**
 * Approvals header slots, declared once in the navigator options.
 *
 * The search state lives in shared atoms instead of the screen body, so the
 * header never has to be replaced through `setOptions` after mount
 * (declarative header contract; QA 1328/1344).
 */
export const ApprovalsHeaderTitle = ({
  account,
}: {
  account?: Account | null;
}) => {
  const [searchKw, setSearchKw] = useAtom(approvalsSearchKwAtom);
  const isSearching = useAtomValue(approvalsSearchingAtom);

  return (
    <HeaderCenter
      type="contract"
      isSearching={isSearching}
      inputValue={searchKw}
      inputOnChange={setSearchKw}
      currentAccount={account as never}
    />
  );
};

export const ApprovalsHeaderRight = () => {
  const [isSearching, setIsSearching] = useAtom(approvalsSearchingAtom);
  const [, setSearchKw] = useAtom(approvalsSearchKwAtom);

  return (
    <HeaderRight
      isSearching={isSearching}
      onTap={() => {
        if (isSearching) {
          setSearchKw('');
        }
        setIsSearching(prev => !prev);
      }}
    />
  );
};
