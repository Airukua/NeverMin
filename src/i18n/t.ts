import { MessageKey, messages } from './messages';
import { NeverminLanguage } from './types';
import { getLanguage } from '../utils/config';

export function t(key: MessageKey, vars?: Record<string, string | number>, lang?: NeverminLanguage): string {
  const locale = lang ?? getLanguage();
  const catalog = messages[locale] ?? messages.id;
  let text = catalog[key] ?? messages.id[key] ?? String(key);
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
    }
  }
  return text;
}
