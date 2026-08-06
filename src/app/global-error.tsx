'use client';

/**
 * Catches a throw in the root layout itself (the header, nav, or footer) -
 * error.tsx can't, since it renders inside that same layout. This is the
 * last line of defense before the visitor sees the browser's own blank error
 * page, so it has to supply its own <html>/<body>: there is no layout left
 * above it to provide them.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2.5rem 1.5rem', maxWidth: '40rem', margin: '0 auto' }}>
        <p style={{ fontWeight: 700, color: '#d03b3b', textTransform: 'uppercase', fontSize: '0.875rem' }}>
          Something went wrong
        </p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem' }}>
          The site hit a snag
        </h1>
        <p style={{ marginTop: '1rem', fontSize: '1.125rem', color: '#52514e' }}>
          Reloading usually fixes this.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: '1.5rem',
            borderRadius: '0.75rem',
            background: '#256abf',
            color: 'white',
            fontWeight: 600,
            padding: '0.625rem 1rem',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
