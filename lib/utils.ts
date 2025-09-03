import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sortAlphabetically<T>(
  arr: T[],
  getLabel: (item: T) => string = (item) => String(item)
): T[] {
  return [...arr].sort((a, b) =>
    getLabel(a).localeCompare(getLabel(b), undefined, { sensitivity: "base" })
  )
}
