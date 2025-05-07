import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function getEnvVar(key: string, { serverOnly = false } = {}) {
  if (serverOnly && typeof window !== 'undefined') {
    throw new Error(`Environment variable ${key} can only be accessed on the server side.`);
  }

  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set.`);
  }
  return value;
}

export function getProgramId() {
  // Fallback to the hardcoded program ID you shared earlier if env var is not available
  const programIdFromEnv = process.env.NEXT_PUBLIC_SENDA_PROGRAM_ID || process.env.SENDA_PROGRAM_ID;
  if (programIdFromEnv) {
    return programIdFromEnv;
  }
  
  // Hardcode the program ID you provided earlier as a fallback
  console.log('Using hardcoded program ID as environment variable is not available');
  return "HyavU5k2jA2D2oPUX7Ct8kUhXJQGaTum4nqnLW7f77wL";
}