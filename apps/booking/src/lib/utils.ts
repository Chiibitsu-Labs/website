import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h} hour${h > 1 ? 's' : ''}`;
}

export function colorClass(
  branding: { primaryColor: string; shade: string; lightShade: string },
  variant: 'bg' | 'text' | 'border' | 'ring' | 'gradient',
): string {
  const { primaryColor, shade, lightShade } = branding;
  switch (variant) {
    case 'bg':
      return `bg-${primaryColor}-${shade}`;
    case 'text':
      return `text-${primaryColor}-${shade}`;
    case 'border':
      return `border-${primaryColor}-${shade}`;
    case 'ring':
      return `ring-${primaryColor}-${shade}`;
    case 'gradient':
      return `from-${primaryColor}-${shade} to-${primaryColor}-${parseInt(shade) + 100}`;
    default:
      return '';
  }
}

export function bgLightClass(branding: { primaryColor: string; lightShade: string }): string {
  return `bg-${branding.primaryColor}-${branding.lightShade}`;
}
