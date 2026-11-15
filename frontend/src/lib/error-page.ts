/** Générateur de page HTML minimale utilisée quand le rendu serveur échoue. */
/** Rend une réponse HTML autonome, sans dépendre du bundle React en échec. */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Erreur — Douala Earth Watchers</title>
    <style>
      body { margin: 0; padding: 3rem 1rem; background: #f3f7fa; color: #14364b; font: 16px system-ui, sans-serif; }
      main { max-width: 36rem; margin: 10vh auto; padding: 2rem; border: 1px solid #d9e5eb; border-radius: 1rem; background: #fff; }
      a { color: #0876b9; }
    </style>
  </head>
  <body>
    <main>
      <h1>La page n’a pas pu être chargée</h1>
      <p>Une erreur technique est survenue. Réessayez ou retournez au tableau de bord.</p>
      <p><a href="/">Retour à l’accueil</a></p>
    </main>
  </body>
</html>`;
}
