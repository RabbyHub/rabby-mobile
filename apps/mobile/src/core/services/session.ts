import { BroadcastEvent } from '@/constant/event';
import { BackgroundBridge } from '../bridges/BackgroundBridge';
import { dappService } from './shared';

// import { permissionService } from 'background/service';
// import PortMessage from '@/utils/message/portMessage';

export interface SessionProp {
  origin: string;
  icon: string;
  name: string;
}

type SessionKey = BackgroundBridge;
export class Session {
  origin = '';

  icon = '';

  name = '';

  pms: BackgroundBridge[] = [];

  pushMessage(event: BroadcastEvent, data: any) {
    this.pms.forEach(pm => {
      pm.port.postMessage(
        {
          name: 'rabby-provider',
          data: {
            method: event,
            params: data,
          },
        },
        this.origin,
      );

      // pm.sendNotification({
      //   method: event,
      //   params: data,
      // });
    });
  }

  constructor(data?: SessionProp | null) {
    if (data) {
      this.setProp(data);
    }
  }

  setPortMessage(pm: BackgroundBridge) {
    if (this.pms.includes(pm)) {
      return;
    }
    this.pms.push(pm);
  }

  setProp({ origin, icon, name }: SessionProp) {
    this.origin = origin;
    this.icon = icon;
    this.name = name;
  }
}

// for each tab
const sessionMap = new Map<BackgroundBridge, Session | null>();

const getSessionMap = () => {
  return sessionMap;
};

const getSession = (key: SessionKey) => {
  return sessionMap.get(key);
};

const getOrCreateSession = (key: SessionKey) => {
  if (sessionMap.has(key)) {
    return getSession(key);
  }

  return createSession(key, null);
};

const createSession = (key: SessionKey, data?: null | SessionProp) => {
  const session = new Session(data);
  sessionMap.set(key, session);
  session.setPortMessage(key);

  return session;
};

const deleteSession = (key: SessionKey) => {
  sessionMap.delete(key);
};

const broadcastEvent = (ev: BroadcastEvent, data?: any, origin?: string) => {
  let sessions: { key: SessionKey; data: Session }[] = [];
  sessionMap.forEach((session, key) => {
    if (session && dappService.hasPermission(session.origin)) {
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
  broadcastEvent,
};
