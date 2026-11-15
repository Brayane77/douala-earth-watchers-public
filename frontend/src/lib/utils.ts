/** Utilitaire partagé de fusion des classes CSS Tailwind. */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
/** Combine des classes conditionnelles puis élimine les conflits Tailwind. */
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
