declare module "redis" {
  export function createClient(options: { url: string }): {
    on(event: "error", listener: (err: unknown) => void): void;
    connect(): Promise<void>;
    exists(key: string): Promise<number>;
    set(key: string, value: string, options: { EX: number }): Promise<void>;
  };
}
