import type { Coordinates } from '../data/access-points';

export function distanceInMetres(from: Coordinates, to: Coordinates) {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const firstLatitude = toRadians(from.latitude);
  const secondLatitude = toRadians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function formatDistance(distance: number) {
  if (distance < 1_000) return `${distance.toLocaleString('en-US')} m`;
  const kilometres = distance / 1_000;
  return `${kilometres >= 100 ? Math.round(kilometres) : kilometres.toFixed(1)} km`;
}

