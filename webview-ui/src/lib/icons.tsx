import type { LucideIcon } from 'lucide-react';
import {
  Box,
  Calendar,
  BarChart3,
  CircleHelp,
  Database,
  FileCode,
  Folder,
  Globe,
  LayoutTemplate,
  Link2,
  List,
  Lock,
  Map,
  Menu,
  PanelLeft,
  PanelTop,
  Settings,
  SquareFunction,
  TextCursorInput,
  User
} from 'lucide-react';

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

const ICONS: Record<NodeCardIcon, LucideIcon> = {
  map: Map,
  nav: PanelTop,
  sidebar: PanelLeft,
  menu: Menu,
  user: User,
  card: LayoutTemplate,
  data: Database,
  api: Globe,
  config: Settings,
  chart: BarChart3,
  list: List,
  form: TextCursorInput,
  calendar: Calendar,
  auth: Lock,
  hook: Link2,
  file: FileCode,
  fn: SquareFunction,
  class: Box,
  generic: CircleHelp
};

export function getLucideIcon(key: string | undefined): LucideIcon {
  if (key && key in ICONS) {
    return ICONS[key as NodeCardIcon];
  }
  return CircleHelp;
}

export { Folder, FileCode };

export function inferNodeIcon(name: string, filePath?: string, kind?: string): NodeCardIcon {
  const base = name.includes('/') ? name.split('/').pop() || name : name;
  const text = `${base} ${filePath || ''}`
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-./\\]+/g, ' ')
    .toLowerCase();

  const rules: Array<{ icon: NodeCardIcon; re: RegExp }> = [
    { icon: 'map', re: /\b(map|geo|leaflet|marker|lokasi|location|peta|pin)\b/ },
    { icon: 'nav', re: /\b(navbar|nav\b|header|topbar)\b/ },
    { icon: 'sidebar', re: /\b(sidebar|aside|drawer)\b/ },
    { icon: 'menu', re: /\b(dropdown|menu|popover)\b/ },
    { icon: 'calendar', re: /\b(calendar|date|month|day|picker)\b/ },
    { icon: 'user', re: /\b(responden|user|person|profile|avatar)\b/ },
    { icon: 'auth', re: /\b(auth|login|logout|session|token)\b/ },
    { icon: 'card', re: /\b(card|tile|widget|badge)\b/ },
    { icon: 'chart', re: /\b(chart|graph|analytics|metric|stat|bar)\b/ },
    { icon: 'data', re: /\b(data|db|database|store|repository)\b/ },
    { icon: 'api', re: /\b(api|http|fetch|request|endpoint|service)\b/ },
    { icon: 'form', re: /\b(form|input|field|select|editor)\b/ },
    { icon: 'list', re: /\b(list|grid|table|collection)\b/ },
    { icon: 'config', re: /\b(config|setting|option|theme)\b/ },
    { icon: 'hook', re: /\b(hook|provider|context)\b/ }
  ];
  for (const rule of rules) {
    if (rule.re.test(text)) {
      return rule.icon;
    }
  }
  const k = (kind || '').toLowerCase();
  if (k === 'class' || k === 'interface') return 'class';
  if (k === 'function' || k === 'method') return 'fn';
  if (k === 'file') return 'file';
  return 'generic';
}
