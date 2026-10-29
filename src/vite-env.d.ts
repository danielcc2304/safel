import type { AdEnvironment } from "./lib/advertising";

declare global {
  interface ImportMetaEnv extends AdEnvironment {}
}
