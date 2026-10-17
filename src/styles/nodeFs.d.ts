/** The one Node API the stylesheet contract test uses (the project has no @types/node). */
declare module 'node:fs' {
  export function readFileSync(path: URL, encoding: 'utf8'): string;
}
