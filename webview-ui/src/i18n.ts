import { getBoot } from './vscodeApi';

type Vars = Record<string, string | number>;

let catalog: Record<string, string> = { ...(getBoot()?.i18n ?? {}) };

export function setWebviewI18n(next: Record<string, string> | undefined | null): void {
  catalog = { ...(next ?? {}) };
}

export function tw(key: string, vars?: Vars): string {
  let text = catalog[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
}
