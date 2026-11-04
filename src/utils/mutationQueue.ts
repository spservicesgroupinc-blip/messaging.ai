/** Preserve user actions in submission order, including after a failed action. */
export class MutationQueue {
  private tail: Promise<void> = Promise.resolve();
  size = 0;

  run<T>(operation: () => Promise<T>): Promise<T> {
    this.size++;
    const result = this.tail.then(operation);
    this.tail = result.then(() => { this.size--; }, () => { this.size--; });
    return result;
  }
}
