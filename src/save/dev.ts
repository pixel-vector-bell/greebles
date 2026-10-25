/**
 * Dev tools access. Shown only when the hub opens the game with ?dev=1 (the hub only adds that
 * for admin accounts) or on a local `npm run dev` build. Single-player game with a local save,
 * so this is a convenience gate, not a security boundary.
 */
export function devEnabled(): boolean {
  return new URLSearchParams(location.search).has('dev') || import.meta.env.DEV;
}
