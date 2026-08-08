/**
 * Icon keys for NeverMIN node cards (LLM prompts + Mermaid data-icon hydrate in webview-ui).
 * Actual SVG rendering lives in webview-ui via lucide-react — not here.
 */

export type NodeCardIcon =
  | 'map'
  | 'nav'
  | 'sidebar'
  | 'menu'
  | 'user'
  | 'card'
  | 'data'
  | 'api'
  | 'config'
  | 'chart'
  | 'list'
  | 'form'
  | 'calendar'
  | 'auth'
  | 'hook'
  | 'file'
  | 'fn'
  | 'class'
  | 'generic';

export const NODE_CARD_ICONS: readonly NodeCardIcon[] = [
  'map',
  'nav',
  'sidebar',
  'menu',
  'user',
  'card',
  'data',
  'api',
  'config',
  'chart',
  'list',
  'form',
  'calendar',
  'auth',
  'hook',
  'file',
  'fn',
  'class',
  'generic'
] as const;

export function isNodeCardIcon(value: string): value is NodeCardIcon {
  return (NODE_CARD_ICONS as readonly string[]).includes(value);
}

export function inferNodeIcon(
  name: string,
  options?: { kind?: string; filePath?: string }
): NodeCardIcon {
  const base =
    name.includes('/') || name.includes('\\')
      ? name.replace(/\\/g, '/').split('/').pop() || name
      : name;
  const text = `${base} ${options?.filePath || ''}`
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-./\\]+/g, ' ')
    .toLowerCase();

  const rules: Array<{ icon: NodeCardIcon; re: RegExp }> = [
    { icon: 'map', re: /\b(map|geo|leaflet|marker|lokasi|location|peta|pin|coordinate)\b/ },
    { icon: 'nav', re: /\b(navbar|nav\b|header|topbar|app.?bar)\b/ },
    { icon: 'sidebar', re: /\b(sidebar|side.?bar|aside|drawer)\b/ },
    { icon: 'menu', re: /\b(dropdown|menu|popover|context.?menu)\b/ },
    { icon: 'calendar', re: /\b(calendar|date|month|day|picker|schedule|waktu)\b/ },
    { icon: 'user', re: /\b(responden|user|person|people|profile|avatar|member|customer)\b/ },
    { icon: 'auth', re: /\b(auth|login|logout|session|token|permission|role|oauth)\b/ },
    { icon: 'card', re: /\b(card|tile|widget|badge|chip)\b/ },
    { icon: 'chart', re: /\b(chart|graph|analytics|metric|stat|plot|dashboard|bar)\b/ },
    { icon: 'data', re: /\b(data|db|database|store|repository|model|schema|query)\b/ },
    { icon: 'api', re: /\b(api|http|fetch|request|response|endpoint|service)\b/ },
    { icon: 'form', re: /\b(form|input|field|select|checkbox|textarea|editor)\b/ },
    { icon: 'list', re: /\b(list|grid|table|row|column|collection)\b/ },
    { icon: 'config', re: /\b(config|setting|option|preference|env|theme)\b/ },
    { icon: 'hook', re: /\b(hook|provider|context)\b/ },
    { icon: 'sidebar', re: /\b(panel|layout)\b/ }
  ];
  for (const rule of rules) {
    if (rule.re.test(text)) {
      return rule.icon;
    }
  }
  const kind = (options?.kind || '').toLowerCase();
  if (kind === 'class' || kind === 'interface' || kind === 'type') {
    return 'class';
  }
  if (kind === 'function' || kind === 'method') {
    return 'fn';
  }
  if (kind === 'file') {
    return 'file';
  }
  return 'generic';
}
