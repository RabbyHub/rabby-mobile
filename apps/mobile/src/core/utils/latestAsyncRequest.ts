export class LatestAsyncRequest {
  private issuedSequence = 0;

  private activeSequence = 0;

  reserve() {
    this.issuedSequence += 1;
    return this.issuedSequence;
  }

  activate(requestId: number) {
    if (requestId > this.activeSequence) {
      this.activeSequence = requestId;
    }

    return this.isCurrent(requestId);
  }

  next() {
    const requestId = this.reserve();
    this.activate(requestId);
    return requestId;
  }

  invalidate() {
    const requestId = this.reserve();
    this.activeSequence = requestId;
  }

  isCurrent(requestId: number) {
    return requestId === this.activeSequence;
  }
}
