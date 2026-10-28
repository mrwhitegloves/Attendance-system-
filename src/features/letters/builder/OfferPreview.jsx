'use client';

import { useEffect, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { OfferLetterDocument } from '../pdf/OfferLetterDocument.jsx';

/**
 * The live preview: the same document as the PDF file, made in the browser a moment after the
 * last change. Loaded only in the browser (next/dynamic, no server rendering).
 */
export default function OfferPreview({ content, company, brand, stampDataUrl }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let made = null;
    const timer = setTimeout(async () => {
      try {
        const blob = await pdf(
          <OfferLetterDocument
            content={content}
            company={company}
            brand={brand}
            logoSrc={brand.letterLogo}
            stampSrc={stampDataUrl}
            draft
          />,
        ).toBlob();
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return made;
        });
        setError('');
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [content, company, brand, stampDataUrl]);

  if (error) return <p className="p-4 text-sm text-danger">Preview failed: {error}</p>;
  if (!url) return <p className="p-4 text-sm text-muted">Making the preview…</p>;
  return (
    <iframe
      src={`${url}#toolbar=0&navpanes=0&view=FitH`}
      title="Offer letter preview"
      className="h-full min-h-[70vh] w-full rounded-lg border border-border bg-white"
    />
  );
}
