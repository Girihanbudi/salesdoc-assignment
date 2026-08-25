/**
 * What the UI shows for a failure.
 *
 * Lives on its own so the per-resource message files and the map that composes
 * them can both use it without importing each other.
 */
export interface UserMessage {
  /** One line. What happened, in the user's terms. */
  title: string;
  /** Optional second line: what to do next, or why it happened. */
  detail?: string;
}
