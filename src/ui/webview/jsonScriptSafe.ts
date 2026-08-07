/** Escape JSON so it is safe to embed inside a <script> HTML block. */
export function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
