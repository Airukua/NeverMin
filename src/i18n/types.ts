export type NeverminLanguage = 'id' | 'en';

export const NEVERMIN_LANGUAGES: readonly NeverminLanguage[] = ['id', 'en'] as const;

export function isNeverminLanguage(value: unknown): value is NeverminLanguage {
  return value === 'id' || value === 'en';
}

export function languageDisplayName(lang: NeverminLanguage): string {
  return lang === 'en' ? 'English' : 'Bahasa Indonesia';
}
