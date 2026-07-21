import type { ReactNode } from 'react';

/**
 * Lightweight markdown renderer — tuned for readable study notes / AI answers.
 *
 * Typography pass: design-system tokens only. Parsing is unchanged.
 * Only headings, paragraphs, lists, blockquotes, inline code and emphasis
 * are rendered by this component (no fenced code blocks / tables / hr / links
 * are produced by the current parser, so none are introduced here).
 */

function inlineFormat(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-content">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="rounded-md border border-line bg-surface-overlay px-1.5 py-0.5 font-mono text-[0.85em] text-content"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      parts.push(
        <em key={match.index} className="italic text-content-muted">
          {token.slice(1, -1)}
        </em>
      );
    }
    last = match.index + token.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

export function MarkdownView({ content, variant = 'default' }: { content: string; variant?: 'default' | 'notes' }) {
  const isNotes = variant === 'notes';
  const lines = content.replace(/\r/g, '').split('\n');
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    nodes.push(
      <ul
        key={`ul-${nodes.length}`}
        className={
          isNotes
            ? 'my-3 ml-5 list-disc space-y-2 text-body leading-[1.7] text-content-muted marker:text-brand/70'
            : 'my-3 ml-5 list-disc space-y-2 text-body leading-[1.7] text-content-muted marker:text-brand/70'
        }
      >
        {listItems.map((item, i) => (
          <li key={i}>{inlineFormat(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }

    flushList();

    if (trimmed.startsWith('#### ')) {
      nodes.push(
        <h5
          key={nodes.length}
          className={
            isNotes
              ? 'mb-2 mt-5 text-caption font-semibold uppercase tracking-wide text-content-muted'
              : 'mb-2 mt-4 text-caption font-semibold uppercase tracking-wide text-content-muted'
          }
        >
          {inlineFormat(trimmed.slice(5))}
        </h5>
      );
    } else if (trimmed.startsWith('### ')) {
      nodes.push(
        <h4
          key={nodes.length}
          className={
            isNotes
              ? 'mb-2 mt-6 border-b border-line pb-1.5 text-subheading font-semibold text-content'
              : 'mb-2 mt-5 text-subheading font-semibold text-content'
          }
        >
          {inlineFormat(trimmed.slice(4))}
        </h4>
      );
    } else if (trimmed.startsWith('## ')) {
      nodes.push(
        <h3
          key={nodes.length}
          className={
            isNotes
              ? 'mb-2.5 mt-7 text-heading font-semibold tracking-tight text-content'
              : 'mb-2 mt-6 text-heading font-semibold tracking-tight text-content'
          }
        >
          {inlineFormat(trimmed.slice(3))}
        </h3>
      );
    } else if (trimmed.startsWith('# ')) {
      nodes.push(
        <h2
          key={nodes.length}
          className={
            isNotes
              ? 'mb-3 mt-2 text-display font-bold tracking-tight text-content'
              : 'mb-3 mt-4 text-display font-bold tracking-tight text-content'
          }
        >
          {inlineFormat(trimmed.slice(2))}
        </h2>
      );
    } else if (trimmed.startsWith('> ')) {
      nodes.push(
        <blockquote
          key={nodes.length}
          className="my-3 rounded-r-md border-l-2 border-brand/40 bg-brand/[0.06] py-2.5 pl-4 pr-3 text-body leading-[1.7] text-content-muted"
        >
          {inlineFormat(trimmed.slice(2))}
        </blockquote>
      );
    } else {
      nodes.push(
        <p
          key={nodes.length}
          className={
            isNotes
              ? 'my-2.5 text-body leading-[1.75] text-content-muted'
              : 'my-2.5 text-body leading-[1.75] text-content-muted'
          }
        >
          {inlineFormat(trimmed)}
        </p>
      );
    }
  }

  flushList();
  return (
    <div
      className={
        isNotes
          ? 'markdown-view notes-prose max-w-none font-sans antialiased'
          : 'markdown-view max-w-none font-sans antialiased'
      }
    >
      {nodes}
    </div>
  );
}
