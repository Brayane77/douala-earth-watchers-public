/** Route racine : métadonnées, styles, fournisseurs React et vues d’erreur communes. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import appCss from '../styles.css?url';
import { THEME_BOOT_SCRIPT } from '../lib/theme';

/** Affiche un état 404 avec un lien vers la page d’accueil. */
function NotFoundComponent() {
  return (
    <main className="app-message-screen">
      <div className="app-message-card">
        <span className="eyebrow">DOUALA EARTH WATCHERS</span>
        <h1>Page introuvable</h1>
        <p>Cette adresse ne correspond pas à une page du tableau de bord.</p>
        <Link to="/" className="primary-link">Retour à la vue d’ensemble</Link>
      </div>
    </main>
  );
}

/** Présente une erreur de route et propose une nouvelle tentative de navigation. */
function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  console.error(error);

  return (
    <main className="app-message-screen">
      <div className="app-message-card">
        <span className="eyebrow">DOUALA EARTH WATCHERS</span>
        <h1>Une erreur est survenue</h1>
        <p>Le tableau de bord n’a pas pu s’afficher. Vous pouvez réessayer.</p>
        <div className="message-actions">
          <button type="button" className="primary-button" onClick={() => { router.invalidate(); reset(); }}>Réessayer</button>
          <Link to="/" className="secondary-link">Retour à l’accueil</Link>
        </div>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Douala Earth Watchers — Observatoire environnemental' },
      { name: 'description', content: 'Tableau de bord climatique de Douala alimenté par les séries NASA du dépôt.' },
      { property: 'og:title', content: 'Douala Earth Watchers' },
      { property: 'og:description', content: 'Observations climatiques mensuelles et provenance des données NASA.' },
      { property: 'og:type', content: 'website' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'stylesheet', href: appCss },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap' },
    ],
    // Applique le thème mémorisé avant le premier rendu : le fond blanc reste le défaut
    // et un choix sombre ne provoque pas d'éclair blanc au chargement.
    scripts: [{ children: THEME_BOOT_SCRIPT }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

/** Entoure les routes avec le document HTML, les métadonnées et les scripts. */
function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Fournit le client de requêtes partagé aux routes enfants. */
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return <QueryClientProvider client={queryClient}><Outlet /></QueryClientProvider>;
}
