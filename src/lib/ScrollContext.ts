import { createContext, useContext } from "react";

export type ScrollContextValue = {
  scrollTo: (y: number) => void;
  registerSection: (key: string, y: number) => void;
  scrollToSection: (key: string) => void;
};

export const ScrollCtx = createContext<ScrollContextValue>({
  scrollTo: () => {},
  registerSection: () => {},
  scrollToSection: () => {},
});

export function useScreenScroll() {
  return useContext(ScrollCtx);
}
