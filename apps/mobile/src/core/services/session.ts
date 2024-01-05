import { BackgroundBridge } from '../bridges/BackgroundBridge';

// import { permissionService } from 'background/service';
// import PortMessage from '@/utils/message/portMessage';

export interface SessionProp {
  origin: string;
  icon: string;
  name: string;
}

export class Session {
  origin = '';

  icon = '';

  name = '';

  pms: BackgroundBridge[] = [];

  pushMessage(event, data) {
    this.pms.forEach(pm => {
      // pm.send('message', { event, data });
      pm.port.postMessage({ event, data }, this.origin);
    });
  }

  constructor(data?: SessionProp | null) {
    if (data) {
      this.setProp(data);
    }
  }

  setPortMessage(pm: BackgroundBridge) {
    this.pms.push(pm);
  }

  setProp({ origin, icon, name }: SessionProp) {
    this.origin = origin;
    this.icon = icon;
    this.name = name;
  }
}

// for each tab
const sessionMap = new Map<string, Session | null>();

const getSessionMap = () => {
  return sessionMap;
};

const getSession = (key: string) => {
  return sessionMap.get(key);
};

const getOrCreateSession = (id: number, origin: string) => {
  if (sessionMap.has(`${id}-${origin}`)) {
    return getSession(`${id}-${origin}`);
  }

  return createSession(`${id}-${origin}`, null);
};

const createSession = (key: string, data?: null | SessionProp) => {
  const session = new Session(data);
  sessionMap.set(key, session);

  return session;
};

const deleteSessionsByTabId = (tabId: number) => {
  for (const key of sessionMap.keys()) {
    const [sessionTab] = key.split('-');
    if (sessionTab === tabId.toString()) {
      deleteSession(key);
    }
  }
};

const deleteSession = (key: string) => {
  sessionMap.delete(key);
};

const broadcastEvent = (ev, data?, origin?: string) => {
  let sessions: { key: string; data: Session }[] = [];
  sessionMap.forEach((session, key) => {
    // todo: permission
    // if (session && permissionService.hasPermission(session.origin)) {
    if (session) {
      sessions.push({
        key,
        data: session,
      });
    }
  });

  // same origin
  if (origin) {
    sessions = sessions.filter(session => session.data.origin === origin);
  }

  sessions.forEach(session => {
    try {
      session.data.pushMessage?.(ev, data);
    } catch (e) {
      if (sessionMap.has(session.key)) {
        deleteSession(session.key);
      }
    }
  });
};

export const sessionService = {
  getSessionMap,
  getSession,
  getOrCreateSession,
  deleteSession,
  deleteSessionsByTabId,
  broadcastEvent,
};
