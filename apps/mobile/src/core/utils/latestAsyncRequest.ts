export class LatestAsyncRequest {
  private sequence = 0;

  next() {
    this.sequence += 1;
    return this.sequence;
  }

  invalidate() {
    this.sequence += 1;
  }

  isCurrent(requestId: number) {
    return requestId === this.sequence;
  }
}
