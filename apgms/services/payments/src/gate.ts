export type GateState = 'OPEN' | 'CLOSED';

export class Gate {
  private state: GateState;

  constructor(initial: GateState = 'OPEN') {
    this.state = initial;
  }

  open(): void {
    this.state = 'OPEN';
  }

  close(): void {
    this.state = 'CLOSED';
  }

  isOpen(): boolean {
    return this.state === 'OPEN';
  }
}
