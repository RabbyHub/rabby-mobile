import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { BroadcastEvent } from '@/constant/event';
import { BackgroundBridge } from '../bridges/BackgroundBridge';
import { globalSerivceEvents } from '../apis/serviceEvent';
import { MobileSession } from '../controllers/type';

// import { permissionService } from 'background/service';
// import PortMessage from '@/utils/message/portMessage';

export type SessionProp = MobileSession;

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

    console.debug('Session::setProp', origin, icon, name);
  }
}

// for each tab
const sessionMap = new Map<BackgroundBridge, Session | null>();

const createSession = (key: SessionKey, data?: null | SessionProp) => {
  const session = new Session(data);
  sessionMap.set(key, session);
  session.setPortMessage(key);

  return session;
};

export class SessionService {
  dappService: import('./dappService').DappService;

  constructor({ dappService }: { dappService: any }) {
    this.dappService = dappService;
  }

  getSessionMap = () => {
    return sessionMap;
  };
  getSession = (key: SessionKey) => {
    return sessionMap.get(key);
  };

  getOrCreateSession = (key: SessionKey) => {
    if (sessionMap.has(key)) {
      return this.getSession(key);
    }

    return createSession(key, null);
  };

  deleteSession = (key: SessionKey) => {
    sessionMap.delete(key);
  };

  broadcastEvent = (ev: BroadcastEvent, data?: any, origin?: string) => {
    let sessions: { key: SessionKey; data: Session }[] = [];
    sessionMap.forEach((session, key) => {
      if (session && this.dappService.hasPermission(session.origin)) {
        sessions.push({
          key,
          data: session,
        });
      }
    });

    // same origin
    if (origin) {
      sessions = sessions.filter(
        session => safeGetOrigin(session.data.origin) === safeGetOrigin(origin),
      );
    }

    sessions.forEach(session => {
      try {
        // TODO: avoid push data to hidden tab
        session.data.pushMessage?.(ev, data);
      } catch (e) {
        __DEV__ && console.error(e);
        if (sessionMap.has(session.key)) {
          this.deleteSession(session.key);
        }
      }
    });

    globalSerivceEvents.emit(`srvEvent:${ev}`);
  };
}
