import Fastify, { FastifyInstance } from 'fastify';
import { promises as fs } from 'node:fs';

import {
  ARTIFACT_ROOT,
  artifactIdToPath,
  buildAs4Envelope,
  computeCanonicalHash,
  createReceipt,
  getArtifactContentType,
  persistArtifacts,
  signDigest,
} from './as4';

interface SendRequestBody {
  payload?: unknown;
}

export const buildSbrServer = async (): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });

  app.post<{ Body: SendRequestBody }>('/sbr/send', async (request, reply) => {
    const input = request.body ?? {};
    const { payload = null } = input;

    const { messageId, envelope, createdAt } = buildAs4Envelope({ payload });
    const digest = computeCanonicalHash(envelope);
    const signature = signDigest(digest);
    const receipt = createReceipt({ messageId, digest, signature, createdAt });

    const artifacts = await persistArtifacts({
      messageId,
      envelope,
      digest,
      receipt,
      signature,
    });

    reply.code(201).send({
      messageId,
      digest,
      signature,
      artifacts,
      artifactRoot: ARTIFACT_ROOT,
    });
  });

  app.get<{ Params: { id: string } }>('/sbr/artifact/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      const { path: artifactPath, name } = artifactIdToPath(id);
      const payload = await fs.readFile(artifactPath);
      reply.type(getArtifactContentType(name));
      reply.send(payload);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reply.code(404).send({ message: 'Artifact not found' });
        return;
      }

      reply.code(400).send({ message: 'Invalid artifact id' });
    }
  });

  return app;
};
