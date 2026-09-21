import { useEffect, useState } from "react";

export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const callback = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };
    const media = matchMedia(query);

    callback({ matches: media.matches } as MediaQueryListEvent);

    media.addEventListener("change", callback);

    return () => {
      media.removeEventListener("change", callback);
    };
  }, [query]);

  return matches;
};
