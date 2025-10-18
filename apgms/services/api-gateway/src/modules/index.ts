import type { FastifyInstance } from "fastify";

import { registerHealthModule } from "./health";
import { registerUserModule } from "./users";
import { registerBankLineModule } from "./bank-lines";
import { registerOrgModule } from "./orgs";
import { registerReconciliationModule } from "./reconciliation";
import { registerPaymentModule } from "./payments";

export async function registerModules(app: FastifyInstance): Promise<void> {
  await registerHealthModule(app);
  await registerOrgModule(app);
  await registerUserModule(app);
  await registerBankLineModule(app);
  await registerReconciliationModule(app);
  await registerPaymentModule(app);
}
