import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { Env } from '../constant/env.js';
import { registerRoutes } from '../routes/register-routes.js';
import type { AppContext } from '../types/context.js';
import { registerErrorHandler } from './error-handler.js';
import { registerNotFound } from './not-found.js';
import { registerStatic } from './plugins/static.plugin.js';
import { registerSwagger } from './plugins/swagger.plugin.js';

/** Options for {@link createServer}. */
export interface CreateServerOptions {
  logger?: boolean;
  /** Serve the Swagger explorer at `/docs`. Off in tests — slow to boot. */
  docs?: boolean;
}

/**
 * Builds the Fastify instance and everything mounted on it.
 *
 * Returns without listening so tests can drive it through `fastify.inject()`
 * rather than over a real socket.
 *
 * **Registration order is load-bearing.** Static must come before Swagger
 * (which registers `@fastify/static` internally) and both must come before the
 * routes. Getting this wrong silently stops the frontend being served while
 * every health check still passes — it has happened once already.
 *
 * @param ctx the composed application context
 * @param env the validated environment
 * @param options logging and docs toggles
 * @returns the configured Fastify instance
 */
export async function createServer(
  ctx: AppContext,
  env: Env,
  options: CreateServerOptions = {}
): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  // Routes declare their bodies as zod schemas; without these Fastify tries to
  // read them as JSON Schema and refuses to build the route at all.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  if (env.WEB_ROOT !== undefined) await registerStatic(app, env.WEB_ROOT);
  if (options.docs === true) await registerSwagger(app);

  registerErrorHandler(app);
  registerRoutes(app, ctx);

  if (env.WEB_ROOT !== undefined) registerNotFound(app);

  return app;
}
