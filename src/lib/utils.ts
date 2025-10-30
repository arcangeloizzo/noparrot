import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getDisplayUsername = (username: string): string => {
  if (username.includes('@')) {
    return username.split('@')[0];
  }
  return username;
}
// INCOLLA QUESTO CODICE ALLA FINE DI src/lib/utils.ts

export function formatKilo(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return num.toString()
};
