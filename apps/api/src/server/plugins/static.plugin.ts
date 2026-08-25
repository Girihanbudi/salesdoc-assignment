import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

/**
 * Serves the built React app.
 *
 * **Must be registered before any route and before Swagger.** swagger-ui
 * registers `@fastify/static` internally, and registering ours after the routes
 * is what once stopped the frontend being served entirely: every asset fell
 * through to the SPA fallback as a 404 carrying `index.html`, so the page
 * rendered blank while `/api/health` and `/docs` both looked fine.
 *
 * @param app the Fastify instance
 * @param webRoot absolute path to the built frontend
 */
export async function registerStatic(app: FastifyInstance, webRoot: string): Promise<void> {
  await app.register(fastifyStatic, { root: webRoot });
}
