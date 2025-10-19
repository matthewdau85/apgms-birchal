import { fileURLToPath } from 'node:url';
import { basename } from 'node:path';

import as4CertExpiring from './redteam/as4_cert_expiring.json';
import as4ClockSkew from './redteam/as4_clock_skew.json';
import as4DupMsgId from './redteam/as4_dup_msgid.json';

type RedTeamScenario = {
  id: string;
  summary: string;
  profile: string;
  category: string;
  input: Record<string, unknown>;
  expectations: Record<string, unknown>;
};

export const redteamScenarios: readonly RedTeamScenario[] = [
  as4CertExpiring,
  as4ClockSkew,
  as4DupMsgId
];

if (process.argv[1] && basename(fileURLToPath(import.meta.url)) === basename(process.argv[1])) {
  console.log(JSON.stringify(redteamScenarios, null, 2));
}
