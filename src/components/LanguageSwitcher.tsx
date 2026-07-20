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
type TranslationStatus = 'idle' | 'translating' | 'ready' | 'unavailable';

type BrowserTranslator = {
  translate: (input: string) => Promise<string>;
  destroy?: () => void;
};

type BrowserTranslatorApi = {
  availability: (options: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<string>;
  create: (options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: EventTarget) => void;
  }) => Promise<BrowserTranslator>;
};

type TranslationRecord = {
  source: string;
  rendered?: string;
  renderedLanguage?: LanguageCode;
};

const STORAGE_KEY = 'wa-funding-language';
const SKIP_SELECTOR =
  '[data-no-translate], script, style, noscript, code, pre, textarea';

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
    if (
      parent &&
      !parent.closest(SKIP_SELECTOR) &&
      /[A-Za-z]/.test(text) &&
      text.trim().length > 1
    ) {
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

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const languageRef = useRef<LanguageCode>('en');
  const recordsRef = useRef(new WeakMap<Text, TranslationRecord>());
  const cacheRef = useRef(new Map<string, Promise<string>>());
  const translatorsRef = useRef(
    new Map<LanguageCode, Promise<BrowserTranslator>>()
  );
  const runRef = useRef(0);
  const observerTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const currentLanguage =
    LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0];

  const restoreEnglish = () => {
    runRef.current += 1;
    for (const node of collectTextNodes(document.body)) {
      const record = recordsRef.current.get(node);
      if (record && node.nodeValue !== record.source) {
        node.nodeValue = record.source;
        record.rendered = undefined;
        record.renderedLanguage = undefined;
      }
    }
    document.documentElement.lang = 'en';
    setStatus('idle');
  };

  const getTranslator = async (targetLanguage: LanguageCode) => {
    const existing = translatorsRef.current.get(targetLanguage);
    if (existing) return existing;

    const translatorApi = (
      window as Window & { Translator?: BrowserTranslatorApi }
    ).Translator;

    if (!translatorApi) {
      throw new Error('Browser translation is unavailable');
    }

    const translatorPromise = (async () => {
      const availability = await translatorApi.availability({
        sourceLanguage: 'en',
        targetLanguage,
      });

      if (availability === 'unavailable') {
        throw new Error('This language pair is unavailable');
      }

      return translatorApi.create({
        sourceLanguage: 'en',
        targetLanguage,
      });
    })();

    translatorsRef.current.set(targetLanguage, translatorPromise);
    return translatorPromise;
  };

  const translateNodes = async (
    nodes: Text[],
    targetLanguage: LanguageCode,
    runId: number
  ) => {
    const translator = await getTranslator(targetLanguage);
    let cursor = 0;

    const translateOne = async (node: Text) => {
      if (!node.isConnected || languageRef.current !== targetLanguage) return;

      const currentText = node.nodeValue ?? '';
      let record = recordsRef.current.get(node);

      if (!record) {
        record = { source: currentText };
        recordsRef.current.set(node, record);
      } else if (
        currentText !== record.source &&
        currentText !== record.rendered
      ) {
        record.source = currentText;
        record.rendered = undefined;
        record.renderedLanguage = undefined;
      }

      if (
        record.renderedLanguage === targetLanguage &&
        currentText === record.rendered
      ) {
        return;
      }

      const match = record.source.match(/^(\s*)([\s\S]*?)(\s*)$/);
      if (!match || !/[A-Za-z]/.test(match[2])) return;

      const source = match[2];
      const cacheKey = `${targetLanguage}\u0000${source}`;
      let translatedPromise = cacheRef.current.get(cacheKey);
      if (!translatedPromise) {
        translatedPromise = translator.translate(source);
        cacheRef.current.set(cacheKey, translatedPromise);
      }

      const translated = await translatedPromise;
      if (
        runRef.current !== runId ||
        languageRef.current !== targetLanguage ||
        !node.isConnected
      ) {
        return;
      }

      const rendered = `${match[1]}${translated}${match[3]}`;
      record.rendered = rendered;
      record.renderedLanguage = targetLanguage;
      node.nodeValue = rendered;
    };

    const workers = Array.from({ length: 6 }, async () => {
      while (cursor < nodes.length) {
        const node = nodes[cursor];
        cursor += 1;
        await translateOne(node);
      }
    });

    await Promise.all(workers);
  };

  const applyLanguage = async (targetLanguage: LanguageCode) => {
    languageRef.current = targetLanguage;
    setLanguage(targetLanguage);
    window.localStorage.setItem(STORAGE_KEY, targetLanguage);

    if (targetLanguage === 'en') {
      restoreEnglish();
      return;
    }

    const runId = runRef.current + 1;
    runRef.current = runId;
    setStatus('translating');

    try {
      await translateNodes(
        collectTextNodes(document.body),
        targetLanguage,
        runId
      );
      if (
        runRef.current === runId &&
        languageRef.current === targetLanguage
      ) {
        document.documentElement.lang = targetLanguage;
        setStatus('ready');
      }
    } catch {
      if (runRef.current === runId) {
        setStatus('unavailable');
      }
    }
  };

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguageCode(savedLanguage) && savedLanguage !== 'en') {
      void applyLanguage(savedLanguage);
    }
    // This runs once to restore a visitor's saved language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (languageRef.current === 'en') return;
    const targetLanguage = languageRef.current;
    const timer = setTimeout(() => void applyLanguage(targetLanguage), 50);
    return () => clearTimeout(timer);
    // Re-translate after Next.js replaces a page during navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      if (languageRef.current === 'en') return;

      const roots = mutations.flatMap((mutation) =>
        Array.from(mutation.addedNodes)
      );
      if (roots.length === 0) return;

      clearTimeout(observerTimerRef.current);
      observerTimerRef.current = setTimeout(() => {
        const targetLanguage = languageRef.current;
        const runId = runRef.current;
        const nodes = roots.flatMap((root) => collectTextNodes(root));
        void translateNodes(nodes, targetLanguage, runId).catch(() =>
          setStatus('unavailable')
        );
      }, 80);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      clearTimeout(observerTimerRef.current);
    };
    // The observer reads the active language from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="flex items-center gap-2"
      data-no-translate
      aria-busy={status === 'translating'}
    >
      <label
        htmlFor="site-language"
        className="text-xs font-medium text-ink-secondary"
      >
        {currentLanguage.controlLabel}
      </label>
      <select
        id="site-language"
        value={language}
        onChange={(event) =>
          void applyLanguage(event.target.value as LanguageCode)
        }
        className="rounded border border-line bg-surface px-2 py-1.5 text-sm text-ink"
      >
        {LANGUAGES.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
      <span className="sr-only" aria-live="polite">
        {status === 'translating'
          ? 'Translating page'
          : status === 'ready'
            ? `Page translated to ${currentLanguage.label}`
            : status === 'unavailable'
              ? 'Automatic translation is unavailable in this browser'
              : ''}
      </span>
      {status === 'translating' && (
        <span className="text-xs text-ink-muted" aria-hidden>
          Translating...
        </span>
      )}
      {status === 'unavailable' && (
        <span
          className="text-xs text-bad"
          title="Automatic translation requires a browser with the Translator API, such as Chrome 138 or newer."
        >
          Not supported
        </span>
      )}
    </div>
  );
}
