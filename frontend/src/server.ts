/** Adaptateur serveur qui délègue à TanStack Start et convertit les erreurs SSR catastrophiques en HTML. */
import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
// Surface minimale requise de l’entrée TanStack Start chargée dynamiquement.
type ServerEntry = { fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response };
// Réutilise la même promesse pour éviter plusieurs imports concurrents.
let serverEntryPromise: Promise<ServerEntry> | undefined;
/** Charge une seule fois l’entrée serveur TanStack Start. */
async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) serverEntryPromise = import("@tanstack/react-start/server-entry").then((m) => (m.default ?? m) as ServerEntry);
  return serverEntryPromise;
}
/** Transforme uniquement la réponse JSON d’erreur H3 reconnue en page HTML. */
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
}
/** Reconnaît la forme H3 précise qui masque une erreur de rendu SSR. */
function isH3SwallowedErrorBody(body: string): boolean {
  try { const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown }; return payload.unhandled === true && payload.message === "HTTPError"; }
  catch { return false; }
}
// Adapte la méthode Fetch attendue par le serveur à l’entrée applicative TanStack.
export default {
  // Relaye chaque requête à TanStack et transforme les erreurs SSR non traitées.
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try { const handler = await getServerEntry(); const response = await handler.fetch(request, env, ctx); return await normalizeCatastrophicSsrResponse(response); }
    catch (error) { console.error(error); return new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } }); }
  },
};
