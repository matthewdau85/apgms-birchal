declare module 'argon2' {
  export interface Options {
    type?: number;
    memoryCost?: number;
    timeCost?: number;
    parallelism?: number;
    saltLength?: number;
  }

  export const argon2id: number;

  export default {
    hash(plain: string, options?: Options): Promise<string>;
    verify(hash: string, plain: string, options?: Options): Promise<boolean>;
    argon2id: number;
  };
}
