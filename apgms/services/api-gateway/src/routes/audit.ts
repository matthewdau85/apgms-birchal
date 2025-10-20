import type { FastifyInstance } from "fastify";
import { verifyRpt, verifyChain, type SignedRpt } from "../lib/rpt.js";

export interface AuditRouteOptions {
  loadRpt: (idOrHash: string) => Promise<SignedRpt | null | undefined>;
  loadPrev?: (idOrHash: string) => Promise<SignedRpt | null | undefined>;
  pubkey: Uint8Array | string;
}

const auditRoutes = async (app: FastifyInstance, opts: AuditRouteOptions): Promise<void> => {
  const { loadRpt, loadPrev, pubkey } = opts;
  const resolve = loadPrev ?? loadRpt;

  app.get("/audit/rpt/:id", async (req, rep) => {
    const { id } = req.params as { id: string };
    const head = await loadRpt(id);
    if (!head) {
      return rep.code(404).send({ ok: false, reason: "not_found" });
    }

    if (!(await verifyRpt(head, pubkey))) {
      return rep.code(400).send({ ok: false, reason: "invalid_signature" });
    }

    const chainOk = await verifyChain(id, async (key) => {
      if (key === id) {
        return head;
      }
      return resolve(key) ?? null;
    });

    if (!chainOk) {
      return rep.code(400).send({ ok: false, reason: "invalid_chain" });
    }

    return { ok: true, rpt: head };
  });
};

export default auditRoutes;
