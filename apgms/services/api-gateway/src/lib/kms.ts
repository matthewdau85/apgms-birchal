import { DevKms } from "./rpt";

const secret = process.env.DEV_KMS_SECRET ?? "dev-secret";

export const kms = new DevKms(secret);
