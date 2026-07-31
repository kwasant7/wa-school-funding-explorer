'use client';

/**
 * Tracks the site's active language.
 *
 * LanguageSwitcher keeps its selection in component state and writes the code
 * onto `document.documentElement.lang` as it applies the dictionary. Reading
 * that attribute - and watching it for changes - lets the assistant follow the
 * language without LanguageSwitcher having to know the assistant exists, and
 * without lifting its state into a provider that nothing else needs.
 *
 * A switch therefore reaches the assistant immediately: labels re-render, and
 * the next question is answered in the new language.
 */
import { useEffect, useState } from 'react';
import { isAssistantLanguage, type AssistantLanguage } from '@/lib/assistant/types';

function readLanguage(): AssistantLanguage {
  if (typeof document === 'undefined') return 'en';
  const value = document.documentElement.lang;
  return isAssistantLanguage(value) ? value : 'en';
}

export function useAssistantLanguage(): AssistantLanguage {
  const [language, setLanguage] = useState<AssistantLanguage>('en');

  useEffect(() => {
    setLanguage(readLanguage());
    const observer = new MutationObserver(() => {
      setLanguage((current) => {
        const next = readLanguage();
        return next === current ? current : next;
      });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang'],
    });
    return () => observer.disconnect();
  }, []);

  return language;
}
