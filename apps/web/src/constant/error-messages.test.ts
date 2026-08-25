import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-error.js';
import { toUserMessage } from './error-messages.js';

/**
 * Every code the API can produce.
 *
 * Kept here by hand rather than imported: the API is a separate package, and
 * a copy that must be updated deliberately is the point — adding a code
 * server-side should fail this until somebody writes the wording for it.
 */
const SERVER_CODES = [
  'VALIDATION_FAILED',
  'INTERNAL',
  'NOT_FOUND',
  'LEAD.NOT_FOUND',
  'LEAD.UNKNOWN',
  'SESSION.NOT_FOUND',
  'CALL.NOT_ACTIVE',
  'ACTIVITY.NOT_FOUND',
  'AGENT.BUSY',
];

describe('toUserMessage', () => {
  it('has wording for every code the API can return', () => {
    // The split into per-resource files makes drift easy: a new code lands on
    // the server and nobody adds the message. This is what catches that.
    for (const code of SERVER_CODES) {
      const { title, detail } = toUserMessage(new ApiError(code, 'server wording'));

      // INTERNAL's own wording legitimately starts with "Oops"; what must not
      // happen is falling through to the unmapped branch, which is what the
      // appended code signals.
      expect(detail ?? '', code).not.toMatch(/Unexpected error/);
      expect(title, code).not.toBe('server wording');
    }
  });

  it('never leaks the server wording for an unmapped code', () => {
    const { title, detail } = toUserMessage(new ApiError('SOMETHING.NEW', 'connection pool died'));

    expect(title).toMatch(/something went wrong/i);
    // The code survives, because a user quoting it is useful in a bug report.
    expect(detail).toContain('SOMETHING.NEW');
    expect(detail).not.toContain('connection pool');
  });

  it('prefers the failing fields over the written wording for validation', () => {
    const { detail } = toUserMessage(
      new ApiError('VALIDATION_FAILED', 'bad request', [
        { path: 'leadIds', message: 'Select at least one lead' },
      ])
    );

    expect(detail).toBe('leadIds: Select at least one lead');
  });

  it('uses the caller context for a plain thrown value', () => {
    const { title } = toUserMessage(new Error('boom'), 'Could not start the session');
    expect(title).toBe('Could not start the session');
  });
});
