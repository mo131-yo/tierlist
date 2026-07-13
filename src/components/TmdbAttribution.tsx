// TMDB API-ийн attribution шаардлага: https://www.themoviedb.org/about/logos-attribution
export function TmdbAttribution() {
  return (
    <a
      href="https://www.themoviedb.org/"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity"
      title="This product uses the TMDB API but is not endorsed or certified by TMDB."
    >
      <span>Powered by</span>
      <svg viewBox="0 0 190 20" className="h-3.5 w-auto" aria-label="TMDB">
        <defs>
          <linearGradient id="tmdbGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#90cea1" />
            <stop offset="56%" stopColor="#3cbec9" />
            <stop offset="100%" stopColor="#00b3e5" />
          </linearGradient>
        </defs>
        <rect width="190" height="20" rx="10" fill="url(#tmdbGrad)" />
        <text
          x="95"
          y="14.5"
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill="#0d253f"
          fontFamily="sans-serif"
        >
          THE MOVIE DB
        </text>
      </svg>
    </a>
  );
}
