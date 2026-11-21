// Installable web app: offline support in production builds only, so dev reloads stay fresh.
// `rootPath` is the path from the current page to the site root ("./" or "../").

export function registerOffline(rootPath: string, fontsToCache: string[] = []): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${rootPath}sw.js`, { scope: rootPath }).catch((error: unknown) => {
      console.warn("Service worker registration failed", error);
    });
    void cacheLoadedFonts(fontsToCache);
  });
}

/**
 * Web fonts load before the service worker controls the page, so hand their URLs to it
 * for offline use once they're loaded.
 */
async function cacheLoadedFonts(fontsToCache: string[]): Promise<void> {
  try {
    await Promise.all([...fontsToCache.map((font) => document.fonts.load(font)), document.fonts.ready]);
    const registration = await navigator.serviceWorker.ready;
    const stylesheets = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((link) => link.href);
    const urls = [...stylesheets, ...performance.getEntriesByType("resource").map((entry) => entry.name)];
    registration.active?.postMessage({ type: "cacheUrls", urls });
  } catch (error) {
    console.warn("Could not hand fonts to the service worker", error);
  }
}
