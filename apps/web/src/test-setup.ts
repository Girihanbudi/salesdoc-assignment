import '@testing-library/jest-dom/vitest';

// jsdom has no layout engine, so scrollTo is unimplemented and logs a noisy
// "Not implemented" error for every route change. Stub it.
window.scrollTo = () => undefined;
