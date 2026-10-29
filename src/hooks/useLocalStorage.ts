import { useState } from "react";
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (value: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  function update(next: T | ((previous: T) => T)) {
    setValue((previous) => {
      const result =
        typeof next === "function" ? (next as (p: T) => T)(previous) : next;
      try {
        localStorage.setItem(key, JSON.stringify(result));
      } catch {
        /* Storage can be unavailable. */
      }
      return result;
    });
  }
  return [value, update];
}
