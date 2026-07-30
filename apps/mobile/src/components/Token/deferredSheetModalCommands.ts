import type { SheetModalShowType } from '@/hooks/useSheetModal';

type SheetModalCommandTarget = {
  toggleShow: (command: SheetModalShowType) => void;
};

const shouldMountForCommand = (command: SheetModalShowType) =>
  command === true || typeof command === 'number';

export class DeferredSheetModalCommandQueue {
  private pendingCommand: SheetModalShowType | null = null;

  handle(command: SheetModalShowType, target: SheetModalCommandTarget | null) {
    if (target) {
      target.toggleShow(command);
      return false;
    }

    if (shouldMountForCommand(command)) {
      this.pendingCommand = command;
      return true;
    }

    this.pendingCommand = null;
    return false;
  }

  flush(target: SheetModalCommandTarget) {
    if (this.pendingCommand === null) {
      return;
    }

    const command = this.pendingCommand;
    this.pendingCommand = null;
    target.toggleShow(command);
  }
}
