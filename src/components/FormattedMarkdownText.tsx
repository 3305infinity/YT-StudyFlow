import { useMemo } from 'react';

function sanitize(text: string): string {
  if (!text) return '';
  return text
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/\[svg[^\]]*\]/gi, '')
    .replace(/\bsvg\b(?!\s*[:=])/gi, '')
    .replace(/(^|\s)#+(?=\s|$)/g, ' ')
    .trim();
}

/**
 * Parses markdown inline styles (**bold**, `code`) safely into React elements.
 */
function renderInline(text: string) {
  const clean = sanitize(text).replace(/#+\s*$/g, '').trim();
  // Match **bold** or `code`
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = clean.split(regex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-content">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="rounded bg-surface-overlay border border-line px-1.5 py-0.5 font-mono text-[12.5px] text-brand-muted"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export function FormattedMarkdownText({
  text,
  className = 'text-[15px] leading-[1.7] text-content-muted',
}: {
  text: string;
  className?: string;
}) {
  const rendered = useMemo(() => {
    if (!text) return null;

    const cleaned = sanitize(text);
    const paragraphs = cleaned.split(/\n{2,}/);

    return paragraphs.map((para, pIdx) => {
      const trimmedPara = para.trim().replace(/#+\s*$/g, '').trim();

      // Headings (# Heading, ## Heading, ### Heading or Heading ###)
      if (trimmedPara.startsWith('#') || /^[A-Z0-9\s_\-\.]{3,60}\s*#+$/i.test(trimmedPara)) {
        const headingText = trimmedPara.replace(/^#+\s*/, '').replace(/\s*#+$/, '').trim();
        return (
          <h3 key={pIdx} className="pt-3 pb-1 text-base font-bold text-content tracking-tight">
            {renderInline(headingText)}
          </h3>
        );
      }

      // Markdown Table Detection & Rendering
      if (trimmedPara.includes('|') && (trimmedPara.includes('---') || trimmedPara.includes('-|-') || trimmedPara.includes('Key Points'))) {
        let tableLines = trimmedPara.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        
        // Handle single-line serialized tables like "| | Concept | Key Points | |---|---| | 1 | ..."
        if (tableLines.length === 1 || !tableLines.some((l) => l.includes('---'))) {
          const splitMatches = trimmedPara.split(/(?<=\|)\s*(?=\|)/);
          if (splitMatches.length > 1) {
            tableLines = splitMatches.map((l) => l.trim()).filter((l) => l.length > 0);
          }
        }

        const dataLines = tableLines.filter((l) => !/^\s*\|?\s*:?-+:?\s*\|?$/.test(l) && l.replace(/\|/g, '').trim().length > 0);
        if (dataLines.length > 0) {
          const rows = dataLines.map((line) => {
            let cleanLine = line.trim();
            if (cleanLine.startsWith('|')) cleanLine = cleanLine.slice(1);
            if (cleanLine.endsWith('|')) cleanLine = cleanLine.slice(0, -1);
            return cleanLine.split('|').map((cell) => cell.trim()).filter((c) => c.length > 0);
          }).filter((row) => row.length > 0);

          if (rows.length > 0) {
            const header = rows[0] || [];
            const bodyRows = rows.slice(1);

            return (
              <div key={pIdx} className="my-4 overflow-x-auto rounded-lg border border-line bg-surface/50 p-0.5 shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-raised border-b border-line text-content font-semibold">
                    <tr>
                      {header.map((cell, idx) => (
                        <th key={idx} className="px-3 py-2 border-r border-line/40 last:border-r-0 font-bold">
                          {renderInline(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40 text-content-muted">
                    {bodyRows.map((row, rIdx) => (
                      <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-transparent' : 'bg-surface-raised/20'}>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 border-r border-line/30 last:border-r-0 align-top">
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }
      }

      const lines = trimmedPara.split('\n').filter((l) => l.trim().length > 0);

      // Bullet List
      const isBulletList = lines.length > 0 && lines.every((l) => /^\s*[\-\*•]\s+/.test(l));
      if (isBulletList) {
        return (
          <ul key={pIdx} className="my-2 space-y-1.5 pl-1">
            {lines.map((line, lIdx) => {
              const content = line.replace(/^\s*[\-\*•]\s+/, '');
              return (
                <li key={lIdx} className="flex items-start gap-2.5 text-[15px] text-content-muted">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/70" />
                  <span className="flex-1">{renderInline(content)}</span>
                </li>
              );
            })}
          </ul>
        );
      }

      // Numbered List
      const isNumberedList = lines.length > 0 && lines.every((l) => /^\s*\d+[\.\)]\s+/.test(l));
      if (isNumberedList) {
        return (
          <ol key={pIdx} className="my-2 space-y-2">
            {lines.map((line, lIdx) => {
              const match = line.match(/^\s*(\d+)[\.\)]\s+(.*)/);
              const num = match?.[1] || String(lIdx + 1);
              const content = match?.[2] || line;
              return (
                <li key={lIdx} className="flex items-start gap-2.5 text-[15px] text-content-muted">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[11px] font-bold text-brand">
                    {num}
                  </span>
                  <span className="flex-1 pt-0.5">{renderInline(content)}</span>
                </li>
              );
            })}
          </ol>
        );
      }

      // Question / Answer block formatting for Interview notes
      if (/^\s*(Q\d+[\.:]|Question[\d\.:]*|Q:)\s+/i.test(trimmedPara)) {
        const qMatch = trimmedPara.match(/^\s*(Q\d+[\.:]|Question[\d\.:]*|Q:)\s+(.*)/i);
        const qTag = qMatch?.[1] || 'Question';
        const qBody = qMatch?.[2] || trimmedPara;
        return (
          <div key={pIdx} className="mt-4 mb-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
                {qTag}
              </span>
            </div>
            <p className="text-[15px] font-semibold text-content leading-snug">
              {renderInline(qBody)}
            </p>
          </div>
        );
      }

      if (/^\s*(Answer:?|Ans:?)\s*/i.test(trimmedPara)) {
        const aBody = trimmedPara.replace(/^\s*(Answer:?|Ans:?)\s*/i, '');
        return (
          <div key={pIdx} className="mb-4 pl-3 border-l-2 border-brand/50 py-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-brand mb-1">
              Answer
            </div>
            <p className="text-[15px] leading-[1.7] text-content-muted">
              {renderInline(aBody)}
            </p>
          </div>
        );
      }

      return (
        <p key={pIdx} className={className}>
          {renderInline(para)}
        </p>
      );
    });
  }, [text, className]);

  return <div className="space-y-3">{rendered}</div>;
}

