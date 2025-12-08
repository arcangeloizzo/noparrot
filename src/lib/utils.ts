import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getDisplayUsername = (username: string | undefined | null): string => {
  if (!username) return '';
  if (username.includes('@')) {
    return username.split('@')[0];
  }
  return username;
};
