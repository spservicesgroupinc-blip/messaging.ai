export class RequestGate {
  private epoch = 0;
  private revisions = new Map<string, number>();
  begin(scope: string) {
    const revision = (this.revisions.get(scope) ?? 0) + 1;
    this.revisions.set(scope, revision);
    return { scope, revision, epoch: this.epoch };
  }
  isCurrent(ticket: { scope: string; revision: number; epoch: number }) {
    return ticket.epoch === this.epoch && this.revisions.get(ticket.scope) === ticket.revision;
  }
  reset() { this.epoch++; this.revisions.clear(); }
}
