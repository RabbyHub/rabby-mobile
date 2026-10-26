export type SendScreenSession = Readonly<{
  routeKey: string;
  generation: number;
}>;

let activeSession: SendScreenSession | null = null;
let nextGeneration = 0;

export function claimSendScreenSession(routeKey: string) {
  if (activeSession?.routeKey === routeKey) {
    return {
      ownerChanged: false,
      session: activeSession,
    };
  }

  activeSession = {
    routeKey,
    generation: ++nextGeneration,
  };

  return {
    ownerChanged: true,
    session: activeSession,
  };
}

export function getSendScreenActivationPlan(input: {
  hadClaimedSession: boolean;
  ownerChanged: boolean;
  screenStateInited: boolean;
}) {
  const resetSharedState = input.hadClaimedSession && input.ownerChanged;

  return {
    resetSharedState,
    restartInitialization: resetSharedState || !input.screenStateInited,
  };
}

export function isSendScreenSessionActive(session: SendScreenSession) {
  return (
    activeSession?.routeKey === session.routeKey &&
    activeSession.generation === session.generation
  );
}

export function releaseSendScreenSession(session: SendScreenSession) {
  if (!isSendScreenSessionActive(session)) {
    return false;
  }

  activeSession = null;
  return true;
}

export function resetSendScreenSessionForTests() {
  activeSession = null;
  nextGeneration = 0;
}
