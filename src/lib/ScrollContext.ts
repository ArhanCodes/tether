import { createContext, useContext } from "react";

export type ScrollContextValue = {
  scrollTo: (y: number) => void;
};

export const ScrollCtx = createContext<ScrollContextValue>({ scrollTo: () => {} });

export function useScreenScroll() {
  return useContext(ScrollCtx);
}
