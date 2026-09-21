import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';

function showAddSelectMethodModal() {
  naviPush(RootNames.SelectAddMethod);
}

export const apiGlobalModal = {
  showAddSelectMethodModal,
};
