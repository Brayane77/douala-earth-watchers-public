/** Middlewares de démarrage TanStack Start pour erreurs serveur et protection CSRF des server functions. */
import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start';
import { renderErrorPage } from './lib/error-page';

// Convertit les erreurs serveur inattendues en page HTML et laisse passer les erreurs HTTP gérées.
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
});

// Applique la protection CSRF aux fonctions serveur sans modifier les routes de lecture.
const csrfMiddleware = createCsrfMiddleware({ filter: (context) => context.handlerType === 'serverFn' });

// Enregistre les deux middlewares au démarrage de l’application TanStack Start.
export const startInstance = createStart(() => ({ requestMiddleware: [errorMiddleware, csrfMiddleware] }));
