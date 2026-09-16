export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type MarkerKind = 'building' | 'library' | 'canteen' | 'path' | 'ramp' | 'stairs' | 'surface' | 'elevator' | 'toilet' | 'obstacle';
export type MarkerCategory = 'facility' | 'obstacle';
export type MarkerStatus = 'available' | 'caution' | 'unavailable';
export type AccessFeatureKind = 'ramp' | 'elevator' | 'stairs' | 'surface';
export type AccessAuditState = 'available' | 'unavailable' | 'present' | 'not-present' | 'unverified';

export type CampusMarker = {
  id: string;
  category: MarkerCategory;
  kind: MarkerKind;
  title: string;
  location: string;
  coordinate: Coordinates;
  status: MarkerStatus;
  description: string;
  color: string;
  symbol: string;
  sourceLabel: string;
  sourceUrl: string;
  buildingId?: string;
  ownerId?: string;
};

export type BuildingAccessItem = {
  kind: AccessFeatureKind;
  label: string;
  symbol: string;
  state: AccessAuditState;
  markerId?: string;
};

// Public building centroids are based on official KMUTNB/FTE references and
// OpenStreetMap building geometry. Entrance-level routes still need a field survey.
export const BUILDING_44: Coordinates = {
  latitude: 13.8197177,
  longitude: 100.5155302,
};

export const BUILDING_52: Coordinates = {
  latitude: 13.820405,
  longitude: 100.515463,
};

export const KMUTNB_CAMPUS_CENTER: Coordinates = {
  latitude: 13.82035,
  longitude: 100.51495,
};

export const KMUTNB_CAMPUS_REGION = {
  ...KMUTNB_CAMPUS_CENTER,
  latitudeDelta: 0.0062,
  longitudeDelta: 0.0052,
};

export const campusMarkers: CampusMarker[] = [
  {
    id: 'building-44',
    category: 'facility',
    kind: 'building',
    title: 'Building 44',
    location: 'Practical and Workshop Building · FTE',
    coordinate: BUILDING_44,
    status: 'caution',
    description: 'Building location confirmed. Entrance accessibility still requires a field survey.',
    color: '#6548E8',
    symbol: '44',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/158475016',
  },
  {
    id: 'building-42',
    category: 'facility',
    kind: 'building',
    title: 'Building 42',
    location: 'KMUTNB North Bangkok Campus',
    coordinate: { latitude: 13.8195085, longitude: 100.5159964 },
    status: 'caution',
    description: 'Building location confirmed. Entrance accessibility still requires a field survey.',
    color: '#8A63D2',
    symbol: '42',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/158474981',
  },
  {
    id: 'building-52',
    category: 'facility',
    kind: 'building',
    title: 'Building 52',
    location: 'Faculty of Technical Education',
    coordinate: BUILDING_52,
    status: 'caution',
    description: 'Official faculty map location. Entrance accessibility still requires a field survey.',
    color: '#735BE8',
    symbol: '52',
    sourceLabel: 'Faculty of Technical Education, KMUTNB',
    sourceUrl: 'https://fte.kmutnb.ac.th/index.php/stu/',
  },
  {
    id: 'central-library',
    category: 'facility',
    kind: 'library',
    title: 'Central Library',
    location: 'KMUTNB Central Library',
    coordinate: { latitude: 13.8197373, longitude: 100.5142215 },
    status: 'caution',
    description: 'Public map location confirmed. Accessible entrances require on-site verification.',
    color: '#2F86C9',
    symbol: 'LIB',
    sourceLabel: 'KMUTNB Library / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/node/9116353206',
  },
  {
    id: 'building-40',
    category: 'facility',
    kind: 'canteen',
    title: '40th Year Building',
    location: 'Student Affairs and Main Canteen',
    coordinate: { latitude: 13.821131, longitude: 100.5146328 },
    status: 'caution',
    description: 'Student Affairs and main canteen location. Accessibility requires a field survey.',
    color: '#E89535',
    symbol: '40',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/158474996',
  },
  {
    id: 'building-63',
    category: 'facility',
    kind: 'building',
    title: 'Building 63',
    location: 'College of Industrial Technology area',
    coordinate: { latitude: 13.8204816, longitude: 100.5159465 },
    status: 'caution',
    description: 'Building location confirmed. Entrance accessibility still requires a field survey.',
    color: '#4D8FC4',
    symbol: '63',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/158475007',
  },
  {
    id: 'building-65',
    category: 'facility',
    kind: 'building',
    title: 'Building 65',
    location: 'College of Industrial Technology',
    coordinate: { latitude: 13.8211375, longitude: 100.5160741 },
    status: 'caution',
    description: 'Building location confirmed. Entrance accessibility still requires a field survey.',
    color: '#3A9C92',
    symbol: '65',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/986219908',
  },
  {
    id: 'building-78-a',
    category: 'facility',
    kind: 'building',
    title: 'Building 78 · Zone A',
    location: 'Faculty of Applied Science',
    coordinate: { latitude: 13.8215699, longitude: 100.5150134 },
    status: 'caution',
    description: 'Building zone location confirmed. Entrance accessibility requires a field survey.',
    color: '#C65A8E',
    symbol: '78A',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/158474987',
  },
  {
    id: 'building-78-b',
    category: 'facility',
    kind: 'building',
    title: 'Building 78 · Zone B',
    location: 'Faculty of Applied Science',
    coordinate: { latitude: 13.8215209, longitude: 100.5154808 },
    status: 'caution',
    description: 'Building zone location confirmed. Entrance accessibility requires a field survey.',
    color: '#D06BA0',
    symbol: '78B',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/158474983',
  },
  {
    id: 'engineering-81',
    category: 'facility',
    kind: 'building',
    title: 'Engineering Building 81',
    location: 'Faculty of Engineering',
    coordinate: { latitude: 13.8213075, longitude: 100.5135205 },
    status: 'caution',
    description: 'Faculty of Engineering building. Entrance accessibility requires a field survey.',
    color: '#D65757',
    symbol: '81',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/158475010',
  },
  {
    id: 'engineering-82',
    category: 'facility',
    kind: 'building',
    title: 'Engineering Building 82',
    location: 'Faculty of Engineering',
    coordinate: { latitude: 13.821767, longitude: 100.5130102 },
    status: 'caution',
    description: 'Faculty of Engineering building. Entrance accessibility requires a field survey.',
    color: '#C94B4B',
    symbol: '82',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/158474989',
  },
  {
    id: 'engineering-83',
    category: 'facility',
    kind: 'building',
    title: 'Engineering Building 83',
    location: 'Faculty of Engineering',
    coordinate: { latitude: 13.8220131, longitude: 100.5133656 },
    status: 'caution',
    description: 'Faculty of Engineering building. Entrance accessibility requires a field survey.',
    color: '#B94040',
    symbol: '83',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/158475003',
  },
  {
    id: 'engineering-84',
    category: 'facility',
    kind: 'building',
    title: 'Engineering Building 84',
    location: 'Faculty of Engineering',
    coordinate: { latitude: 13.8216913, longitude: 100.5138746 },
    status: 'caution',
    description: 'Faculty of Engineering building. Entrance accessibility requires a field survey.',
    color: '#A93838',
    symbol: '84',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/158475013',
  },
  {
    id: 'navamindra-building',
    category: 'facility',
    kind: 'building',
    title: 'Navamindra Rajini Building',
    location: 'Building 31',
    coordinate: { latitude: 13.8197478, longitude: 100.5139877 },
    status: 'caution',
    description: 'Wheelchair access is listed in public map data but must be verified on site.',
    color: '#49A987',
    symbol: '31',
    sourceLabel: 'KMUTNB / OpenStreetMap',
    sourceUrl: 'https://www.openstreetmap.org/way/158475181',
  },
];

// Accessibility points start empty. Surveyors add real GPS points from the map UI.
export const accessMarkers: CampusMarker[] = [];

const ACCESS_FEATURES: Omit<BuildingAccessItem, 'state' | 'markerId'>[] = [
  { kind: 'ramp', label: 'Ramp', symbol: '♿︎' },
  { kind: 'elevator', label: 'Elevator', symbol: '↕' },
  { kind: 'stairs', label: 'Stairs', symbol: '≡' },
  { kind: 'surface', label: 'Rough surface', symbol: '!' },
];

// Every campus building starts with an explicit, honest “unverified” audit.
// A related marker is exposed only when a candidate/verified GPS point exists.
export const buildingAccessProfiles = campusMarkers.reduce<Record<string, BuildingAccessItem[]>>((profiles, building) => {
  profiles[building.id] = ACCESS_FEATURES.map((feature) => {
    const relatedMarker = accessMarkers.find((marker) => marker.buildingId === building.id && marker.kind === feature.kind);
    return {
      ...feature,
      state: 'unverified',
      markerId: relatedMarker?.id,
    };
  });
  return profiles;
}, {});

export function getBuildingAccessProfile(buildingId: string) {
  return buildingAccessProfiles[buildingId] ?? [];
}

export const mapMarkers = [...campusMarkers, ...accessMarkers];

export { distanceInMetres } from '../utils/distance';
