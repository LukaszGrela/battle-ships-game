import { useCallback, useSyncExternalStore } from "react";

/** Zapytania już zgłoszone, żeby nie logować przy każdym renderze. */
const warnedQueries = new Set<string>();

/**
 * `matchMedia` never throws: an unparsable query simply reports
 * `matches: false`, so a single missing parenthesis can switch a responsive
 * branch off without any visible error. Closing unclosed groups here keeps that
 * class of typo harmless for every caller.
 *
 * W trybie deweloperskim normalizacja jest logowana raz na zapytanie, żeby
 * źródłowa literówka została naprawiona, a nie tylko zamaskowana.
 */
const normalizeQuery = (query: string): string => {
  const opened = query.match(/\(/g)?.length ?? 0;
  const closed = query.match(/\)/g)?.length ?? 0;

  if (opened === closed) return query;

  // Dokładamy tylko brakujące nawiasy zamykające. Nadmiarowego nawiasu nie
  // usuwamy, bo nie wiadomo, którego brakuje naprawdę — takie zapytanie
  // zostaje bez zmian, a deweloper dostaje ostrzeżenie.
  const fixed = closed < opened ? query + ")".repeat(opened - closed) : query;

  if (import.meta.env.DEV && !warnedQueries.has(query)) {
    warnedQueries.add(query);
    console.warn(
      fixed === query
        ? `[useMediaQuery] Za dużo nawiasów zamykających w zapytaniu: ${JSON.stringify(query)}. ` +
            "Zapytanie nie zostało poprawione — napraw literówkę w miejscu wywołania."
        : `[useMediaQuery] Brak nawiasu zamykającego w zapytaniu: ${JSON.stringify(query)}. ` +
            `Użyto: ${JSON.stringify(fixed)}. Popraw literówkę w miejscu wywołania.`
    );
  }

  return fixed;
};

export const useMediaQuery = (query: string, defaultValue = false): boolean => {
  const normalizedQuery = normalizeQuery(query);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const media = window.matchMedia(normalizedQuery);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    [normalizedQuery]
  );

  const getSnapshot = useCallback(
    () => window.matchMedia(normalizedQuery).matches,
    [normalizedQuery]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => defaultValue);
};
