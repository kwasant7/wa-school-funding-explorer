'use client';

/**
 * A deliberately tiny Markdown renderer for assistant replies.
 *
 * It builds React elements directly and never touches innerHTML, so there is
 * no HTML parsing step to sanitise and no way for markup in a model reply to
 * become markup in the page. Only the constructs a short explanatory answer
 * actually needs are supported: paragraphs, bullets, numbered lists, bold,
 * italics, inline code, and links.
 *
 * Links are the sharp edge, so they are handled the same way citations are:
 * an href is rendered as a real anchor only when it exactly matches a URL this
 * site already publishes. Anything else renders as plain text. A model cannot
 * introduce a destination that was not already on the allow-list.
 */
import { Fragment, type ReactNode } from 'react';
import { ASSISTANT_SOURCES } from '@/lib/assistant/knowledge';

const ALLOWED_URLS = new Set<string>(ASSISTANT_SOURCES.map((source) => source.url));

function isAllowedUrl(url: string): boolean {
  if (ALLOWED_URLS.has(url)) return true;
  // Trailing-slash and anchor variants of an allowed page are still that page.
  const stripped = url.replace(/[#?].*$/, '').replace(/\/+$/, '');
  return ALLOWED_URLS.has(stripped) || ALLOWED_URLS.has(`${stripped}/`);
}

/** Inline spans: `code`, **bold**, *italic*, and [text](url). */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)\s]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-i${index++}`;

    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-paper px-1 py-0.5 text-[0.9em]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (linkMatch && isAllowedUrl(linkMatch[2])) {
        const [, label, url] = linkMatch;
        const external = /^https?:\/\//.test(url);
        nodes.push(
          <a
            key={key}
            href={url}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="font-medium text-accent underline underline-offset-2 hover:text-accent-deep"
          >
            {label}
          </a>
        );
      } else {
        // Unrecognised destination: keep the words, drop the link.
        nodes.push(linkMatch ? linkMatch[1] : token);
      }
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;

/**
 * Block layout. Consecutive list lines are collected into one list so a
 * three-item bullet list renders as a list rather than three paragraphs.
 */
export function renderMarkdown(source: string): ReactNode {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let numbered: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ').trim();
    paragraph = [];
    if (!text) return;
    blocks.push(
      <p key={`p${key++}`} className="leading-relaxed">
        {renderInline(text, `p${key}`)}
      </p>
    );
  };

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`u${key++}`} className="space-y-1.5 pl-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            <span aria-hidden className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span>{renderInline(item, `u${key}-${i}`)}</span>
          </li>
        ))}
      </ul>
    );
  };

  const flushNumbered = () => {
    if (numbered.length === 0) return;
    const items = numbered;
    numbered = [];
    blocks.push(
      <ol key={`o${key++}`} className="space-y-1.5 pl-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="shrink-0 tabular-nums text-ink-muted">{i + 1}.</span>
            <span>{renderInline(item, `o${key}-${i}`)}</span>
          </li>
        ))}
      </ol>
    );
  };

  const flushAll = () => {
    flushParagraph();
    flushBullets();
    flushNumbered();
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushAll();
      continue;
    }
    const bulletMatch = BULLET.exec(line);
    if (bulletMatch) {
      flushParagraph();
      flushNumbered();
      bullets.push(bulletMatch[1]);
      continue;
    }
    const numberedMatch = NUMBERED.exec(line);
    if (numberedMatch) {
      flushParagraph();
      flushBullets();
      numbered.push(numberedMatch[2]);
      continue;
    }
    flushBullets();
    flushNumbered();
    // Headings would be oversized inside a chat bubble; keep the text, drop
    // the hashes.
    paragraph.push(line.replace(/^#{1,6}\s+/, ''));
  }
  flushAll();

  return <Fragment>{blocks}</Fragment>;
}
