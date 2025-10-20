import Fastify, { FastifyInstance } from "fastify";
import { As4Client } from "./as4.js";
import { AuditBlobRepository } from "./audit-blob.js";
import { SbrService, SbrServiceDependencies } from "./service.js";

export interface BuildServerOptions {
  service?: SbrService;
  signingKeyPem?: string;
  auditRepo?: AuditBlobRepository;
  as4Client?: As4Client;
}

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const service = resolveService(options);
  const app = Fastify({ logger: false });

  app.get("/sbr/bas/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const submission = await service.getSubmissionDetail(id);
    if (!submission) {
      return reply.code(404).send({ error: "not_found" });
    }
    return { submission };
  });

  return app;
}

function resolveService(options: BuildServerOptions): SbrService {
  if (options.service) {
    return options.service;
  }
  const { signingKeyPem, auditRepo, as4Client } = options;
  if (!signingKeyPem) {
    throw new Error("signingKeyPem is required when building the default service");
  }
  const deps: SbrServiceDependencies = {
    signingKeyPem,
    auditRepo,
    as4Client,
  };
  return new SbrService(deps);
}
