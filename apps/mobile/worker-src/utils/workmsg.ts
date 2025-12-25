/// <reference path="../worker-duplex.d.ts" />

export function jsonResponse<T extends WorkerDuplexReceive>(data: T) {
  return JSON.stringify(data);
}

export function parseRequest<T extends WorkerDuplexPost>(data: string): T {
  return JSON.parse(data) as T;
}
