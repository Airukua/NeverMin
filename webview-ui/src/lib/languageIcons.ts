import type { IconType } from 'react-icons';
import {
  SiC,
  SiCplusplus,
  SiDotnet,
  SiGo,
  SiJavascript,
  SiKotlin,
  SiPhp,
  SiPython,
  SiRuby,
  SiRust,
  SiTypescript
} from 'react-icons/si';
import { FaJava } from 'react-icons/fa';

const LANGUAGE_ICONS: Record<string, IconType> = {
  Python: SiPython,
  TypeScript: SiTypescript,
  JavaScript: SiJavascript,
  Go: SiGo,
  Rust: SiRust,
  Java: FaJava,
  Kotlin: SiKotlin,
  Ruby: SiRuby,
  PHP: SiPhp,
  'C#': SiDotnet,
  'C++': SiCplusplus,
  C: SiC
};

const LANGUAGE_COLORS: Record<string, string> = {
  Python: '#3776AB',
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Go: '#00ADD8',
  Rust: '#DEA584',
  Java: '#ED8B00',
  Kotlin: '#7F52FF',
  Ruby: '#CC342D',
  PHP: '#777BB4',
  'C#': '#512BD4',
  'C++': '#00599C',
  C: '#A8B9CC'
};

export function getLanguageIcon(language: string): IconType | null {
  return LANGUAGE_ICONS[language] ?? null;
}

export function getLanguageColor(language: string): string {
  return LANGUAGE_COLORS[language] ?? '#e8ecf4';
}
