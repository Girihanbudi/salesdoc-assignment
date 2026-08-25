import type { FastifyInstance } from 'fastify';
import { ERR } from '../constant/error-codes.js';
import { metaFor } from './envelope.js';

/** Prefixes owned by the API. Anything else is a client-side route. */
const API_PREFIXES = ['/api', '/mock-crm', '/leads', '/docs'];

/**
 * Sends unknown API paths to a JSON 404 and everything else to the SPA.
 *
 * The explicit 200 matters: `sendFile` inside a `setNotFoundHandler` otherwise
 * keeps the 404 status, which is wrong for a page the app is meant to render —
 * and worse, it was returning `index.html` for JavaScript requests too.
 *
 * @param app the Fastify instance
 */
export function registerNotFound(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    const isApi = API_PREFIXES.some((prefix) => request.url.startsWith(prefix));

    return isApi
      ? reply.code(404).send({
          success: false,
          error: { code: ERR.NOT_FOUND, message: 'No such route' },
          meta: metaFor(request),
        })
      : reply.code(200).type('text/html').sendFile('index.html');
  });
}
