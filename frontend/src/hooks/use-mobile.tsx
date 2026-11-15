/** Hook React qui suit le passage au format mobile à partir de la largeur de la fenêtre. */
import * as React from "react";
// Seuil en pixels utilisé par la mise en page responsive pour basculer en mobile.
const MOBILE_BREAKPOINT = 768;
/** Renvoie l’état mobile et retire l’écouteur lors du démontage du composant. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    // Répercute le changement de largeur dans l’état React sans garder de listener orphelin.
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return !!isMobile;
}
