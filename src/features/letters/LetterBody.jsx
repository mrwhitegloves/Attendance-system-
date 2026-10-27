// The text of a letter: a blank line starts a new paragraph; line breaks are kept.
// While a draft, "[Something]" marks a value that is still empty.

export function LetterBody({ text, highlightMissing = false, className = '' }) {
  const paragraphs = String(text).split(/\n\s*\n/);
  return (
    <div className={`space-y-4 leading-relaxed ${className}`}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {highlightMissing
            ? paragraph.split(/(\[[^\]\n]+\])/g).map((part, partIndex) =>
                /^\[[^\]]+\]$/.test(part) ? (
                  <mark key={partIndex} className="rounded bg-warning/20 px-1 text-warning">
                    {part}
                  </mark>
                ) : (
                  part
                ),
              )
            : paragraph}
        </p>
      ))}
    </div>
  );
}
