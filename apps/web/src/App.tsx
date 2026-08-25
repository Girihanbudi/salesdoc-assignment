/**
 * Root component. Two screens, no router — the dashboard renders when a
 * session exists, the lead picker otherwise.
 */
export function App() {
  return (
    <main className="p-10">
      <h1 className="text-4xl font-bold">SalesDoc Dialer</h1>
      <p className="mt-2 text-[var(--color-muted)]">Scaffold. Screens land next.</p>
    </main>
  );
}
