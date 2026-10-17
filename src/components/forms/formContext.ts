import { createContext } from "react";
export const FormLayoutContext = createContext<{ footer: HTMLElement | null; dismiss: () => void } | null>(null);
