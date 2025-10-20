export type CompareCallback = (err: Error | null, success?: boolean) => void;
export type HashCallback = (err: Error | null, hash?: string) => void;
export type SaltCallback = (err: Error | null, salt?: string) => void;

export function genSaltSync(rounds?: number): string;
export function genSalt(rounds?: number): Promise<string>;
export function genSalt(rounds: number, callback: SaltCallback): void;

export function hashSync(data: string | Buffer, salt: string | number): string;
export function hash(data: string | Buffer, salt: string | number): Promise<string>;
export function hash(data: string | Buffer, salt: string | number, callback: HashCallback): void;

export function compareSync(data: string | Buffer, encrypted: string): boolean;
export function compare(data: string | Buffer, encrypted: string): Promise<boolean>;
export function compare(data: string | Buffer, encrypted: string, callback: CompareCallback): void;

export function getRounds(encrypted: string): number;
export function getSalt(encrypted: string): string;

declare const _default: {
  genSaltSync: typeof genSaltSync;
  genSalt: typeof genSalt;
  hashSync: typeof hashSync;
  hash: typeof hash;
  compareSync: typeof compareSync;
  compare: typeof compare;
  getRounds: typeof getRounds;
  getSalt: typeof getSalt;
};

export default _default;
