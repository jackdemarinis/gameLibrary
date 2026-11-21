// Every game page lives one folder below the library home (e.g. /dustline/).

export function libraryHomeUrl(): string {
  return new URL("../", window.location.href).href;
}

export function goToLibrary(): void {
  window.location.assign(libraryHomeUrl());
}
