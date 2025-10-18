import { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  subjectDataExportRequestSchema,
  subjectDataExportResponseSchema,
} from "../schemas/admin.data";

const principalSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  role: z.enum(["admin", "user"]),
  email: z.string().email(),
});

type Principal = z.infer<typeof principalSchema>;

type DbClient = {
  user: {
    findFirst: (args: {
      where: { email: string; orgId: string };
      select: {
        id: true;
        email: true;
        createdAt: true;
        org: { select: { id: true; name: true } };
      };
    }) => Promise<
      | {
          id: string;
          email: string;
          createdAt: Date;
          org: { id: string; name: string };
        }
      | null
    >;
  };
  bankLine: {
    count: (args: { where: { orgId: string } }) => Promise<number>;
  };
  accessLog?: {
    create: (args: {
      data: {
        event: string;
        orgId: string;
        principalId: string;
        subjectEmail: string;
      };
    }) => Promise<unknown>;
  };
};

type SecLogFn = (payload: {
  event: string;
  orgId: string;
  principal: string;
  subjectEmail: string;
}) => void;

const parsePrincipal = (req: FastifyRequest): Principal | null => {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  try {
    const decoded = Buffer.from(match[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return principalSchema.parse(parsed);
  } catch {
    return null;
  }
};

const adminDataRoutes: FastifyPluginAsync = async (app) => {
  const db: DbClient | undefined = (app as any).db;
  if (!db) {
    throw new Error("database client not registered");
  }

  const log: SecLogFn =
    (app as any).secLog ??
    ((entry) => {
      app.log.info({ event: entry.event, ...entry }, "security_event");
    });

  app.post("/admin/data/export", async (req, reply) => {
    const bodyResult = subjectDataExportRequestSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const body = bodyResult.data;

    const principal = parsePrincipal(req);
    if (!principal) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (principal.role !== "admin") {
      return reply.code(403).send({ error: "forbidden" });
    }

    if (principal.orgId !== body.orgId) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const userRecord = await db.user.findFirst({
      where: { email: body.email, orgId: body.orgId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        org: { select: { id: true, name: true } },
      },
    });

    if (!userRecord) {
      return reply.code(404).send({ error: "not_found" });
    }

    const bankLinesCount = await db.bankLine.count({
      where: { orgId: body.orgId },
    });

    const exportedAt = new Date().toISOString();

    if (db.accessLog?.create) {
      await db.accessLog.create({
        data: {
          event: "data_export",
          orgId: body.orgId,
          principalId: principal.id,
          subjectEmail: body.email,
        },
      });
    }

    log({
      event: "data_export",
      orgId: body.orgId,
      principal: principal.id,
      subjectEmail: body.email,
    });

    const responsePayload = {
      org: {
        id: userRecord.org.id,
        name: userRecord.org.name,
      },
      user: {
        id: userRecord.id,
        email: userRecord.email,
        createdAt: userRecord.createdAt.toISOString(),
      },
      relationships: {
        bankLinesCount,
      },
      exportedAt,
    };

    const validated = subjectDataExportResponseSchema.parse(responsePayload);

    return reply.send(validated);
  });
};

export default adminDataRoutes;
