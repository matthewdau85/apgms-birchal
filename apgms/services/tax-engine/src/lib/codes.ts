export enum TaxCode {
  GST = 'GST',
  FRE = 'FRE',
  NT = 'N-T',
  INP = 'INP',
  CAP = 'CAP'
}

export interface TaxCodeBehaviour {
  readonly collectsGst: boolean;
  readonly claimsGst: boolean;
  readonly reportsSale: boolean;
  readonly reportsFree: boolean;
}

const behaviours: Record<TaxCode, TaxCodeBehaviour> = {
  [TaxCode.GST]: { collectsGst: true, claimsGst: true, reportsSale: true, reportsFree: false },
  [TaxCode.FRE]: { collectsGst: false, claimsGst: false, reportsSale: true, reportsFree: true },
  [TaxCode.NT]: { collectsGst: false, claimsGst: false, reportsSale: false, reportsFree: false },
  [TaxCode.INP]: { collectsGst: false, claimsGst: false, reportsSale: false, reportsFree: false },
  [TaxCode.CAP]: { collectsGst: false, claimsGst: true, reportsSale: false, reportsFree: false }
};

export function behaviourFor(code: TaxCode): TaxCodeBehaviour {
  return behaviours[code];
}

export function isTaxCode(value: string): value is TaxCode {
  return (Object.values(TaxCode) as string[]).includes(value);
}
