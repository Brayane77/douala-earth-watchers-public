/** Compléments jsdom pour les API navigateur utilisées par les tests React. */
import "@testing-library/jest-dom/vitest";
Object.defineProperty(window, "scrollTo", { writable: true, value: () => {} });
Object.defineProperty(window, "matchMedia", { writable: true, value: (query: string) => ({
  matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {},
}) });
