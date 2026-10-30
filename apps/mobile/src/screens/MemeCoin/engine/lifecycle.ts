export const createLifecycleController = ({
  pause,
  resume,
}: {
  pause: () => void;
  resume: () => void;
}) => {
  let appActive = true;
  let exitDialogOpen = false;

  const sync = () => (appActive && !exitDialogOpen ? resume() : pause());

  return {
    setAppActive(active: boolean) {
      appActive = active;
      sync();
    },
    setExitDialogOpen(open: boolean) {
      exitDialogOpen = open;
      sync();
    },
    sync,
  };
};
