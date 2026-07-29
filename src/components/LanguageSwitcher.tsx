'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const LANGUAGES = [
  { code: 'en', label: 'English', controlLabel: 'Language' },
  { code: 'es', label: 'Español', controlLabel: 'Idioma' },
  { code: 'zh', label: '中文（普通话）', controlLabel: '语言' },
  { code: 'vi', label: 'Tiếng Việt', controlLabel: 'Ngôn ngữ' },
  { code: 'ru', label: 'Русский', controlLabel: 'Язык' },
  { code: 'tl', label: 'Tagalog', controlLabel: 'Wika' },
  { code: 'ko', label: '한국어', controlLabel: '언어' },
] as const;

type LanguageCode = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'wa-funding-language';
/*
  Anything under one of these should never be swapped for a translated
  string: form controls, code/URLs, and - the important one -
  data-no-translate, which every component that renders a proper noun from a
  data file (legislator names, district names, county names) sets on its own
  wrapper. Dictionary lookups already leave untracked strings alone, but a
  short name can coincidentally match a dictionary entry (a district called
  "Union" is also the English word "union"), so names get an explicit opt-out
  rather than relying on that alone.
*/
const SKIP_SELECTOR =
  '[data-no-translate], script, style, noscript, code, pre, textarea, select, option';

type Dictionary = Record<string, string>;
let translationsPromise: Promise<Record<string, Dictionary>> | null = null;

function loadTranslations() {
  if (!translationsPromise) {
    translationsPromise = import('@/data/translations.json').then(
      (mod) => mod.default as Record<string, Dictionary>
    );
  }
  return translationsPromise;
}

function isLanguageCode(value: string | null): value is LanguageCode {
  return LANGUAGES.some((language) => language.code === value);
}

function collectTextNodes(root: Node) {
  const nodes: Text[] = [];
  const documentRef =
    root.nodeType === Node.DOCUMENT_NODE ? (root as Document) : root.ownerDocument;
  if (!documentRef) return nodes;

  const addIfTranslatable = (node: Text) => {
    const parent = node.parentElement;
    const text = node.nodeValue ?? '';
    if (parent && !parent.closest(SKIP_SELECTOR) && /[A-Za-z]/.test(text) && text.trim().length > 1) {
      nodes.push(node);
    }
  };

  if (root.nodeType === Node.TEXT_NODE) {
    addIfTranslatable(root as Text);
    return nodes;
  }

  const walker = documentRef.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    addIfTranslatable(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

/**
 * Every original English string this component has swapped out, keyed by the
 * live text node, so switching back to English (or re-translating after the
 * text underneath changes - a slider being dragged, a different district
 * selected) always starts from the true source rather than from whatever
 * translated text happens to be sitting in the DOM.
 */
const sourceByNode = new WeakMap<Text, string>();

/**
 * Swap every translatable text node under `root` for its dictionary entry.
 * This is a single synchronous pass over already-loaded data - no network
 * call, no per-node async work, so there is nothing to race and nothing to
 * wait on. A string with no dictionary entry (every proper noun pulled from
 * a data file - legislator names, district and county names, bill numbers -
 * since those never appear as literal text in the source the dictionary was
 * built from) is left exactly as written in English.
 */
function applyDictionary(root: Node, dictionary: Dictionary, targetLanguage: LanguageCode) {
  for (const node of collectTextNodes(root)) {
    const source = sourceByNode.get(node) ?? node.nodeValue ?? '';
    if (!sourceByNode.has(node)) sourceByNode.set(node, source);

    const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) continue;
    const [, lead, body, trail] = match;
    const translated = dictionary[body];
    if (translated) {
      const next = `${lead}${translated}${trail}`;
      if (node.nodeValue !== next) node.nodeValue = next;
    } else if (targetLanguage === 'en' && node.nodeValue !== source) {
      node.nodeValue = source;
    }
  }
}

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const [language, setLanguage] = useState<LanguageCode>('en');
  const languageRef = useRef<LanguageCode>('en');
  const dictionariesRef = useRef<Record<string, Dictionary> | null>(null);
  const observerTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const currentLanguage = LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0];

  const applyToDocument = (targetLanguage: LanguageCode) => {
    const dictionary =
      targetLanguage === 'en' ? {} : dictionariesRef.current?.[targetLanguage] ?? {};
    applyDictionary(document.body, dictionary, targetLanguage);
    document.documentElement.lang = targetLanguage;
  };

  const applyLanguage = async (targetLanguage: LanguageCode) => {
    languageRef.current = targetLanguage;
    setLanguage(targetLanguage);
    window.localStorage.setItem(STORAGE_KEY, targetLanguage);

    if (targetLanguage !== 'en' && !dictionariesRef.current) {
      dictionariesRef.current = await loadTranslations();
      // The visitor may have switched languages again while this loaded.
      if (languageRef.current !== targetLanguage) return;
    }
    applyToDocument(targetLanguage);
  };

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguageCode(saved) && saved !== 'en') void applyLanguage(saved);
    // Runs once to restore a visitor's saved language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Re-apply after Next.js swaps the page on navigation.
    if (languageRef.current !== 'en') applyToDocument(languageRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      if (languageRef.current === 'en') return;
      const roots = mutations.flatMap((m) => Array.from(m.addedNodes));
      if (roots.length === 0) return;
      // A short debounce coalesces a burst of DOM changes (e.g. selecting a
      // district mounts a dozen new cards at once) into a single pass instead
      // of one per node.
      clearTimeout(observerTimerRef.current);
      observerTimerRef.current = setTimeout(() => {
        const dictionary = dictionariesRef.current?.[languageRef.current] ?? {};
        for (const root of roots) applyDictionary(root, dictionary, languageRef.current);
      }, 30);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      clearTimeout(observerTimerRef.current);
    };
    // The observer reads the active language from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-2" data-no-translate>
      <label htmlFor="site-language" className="text-xs font-medium text-ink-secondary">
        {currentLanguage.controlLabel}
      </label>
      <select
        id="site-language"
        value={language}
        onChange={(event) => void applyLanguage(event.target.value as LanguageCode)}
        className="rounded border border-line bg-surface px-2 py-1.5 text-sm text-ink"
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
