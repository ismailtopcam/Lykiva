/** Likya kaya mezarı kemerinden esinlenen işaret + "lykiva" yazısı */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M6 28V14C6 8 11 4 16 3c5 1 10 5 10 11v14" fill="none" stroke="var(--terra)" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M11 28c0-6 3-9 5-13 2 4 5 7 5 13" fill="none" stroke="var(--sea)" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: size * 0.9,
          letterSpacing: '-0.03em',
          color: 'var(--ink)',
        }}>
        lykiva
      </span>
    </span>
  );
}
