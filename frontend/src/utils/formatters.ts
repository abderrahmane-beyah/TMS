export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatKm(value: number): string {
  return `${value.toFixed(1)} km`;
}

export function formatPoids(value: number): string {
  return `${value.toFixed(1)} kg`;
}

export function formatVolume(value: number): string {
  return `${value.toFixed(2)} m³`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
