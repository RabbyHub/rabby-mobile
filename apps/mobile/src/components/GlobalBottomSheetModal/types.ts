export enum MODAL_NAMES {
  'APPROVAL' = 'APPROVAL',
}

export type CreateParams = {
  name: MODAL_NAMES;
  [key: string]: any;
};

export enum EVENT_NAMES {
  CREATE = 'CREATE',
  REMOVE = 'REMOVE',
  DISMISS = 'DISMISS',
  PRESENT = 'PRESENT',
}
