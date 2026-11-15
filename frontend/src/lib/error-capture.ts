/** Capture courte des erreurs serveur afin de rendre les échecs SSR diagnostiquables. */
let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5000;
/** Mémorise une erreur et l’instant de capture pour une consommation à court terme. */
function record(error: unknown) { lastCapturedError = { error, at: Date.now() }; }
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => { const expanded = args.map((arg) => { if (!(arg instanceof Error)) return arg; record(arg); return `${arg.stack ?? `${arg.name}: ${arg.message}`}`; }); originalConsoleError(...expanded); };
if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) => record((event as PromiseRejectionEvent).reason));
}
/** Renvoie une fois la dernière erreur encore dans sa fenêtre de validité. */
export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) { lastCapturedError = undefined; return undefined; }
  const { error } = lastCapturedError; lastCapturedError = undefined; return error;
}
