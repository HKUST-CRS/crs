import { useEffect } from "react";

export function useWindowFocus(onFocus: () => void) {
  useEffect(() => {
    window.addEventListener("focus", onFocus);
    onFocus();
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [onFocus]);
}
