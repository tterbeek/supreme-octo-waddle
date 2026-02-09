import { createContext, useContext } from "react";

type LayoutChromeContextValue = {
  chromeHidden: boolean;
  setChromeHidden: (hidden: boolean) => void;
};

export const LayoutChromeContext = createContext<LayoutChromeContextValue>({
  chromeHidden: false,
  setChromeHidden: () => {},
});

export function useLayoutChrome() {
  return useContext(LayoutChromeContext);
}
