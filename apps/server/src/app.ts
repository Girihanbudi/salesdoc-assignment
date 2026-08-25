import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import {
  CreateSessionBodySchema,
  EndCallBodySchema,
  type CRMActivity,
  type LineView,
  type SessionView,
} from "@salesdoc/shared";
import type { CrmDeps } from "./crm.js";
import { createDialer } from "./dialer.js";
import { registerDocs } from "./docs.js";
import { createSession, createStore, type Store } from "./store.js";

/** How long the mock CRM "network call" takes, in ms. */
const CRM_LATENCY_MIN_MS = 300;
const CRM_LATENCY_MAX_MS = 800;

/** Options for {@link buildApp}, all defaulted for production. */
export interface BuildAppOptions {
  store?: Store;
  logger?: boolean;
  /** Serve the Swagger explorer at `/docs`. Off in tests — it is slow to boot. */
  docs?: boolean;
}

/**
 * Wires the store, dialer, and routes into a Fastify instance.
 *
 * Returns the app without listening so tests can drive it through
 * `fastify.inject()` rather than over a real socket.
 *
 * Async because Swagger has to be registered before any route is added, or it
 * documents nothing.
 *
 * @param options optional store injection, logging, and docs control
 * @returns the configured Fastify instance
 */
export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const store = options.store ?? createStore();
  const app = Fastify({ logger: options.logger ?? false });

  if (options.docs === true) await registerDocs(app);

  const now = (): string => new Date().toISOString();
  const id = (): string => randomUUID().slice(0, 8);

  const crm: CrmDeps = {
    store,
    now,
    id,
    schedule: (fn, ms) => {
      setTimeout(fn, ms).unref();
    },
    latencyMs: () =>
      CRM_LATENCY_MIN_MS +
      Math.random() * (CRM_LATENCY_MAX_MS - CRM_LATENCY_MIN_MS),
  };

  const dialer = createDialer({
    store,
    now,
    id,
    random: Math.random,
    schedule: (fn, ms) => {
      const handle = setTimeout(fn, ms);
      handle.unref();
      return () => clearTimeout(handle);
    },
    crm,
  });

  app.setErrorHandler(
    (error: { statusCode?: number; message: string }, _request, reply) => {
      const status = error.statusCode ?? 500;
      reply.code(status).send({
        error: {
          code: status === 500 ? "INTERNAL" : "BAD_REQUEST",
          message: error.message,
        },
      });
    },
  );

  /**
   * Hydrates a call with its lead and CRM sync state for the UI.
   *
   * @param callId the call to render
   * @returns the line view, or null if the call or its lead is missing
   */
  function toLineView(callId: string): LineView | null {
    const call = store.calls.get(callId);
    if (!call) return null;
    const lead = store.leads.get(call.leadId);
    if (!lead) return null;
    return {
      call,
      lead,
      crmSyncStatus: store.crmSyncStatus.get(callId) ?? null,
    };
  }

  app.get("/api/health", { schema: { summary: "Liveness probe" } }, () => ({
    ok: true,
  }));

  app.get(
    "/api/leads",
    { schema: { tags: ["leads"], summary: "Every seeded lead" } },
    () => [...store.leads.values()],
  );

  app.post(
    "/api/sessions",
    {
      schema: {
        tags: ["sessions"],
        summary: "Create a session over selected leads",
      },
    },
    (request, reply) => {
      const parsed = CreateSessionBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid session request",
            details: parsed.error.flatten(),
          },
        });
      }

      const unknown = parsed.data.leadIds.filter(
        (leadId) => !store.leads.has(leadId),
      );
      if (unknown.length > 0) {
        return reply.code(400).send({
          error: {
            code: "UNKNOWN_LEAD",
            message: `No such lead: ${unknown.join(", ")}`,
          },
        });
      }

      const session = createSession(
        `session-${id()}`,
        parsed.data.agentId,
        parsed.data.leadIds,
      );
      store.sessions.set(session.id, session);
      return reply.code(201).send(session);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/sessions/:id/start",
    (request, reply) => {
      if (!store.sessions.has(request.params.id)) {
        return reply
          .code(404)
          .send({ error: { code: "NOT_FOUND", message: "No such session" } });
      }
      dialer.start(request.params.id);
      return store.sessions.get(request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/sessions/:id/stop",
    (request, reply) => {
      if (!store.sessions.has(request.params.id)) {
        return reply
          .code(404)
          .send({ error: { code: "NOT_FOUND", message: "No such session" } });
      }
      dialer.stop(request.params.id);
      return store.sessions.get(request.params.id);
    },
  );

  // The single endpoint the frontend polls. Fully hydrated so the client never
  // joins calls to leads itself.
  app.get<{ Params: { id: string } }>("/api/sessions/:id", (request, reply) => {
    const session = store.sessions.get(request.params.id);
    if (!session) {
      return reply
        .code(404)
        .send({ error: { code: "NOT_FOUND", message: "No such session" } });
    }

    const history = [...store.calls.values()]
      .filter((call) => call.sessionId === session.id)
      .map((call) => toLineView(call.id))
      .filter((line): line is LineView => line !== null)
      .reverse();

    const activities: CRMActivity[] = [...store.activities.values()]
      .filter((activity) =>
        history.some((line) => line.call.id === activity.callId),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const view: SessionView = {
      session,
      lines: session.activeCallIds
        .map(toLineView)
        .filter((line): line is LineView => line !== null),
      winner:
        session.winnerCallId === null ? null : toLineView(session.winnerCallId),
      history,
      upNext: session.leadQueue
        .map((leadId) => store.leads.get(leadId))
        .filter((lead) => lead !== undefined),
      activities,
    };
    return view;
  });

  app.post<{ Params: { id: string; callId: string } }>(
    "/api/sessions/:id/calls/:callId/end",
    (request, reply) => {
      const session = store.sessions.get(request.params.id);
      if (!session) {
        return reply
          .code(404)
          .send({ error: { code: "NOT_FOUND", message: "No such session" } });
      }

      const parsed = EndCallBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid disposition",
            details: parsed.error.flatten(),
          },
        });
      }

      if (session.winnerCallId !== request.params.callId) {
        return reply.code(409).send({
          error: {
            code: "NOT_ACTIVE",
            message: "That call is not the one currently holding the agent",
          },
        });
      }

      dialer.endCall(session.id, request.params.callId, parsed.data);
      return store.sessions.get(session.id);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/leads/:id/crm-activities",
    (request, reply) => {
      if (!store.leads.has(request.params.id)) {
        return reply
          .code(404)
          .send({ error: { code: "NOT_FOUND", message: "No such lead" } });
      }
      return [...store.activities.values()].filter(
        (a) => a.leadId === request.params.id,
      );
    },
  );

  // These two stand in for an external CRM's own API.
  app.get(
    "/mock-crm/contacts",
    { schema: { tags: ["mock-crm"], summary: "The CRM's contacts" } },
    () => [...store.crmContacts.values()],
  );
  app.get(
    "/mock-crm/activities",
    { schema: { tags: ["mock-crm"], summary: "The CRM's activities" } },
    () => [...store.crmActivities.values()],
  );

  return app;
}
