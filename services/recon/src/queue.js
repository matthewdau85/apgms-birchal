export class InMemoryQueue {
  constructor() {
    this.items = [];
  }

  enqueue(item) {
    this.items.push({ item, enqueuedAt: new Date() });
  }
}
