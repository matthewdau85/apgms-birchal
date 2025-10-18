declare function describe(name: string, fn: () => void | Promise<void>): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;

declare function expect(actual: any): {
  toBe(expected: any): void;
  toEqual(expected: any): void;
  toHaveBeenCalledTimes(expected: number): void;
};

declare namespace jest {
  interface Mock<T extends (...args: any[]) => any = (...args: any[]) => any> {
    (...args: Parameters<T>): ReturnType<T>;
    mockResolvedValueOnce(value: unknown): this;
    mockRejectedValueOnce(value: unknown): this;
    mockReset(): this;
    mockImplementation(implementation: T): this;
    mock: {
      calls: unknown[][];
    };
  }

  function fn<T extends (...args: any[]) => any = (...args: any[]) => any>(
    implementation?: T
  ): Mock<T>;
}

declare const jest: {
  fn: typeof jest.fn;
};
