export class RequestGate {
  private lastStart: number | null = null;
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly minIntervalMs: number,
    private readonly maxConcurrency: number,
    private readonly now: () => number = () => Date.now(),
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }),
  ) {}

  async acquire(): Promise<void> {
    if (this.active >= this.maxConcurrency) {
      await new Promise<void>((resolve) => {
        this.waiting.push(resolve);
      });
    }
    this.active += 1;
    const wait =
      this.lastStart === null ? 0 : this.minIntervalMs - (this.now() - this.lastStart);
    if (wait > 0) await this.sleep(wait);
    this.lastStart = this.now();
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.waiting.shift();
    next?.();
  }
}
