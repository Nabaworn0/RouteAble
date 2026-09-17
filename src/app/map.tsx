import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { Alert, Animated, Easing, Keyboard, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker, type CameraRef, type PressEvent } from '@maplibre/maplibre-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomNav } from '../components/BottomNav';
import { COLORS } from '../constants/theme';
import { BUILDING_44, KMUTNB_CAMPUS_CENTER, KMUTNB_CAMPUS_REGION, campusMarkers, getBuildingAccessProfile, mapMarkers, type AccessAuditState, type BuildingAccessItem, type CampusMarker, type Coordinates, type MarkerCategory } from '../data/access-points';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { connectFirebase, deleteSharedMarker, isFirebaseConfigured, saveSharedMarker, subscribeToSharedMarkers } from '../services/firebase';
import { distanceInMetres, formatDistance } from '../utils/distance';

type Filter = 'buildings' | MarkerCategory;
type NewPointKind = 'path' | 'ramp' | 'elevator' | 'stairs' | 'surface';
type MapDisplayType = 'default' | 'light' | 'dark';
const DEMO_POSITION: Coordinates = { latitude: 13.81965, longitude: 100.51472 };
const USER_MARKERS_STORAGE_KEY = '@routeable/user-markers/v1';
const ACCESSIBLE_KINDS = new Set(['path', 'ramp', 'elevator', 'toilet']);
const filters: { id: Filter; label: string }[] = [
  { id: 'buildings', label: 'Buildings' }, { id: 'facility', label: '♿︎ Access' }, { id: 'obstacle', label: '⚠ Barriers' },
];
const MAP_TYPE_OPTIONS: { id: MapDisplayType; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];
const MAP_STYLE_URLS: Record<MapDisplayType, string> = {
  default: 'https://tiles.openfreemap.org/styles/liberty',
  light: 'https://tiles.openfreemap.org/styles/bright',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

const NEW_POINT_OPTIONS: { kind: NewPointKind; label: string; symbol: string; color: string; category: MarkerCategory }[] = [
  { kind: 'path', label: 'Wheelchair path', symbol: '♿︎', color: '#168B79', category: 'facility' },
  { kind: 'ramp', label: 'Ramp', symbol: '↗', color: '#38A976', category: 'facility' },
  { kind: 'elevator', label: 'Elevator', symbol: '↕', color: '#527DC8', category: 'facility' },
  { kind: 'stairs', label: 'Stairs', symbol: '≡', color: '#E9585B', category: 'obstacle' },
  { kind: 'surface', label: 'Rough surface', symbol: '!', color: '#E89535', category: 'obstacle' },
];

function isStoredUserMarker(value: unknown): value is CampusMarker {
  if (!value || typeof value !== 'object') return false;
  const marker = value as Partial<CampusMarker>;
  const coordinate = marker.coordinate as Partial<Coordinates> | undefined;
  return typeof marker.id === 'string'
    && marker.id.startsWith('user-point-')
    && (marker.category === 'facility' || marker.category === 'obstacle')
    && NEW_POINT_OPTIONS.some((option) => option.kind === marker.kind)
    && typeof marker.title === 'string'
    && typeof marker.location === 'string'
    && typeof coordinate?.latitude === 'number'
    && Number.isFinite(coordinate.latitude)
    && typeof coordinate.longitude === 'number'
    && Number.isFinite(coordinate.longitude)
    && (marker.status === 'available' || marker.status === 'caution' || marker.status === 'unavailable')
    && typeof marker.description === 'string'
    && typeof marker.color === 'string'
    && typeof marker.symbol === 'string'
    && typeof marker.sourceLabel === 'string'
    && typeof marker.sourceUrl === 'string'
    && (marker.ownerId === undefined || typeof marker.ownerId === 'string');
}

function matchesFilter(marker: CampusMarker, filter: Filter) {
  if (filter === 'buildings') return marker.kind === 'building' || marker.kind === 'library' || marker.kind === 'canteen';
  if (filter === 'facility') return ACCESSIBLE_KINDS.has(marker.kind);
  return marker.category === 'obstacle';
}

function statusLabel(status: CampusMarker['status']) {
  if (status === 'available') return 'Available';
  if (status === 'unavailable') return 'Unavailable';
  return 'Survey required';
}

function accessStateLabel(item: BuildingAccessItem) {
  if (item.state === 'unverified') return 'Not surveyed';
  if (item.state === 'present') return 'Present';
  if (item.state === 'not-present') return 'Not found';
  if (item.state === 'available') return 'Available';
  return 'Unavailable';
}

function accessStateStyle(state: AccessAuditState) {
  if (state === 'available' || state === 'not-present') return styles.accessStatePositive;
  if (state === 'unavailable' || state === 'present') return styles.accessStateNegative;
  return styles.accessStateUnknown;
}

function spreadAccessCoordinate(marker: CampusMarker, building: CampusMarker): Coordinates {
  const offsets: Partial<Record<CampusMarker['kind'], Coordinates>> = {
    ramp: { latitude: 0.00004, longitude: -0.00014 },
    elevator: { latitude: 0.00004, longitude: 0.00014 },
    stairs: { latitude: 0.00015, longitude: 0 },
    surface: { latitude: -0.00008, longitude: 0 },
  };
  const offset = offsets[marker.kind];
  if (!offset) return marker.coordinate;
  return {
    latitude: building.coordinate.latitude + offset.latitude,
    longitude: building.coordinate.longitude + offset.longitude,
  };
}

function createUserPointId() {
  return `user-point-${Date.now()}`;
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { markerId } = useLocalSearchParams<{ markerId?: string }>();
  const cameraRef = useRef<CameraRef>(null);
  const [sheetEntrance] = useState(() => new Animated.Value(0));
  const userMarkersRef = useRef<CampusMarker[]>([]);
  const { position, state: locationState, retry } = useCurrentLocation();
  const [filter, setFilter] = useState<Filter>('buildings');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [directionsReady, setDirectionsReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearchIds, setRecentSearchIds] = useState<string[]>([]);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [draftCoordinate, setDraftCoordinate] = useState<Coordinates | null>(null);
  const [draftKind, setDraftKind] = useState<NewPointKind>('path');
  const [draftLocationNote, setDraftLocationNote] = useState('');
  const [userMarkers, setUserMarkers] = useState<CampusMarker[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [firebaseOwnerId, setFirebaseOwnerId] = useState<string | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<'local' | 'connecting' | 'synced' | 'error'>(isFirebaseConfigured ? 'connecting' : 'local');
  const [mapType, setMapType] = useState<MapDisplayType>('default');
  const [mapTypeMenuOpen, setMapTypeMenuOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(16.8);

  useEffect(() => {
    let active = true;
    const loadStoredMarkers = async () => {
      try {
        const storedValue = await AsyncStorage.getItem(USER_MARKERS_STORAGE_KEY);
        if (!active || !storedValue) return;
        const parsed: unknown = JSON.parse(storedValue);
        if (Array.isArray(parsed)) {
          const validMarkers = parsed.filter(isStoredUserMarker);
          userMarkersRef.current = validMarkers;
          setUserMarkers(validMarkers);
        }
      } catch (error) {
        console.warn('Unable to load saved accessibility points.', error);
      } finally {
        if (active) setStorageReady(true);
      }
    };
    void loadStoredMarkers();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    userMarkersRef.current = userMarkers;
    void AsyncStorage.setItem(USER_MARKERS_STORAGE_KEY, JSON.stringify(userMarkers)).catch((error) => {
      console.warn('Unable to save accessibility points.', error);
    });
  }, [storageReady, userMarkers]);

  useEffect(() => {
    if (!storageReady || !isFirebaseConfigured) return;
    let active = true;
    let stopListening: () => void = () => undefined;

    const startCloudSync = async () => {
      setCloudSyncState('connecting');
      try {
        const ownerId = await connectFirebase();
        if (!active || !ownerId) return;
        setFirebaseOwnerId(ownerId);

        await Promise.all(userMarkersRef.current.map((marker) => saveSharedMarker({ ...marker, ownerId: marker.ownerId ?? ownerId })));
        if (!active) return;

        stopListening = subscribeToSharedMarkers(
          (documents) => {
            if (!active) return;
            const sharedMarkers = documents.filter(isStoredUserMarker).map((marker) => ({
              ...marker,
              sourceLabel: 'RouteAble community survey · synced',
            }));
            userMarkersRef.current = sharedMarkers;
            setUserMarkers(sharedMarkers);
            setCloudSyncState('synced');
          },
          (error) => {
            console.warn('Unable to receive shared accessibility points.', error);
            if (active) setCloudSyncState('error');
          },
        );
      } catch (error) {
        console.warn('Unable to start Firebase sync.', error);
        if (active) setCloudSyncState('error');
      }
    };

    void startCloudSync();
    return () => {
      active = false;
      stopListening();
    };
  }, [storageReady]);
  const allMarkers = useMemo(() => [...mapMarkers, ...userMarkers], [userMarkers]);
  const selectedMarker = useMemo(() => allMarkers.find((marker) => marker.id === selectedId) ?? null, [allMarkers, selectedId]);
  const selectedAccessProfile = useMemo(() => selectedMarker ? getBuildingAccessProfile(selectedMarker.id) : [], [selectedMarker]);
  const relatedAccessMarkers = useMemo(
    () => selectedMarker ? allMarkers.filter((marker) => marker.buildingId === selectedMarker.id) : [],
    [allMarkers, selectedMarker],
  );
  const destinationMarker = useMemo(() => allMarkers.find((marker) => marker.id === destinationId) ?? null, [allMarkers, destinationId]);
  const visibleMarkers = useMemo(() => {
    if (selectedMarker && selectedAccessProfile.length) {
      return detailsExpanded
        ? [selectedMarker, ...relatedAccessMarkers]
        : [selectedMarker];
    }
    if (destinationMarker && !selectedMarker) {
      return [destinationMarker, ...allMarkers.filter((marker) => marker.buildingId === destinationMarker.id)];
    }
    return allMarkers.filter((marker) => matchesFilter(marker, filter));
  }, [allMarkers, destinationMarker, detailsExpanded, filter, relatedAccessMarkers, selectedAccessProfile.length, selectedMarker]);
  const { searchResults, searchResultsLabel } = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (query) {
      const matches = campusMarkers.filter((marker) => `${marker.title} ${marker.location} ${marker.symbol}`.toLocaleLowerCase().includes(query)).slice(0, 6);
      return { searchResults: matches, searchResultsLabel: `${matches.length} MATCHES` };
    }
    const recent = recentSearchIds
      .map((id) => campusMarkers.find((marker) => marker.id === id))
      .filter((marker): marker is CampusMarker => Boolean(marker))
      .slice(0, 4);
    if (recent.length) return { searchResults: recent, searchResultsLabel: 'RECENT SEARCHES' };
    const recommendedIds = ['building-44', 'building-42', 'building-52', 'central-library'];
    const recommended = recommendedIds
      .map((id) => campusMarkers.find((marker) => marker.id === id))
      .filter((marker): marker is CampusMarker => Boolean(marker));
    return { searchResults: recommended, searchResultsLabel: 'SUGGESTED PLACES' };
  }, [recentSearchIds, searchQuery]);
  const referencePosition = position ?? DEMO_POSITION;
  const isOutsideCampus = position !== null && distanceInMetres(position, KMUTNB_CAMPUS_CENTER) > 3_000;
  const filterCounts = useMemo(() => ({
    buildings: campusMarkers.length,
    facility: allMarkers.filter((marker) => matchesFilter(marker, 'facility')).length,
    obstacle: allMarkers.filter((marker) => matchesFilter(marker, 'obstacle')).length,
  }), [allMarkers]);

  const moveMapTo = (coordinate: Coordinates, delta = 0.0016) => {
    const zoom = delta <= 0.0008 ? 18.3 : delta <= 0.0016 ? 17.2 : 15.2;
    setMapZoom(zoom);
    cameraRef.current?.easeTo({ center: [coordinate.longitude, coordinate.latitude], zoom, duration: 650 });
  };
  const changeMapZoom = (step: number) => {
    const nextZoom = Math.min(21, Math.max(14, mapZoom + step));
    setMapZoom(nextZoom);
    cameraRef.current?.zoomTo(nextZoom, { duration: 260 });
  };
  const selectMarker = (marker: CampusMarker) => {
    setSearchFocused(false);
    Keyboard.dismiss();
    setDetailsExpanded(false);
    setSelectedId(marker.id);
    moveMapTo(marker.coordinate);
  };
  const cancelAddingPoint = () => {
    setIsAddingPoint(false);
    setDraftCoordinate(null);
    setDraftKind('path');
    setDraftLocationNote('');
  };
  const startAddingPoint = () => {
    setSelectedId(null);
    setDestinationId(null);
    setSearchFocused(false);
    Keyboard.dismiss();
    setDraftCoordinate(null);
    setDraftKind('path');
    setDraftLocationNote('');
    setIsAddingPoint(true);
  };
  const placeDraftPoint = (event: PressEvent) => {
    if (!isAddingPoint) return;
    setDraftCoordinate({ longitude: event.lngLat[0], latitude: event.lngLat[1] });
  };
  const handleMapPress = (event: { nativeEvent: PressEvent }) => {
    setSearchFocused(false);
    Keyboard.dismiss();
    placeDraftPoint(event.nativeEvent);
  };
  const saveDraftPoint = () => {
    if (!draftCoordinate) return;
    Keyboard.dismiss();
    setSearchFocused(false);
    const option = NEW_POINT_OPTIONS.find((item) => item.kind === draftKind) ?? NEW_POINT_OPTIONS[0];
    const locationNote = draftLocationNote.trim();
    const marker: CampusMarker = {
      id: createUserPointId(),
      category: option.category,
      kind: option.kind,
      title: option.label,
      location: locationNote || 'Location note not added',
      coordinate: draftCoordinate,
      status: 'caution',
      description: 'User-added accessibility point. Location and condition have not been verified.',
      color: option.color,
      symbol: option.symbol,
      sourceLabel: 'User added · saved on this device',
      sourceUrl: '',
      ownerId: firebaseOwnerId ?? undefined,
    };
    setUserMarkers((markers) => [...markers, marker]);
    if (isFirebaseConfigured) {
      setCloudSyncState('connecting');
      void saveSharedMarker(marker)
        .then((ownerId) => {
          if (ownerId) setFirebaseOwnerId(ownerId);
        })
        .catch((error) => {
          console.warn('Unable to sync the new accessibility point.', error);
          setCloudSyncState('error');
        });
    }
    setFilter(option.category);
    setSelectedId(marker.id);
    setIsAddingPoint(false);
    setDraftCoordinate(null);
    setDraftKind('path');
    setDraftLocationNote('');
    moveMapTo(marker.coordinate);
  };
  const deleteUserPoint = (marker: CampusMarker) => {
    if (!marker.id.startsWith('user-point-')) return;
    Alert.alert(
      'Delete accessibility point?',
      `${marker.title} will be removed from RouteAble${isFirebaseConfigured ? ' on every synced device' : ' on this device'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const removeMarker = () => {
              setUserMarkers((markers) => markers.filter((item) => item.id !== marker.id));
              if (destinationId === marker.id) {
                setDestinationId(null);
                setDirectionsReady(false);
                setSearchQuery('');
              }
              setSelectedId(null);
            };

            if (!isFirebaseConfigured) {
              removeMarker();
              return;
            }

            setCloudSyncState('connecting');
            void deleteSharedMarker(marker.id)
              .then(() => {
                removeMarker();
                setCloudSyncState('synced');
              })
              .catch((error) => {
                console.warn('Unable to delete the shared accessibility point.', error);
                setCloudSyncState('error');
                Alert.alert('Point not deleted', 'Connect to the internet and try again.');
              });
          },
        },
      ],
    );
  };
  const selectSearchResult = (marker: CampusMarker) => {
    setRecentSearchIds((ids) => [marker.id, ...ids.filter((id) => id !== marker.id)].slice(0, 4));
    setFilter('buildings');
    setSearchQuery('');
    setSearchFocused(false);
    Keyboard.dismiss();
    selectMarker(marker);
  };
  const showDestinationOverview = (marker: CampusMarker) => {
    if (!position) {
      moveMapTo(marker.coordinate);
      return;
    }
    cameraRef.current?.fitBounds([
      Math.min(position.longitude, marker.coordinate.longitude),
      Math.min(position.latitude, marker.coordinate.latitude),
      Math.max(position.longitude, marker.coordinate.longitude),
      Math.max(position.latitude, marker.coordinate.latitude),
    ], { padding: { top: 230, right: 72, bottom: 270, left: 72 }, duration: 650 });
  };
  const setDestination = (marker: CampusMarker) => {
    setSearchFocused(false);
    Keyboard.dismiss();
    setDirectionsReady(false);
    setDestinationId(marker.id);
    setSearchQuery('');
    setSelectedId(null);
    setTimeout(() => showDestinationOverview(marker), 220);
    setTimeout(() => setDirectionsReady(true), 700);
  };
  const toggleAccessDetails = () => {
    const shouldExpand = !detailsExpanded;
    setDetailsExpanded(shouldExpand);
    if (!selectedMarker) return;

    setTimeout(() => {
      if (shouldExpand && relatedAccessMarkers.length) {
        moveMapTo(selectedMarker.coordinate, 0.00072);
        return;
      }
      moveMapTo(selectedMarker.coordinate);
    }, 160);
  };
  const openWalkingDirections = async () => {
    if (!destinationMarker || !position) return;
    const origin = encodeURIComponent(`${position.latitude},${position.longitude}`);
    const destination = encodeURIComponent(`${destinationMarker.coordinate.latitude},${destinationMarker.coordinate.longitude}`);
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open directions', 'Please check that Google Maps or a web browser is available.');
    }
  };

  useEffect(() => {
    if (!markerId) return;
    const marker = mapMarkers.find((item) => item.id === markerId);
    if (!marker) return;
    const selectionTimer = setTimeout(() => {
      setFilter(marker.buildingId ? marker.category : 'buildings');
      setDetailsExpanded(false);
      setSelectedId(marker.id);
    }, 0);
    const moveTimer = setTimeout(() => moveMapTo(marker.coordinate), 450);
    return () => {
      clearTimeout(selectionTimer);
      clearTimeout(moveTimer);
    };
  }, [markerId]);

  useEffect(() => {
    sheetEntrance.stopAnimation();
    if (!selectedMarker) {
      sheetEntrance.setValue(0);
      return;
    }
    sheetEntrance.setValue(0);
    Animated.timing(sheetEntrance, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [selectedMarker, sheetEntrance]);

  const findNearestAccessPoint = () => {
    const nearest = allMarkers
      .filter((marker) => ACCESSIBLE_KINDS.has(marker.kind) && marker.status !== 'unavailable')
      .sort((a, b) => distanceInMetres(referencePosition, a.coordinate) - distanceInMetres(referencePosition, b.coordinate))[0];
    if (nearest) {
      setFilter('facility');
      selectMarker(nearest);
      return;
    }
    setFilter('facility');
    moveMapTo(BUILDING_44, 0.0009);
    Alert.alert('No access points available', 'Ramp and elevator information will appear after survey data has been added.');
  };
  const locationLabel = locationState === 'ready'
    ? isOutsideCampus ? 'OUTSIDE' : 'GPS LIVE'
    : locationState === 'requesting' ? 'LOCATING' : 'GPS OFF';

  return (
    <View style={styles.screen}>
      <Map attribution attributionPosition={{ bottom: 12, left: 12 }} compass={false} logo={false} mapStyle={MAP_STYLE_URLS[mapType]} onPress={handleMapPress} style={StyleSheet.absoluteFill}>
        <Camera initialViewState={{ center: [KMUTNB_CAMPUS_CENTER.longitude, KMUTNB_CAMPUS_CENTER.latitude], zoom: 16.8 }} maxZoom={21} minZoom={14} ref={cameraRef} />
        {detailsExpanded && selectedMarker ? relatedAccessMarkers.map((marker) => (
          <GeoJSONSource data={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[marker.coordinate.longitude, marker.coordinate.latitude], [spreadAccessCoordinate(marker, selectedMarker).longitude, spreadAccessCoordinate(marker, selectedMarker).latitude]] } }} id={`access-link-source-${marker.id}`} key={`access-link-${marker.id}`}>
            <Layer id={`access-link-layer-${marker.id}`} type="line" style={{ lineCap: 'round', lineColor: '#607D83', lineDasharray: [2, 2], lineWidth: 2 }} />
          </GeoJSONSource>
        )) : null}
        {visibleMarkers.map((marker) => {
          const isLandmark = marker.kind === 'building' || marker.kind === 'library' || marker.kind === 'canteen';
          const isSelected = selectedId === marker.id;
          const isDestination = destinationId === marker.id;
          const isExpandedAccessPoint = Boolean(detailsExpanded && selectedMarker && marker.buildingId === selectedMarker.id);
          const markerCoordinate = isExpandedAccessPoint && selectedMarker ? spreadAccessCoordinate(marker, selectedMarker) : marker.coordinate;
          return (
            <Marker accessibilityLabel={`${marker.title}, ${marker.kind}, ${statusLabel(marker.status)}`} anchor="bottom" id={marker.id} key={`${marker.id}-${isSelected ? 'selected' : isDestination ? 'destination' : 'default'}`} lngLat={[markerCoordinate.longitude, markerCoordinate.latitude]} onPress={() => { if (!isAddingPoint) selectMarker(marker); }}>
              <View style={[styles.markerPin, isLandmark && styles.buildingPin, marker.category === 'obstacle' && styles.obstaclePin, isDestination && styles.destinationPin, isSelected && styles.selectedPin, { backgroundColor: marker.color }]}>
                <Text style={[styles.markerSymbol, marker.symbol.length > 2 && styles.compactSymbol]}>{marker.symbol}</Text>
              </View>
            </Marker>
          );
        })}
        {draftCoordinate ? <Marker anchor="center" id="draft-accessibility-point" lngLat={[draftCoordinate.longitude, draftCoordinate.latitude]}><View style={styles.draftMarker}><Text style={styles.draftMarkerText}>+</Text></View></Marker> : null}
        <Marker anchor="center" id="current-or-demo-position" lngLat={[(position ?? DEMO_POSITION).longitude, (position ?? DEMO_POSITION).latitude]}><View style={styles.demoMarker}><View style={styles.demoMarkerCore} /></View></Marker>
      </Map>

      <View style={[styles.header, { top: insets.top + 10 }]}>
        <View style={styles.brandMark}><Text style={styles.brandLetter}>R</Text></View>
        <View style={styles.headerCopy}><Text style={styles.title}>RouteAble</Text><Text style={styles.eyebrow}>KMUTNB ACCESS MAP</Text></View>
        <Pressable accessibilityLabel={locationLabel} disabled={locationState === 'ready' && !isOutsideCampus} onPress={() => isOutsideCampus ? moveMapTo(KMUTNB_CAMPUS_CENTER, 0.0062) : void retry()} style={styles.gpsBadge}>
          <View style={[styles.locationDot, locationState === 'ready' && styles.locationDotReady]} /><Text style={styles.gpsText}>{locationLabel}</Text>
        </Pressable>
      </View>

      <View style={[styles.searchArea, { top: insets.top + 88 }]}>
        <View style={[styles.searchBar, searchFocused && styles.searchBarFocused]}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Search campus buildings"
            autoCapitalize="none"
            autoCorrect={false}
            onBlur={() => setTimeout(() => setSearchFocused(false), 120)}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            placeholder="Search buildings or faculties"
            placeholderTextColor="#829399"
            returnKeyType="search"
            style={styles.searchInput}
            value={searchQuery}
          />
          {searchQuery ? <Pressable accessibilityLabel="Clear search" onPress={() => setSearchQuery('')} style={styles.clearSearch}><Text style={styles.clearSearchText}>×</Text></Pressable> : null}
        </View>
        {searchFocused ? (
          <View style={styles.searchResults}>
            <Text style={styles.searchResultsLabel}>{searchResultsLabel}</Text>
            {searchResults.length ? searchResults.map((marker) => (
              <Pressable accessibilityLabel={`Select ${marker.title} as a destination candidate`} key={marker.id} onPress={() => selectSearchResult(marker)} style={styles.searchResultRow}>
                <View style={[styles.searchResultIcon, { backgroundColor: marker.color }]}><Text style={styles.searchResultSymbol}>{marker.symbol}</Text></View>
                <View style={styles.searchResultCopy}><Text style={styles.searchResultTitle}>{marker.title}</Text><Text numberOfLines={1} style={styles.searchResultLocation}>{marker.location}</Text></View>
                <Text style={styles.searchResultArrow}>›</Text>
              </Pressable>
            )) : <Text style={styles.emptySearch}>No campus building found.</Text>}
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.filterContent} horizontal showsHorizontalScrollIndicator={false} style={[styles.filters, { top: insets.top + 148 }]}>
        {filters.map((item) => (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === item.id }} key={item.id}
            onPress={() => {
              setFilter(item.id);
              if (selectedMarker && !matchesFilter(selectedMarker, item.id)) setSelectedId(null);
              moveMapTo(item.id === 'buildings' ? KMUTNB_CAMPUS_CENTER : BUILDING_44, item.id === 'buildings' ? 0.0062 : 0.0009);
            }}
            style={[styles.filterChip, filter === item.id && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>{item.label}</Text>
            <View style={[styles.filterCount, filter === item.id && styles.filterCountActive]}><Text style={[styles.filterCountText, filter === item.id && styles.filterCountTextActive]}>{filterCounts[item.id]}</Text></View>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.zoomControls, { top: insets.top + (isAddingPoint ? 286 : 218) }]}>
        <Pressable accessibilityLabel="Zoom in" accessibilityRole="button" onPress={() => void changeMapZoom(1)} style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomButtonPressed]}><Text style={styles.zoomButtonText}>+</Text></Pressable>
        <View style={styles.zoomDivider} />
        <Pressable accessibilityLabel="Zoom out" accessibilityRole="button" onPress={() => void changeMapZoom(-1)} style={({ pressed }) => [styles.zoomButton, pressed && styles.zoomButtonPressed]}><Text style={styles.zoomButtonText}>−</Text></Pressable>
      </View>

      <View style={[styles.mapTypeControl, { top: insets.top + (isAddingPoint ? 390 : 322) }]}>
        <Pressable
          accessibilityLabel={`Map type: ${MAP_TYPE_OPTIONS.find((option) => option.id === mapType)?.label ?? 'Default'}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: mapTypeMenuOpen }}
          onPress={() => setMapTypeMenuOpen((open) => !open)}
          style={({ pressed }) => [styles.mapTypeButton, mapTypeMenuOpen && styles.mapTypeButtonActive, pressed && styles.mapTypeButtonPressed]}
        >
          <View style={styles.layersIcon}>
            <View style={[styles.layersIconBack, mapTypeMenuOpen && styles.layersIconActive]} />
            <View style={[styles.layersIconMiddle, mapTypeMenuOpen && styles.layersIconActive]} />
            <View style={[styles.layersIconFront, mapTypeMenuOpen && styles.layersIconActive]} />
          </View>
        </Pressable>
        {mapTypeMenuOpen ? (
          <View accessibilityRole="menu" style={styles.mapTypeMenu}>
            {MAP_TYPE_OPTIONS.map((option) => {
              const isActive = mapType === option.id;
              return (
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: isActive }}
                  key={option.id}
                  onPress={() => {
                    setMapType(option.id);
                    setMapTypeMenuOpen(false);
                  }}
                  style={({ pressed }) => [styles.mapTypeOption, isActive && styles.mapTypeOptionActive, pressed && styles.mapTypeOptionPressed]}
                >
                  <View style={[styles.mapTypeRadio, isActive && styles.mapTypeRadioActive]}>{isActive ? <View style={styles.mapTypeRadioDot} /> : null}</View>
                  <Text style={[styles.mapTypeOptionText, isActive && styles.mapTypeOptionTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {isAddingPoint && !draftCoordinate ? (
        <View style={[styles.placementBanner, { top: insets.top + 207 }]}>
          <View style={styles.placementBannerIcon}><Text style={styles.placementBannerIconText}>+</Text></View>
          <View style={styles.placementBannerCopy}><Text style={styles.placementBannerTitle}>Tap the map to place a point</Text><Text style={styles.placementBannerText}>Zoom in first for a more accurate position.</Text></View>
          <Pressable accessibilityLabel="Cancel adding accessibility point" onPress={cancelAddingPoint} style={styles.placementCancel}><Text style={styles.placementCancelText}>Cancel</Text></Pressable>
        </View>
      ) : null}

      {storageReady && !selectedMarker && !destinationMarker && !isAddingPoint ? (
        <Pressable accessibilityHint="Choose a location and accessibility point type" accessibilityLabel="Add an accessibility point" onPress={startAddingPoint} style={({ pressed }) => [styles.addPointButton, pressed && styles.addPointButtonPressed]}><Text style={styles.addPointPlus}>＋</Text></Pressable>
      ) : null}

      {!selectedMarker && !destinationMarker && !isAddingPoint && locationState !== 'denied' && locationState !== 'unavailable' ? (
        <Pressable accessibilityLabel="Centre on my location" onPress={() => position ? moveMapTo(position) : void retry()} style={styles.locateButton}><Text style={styles.locateIcon}>⌖</Text></Pressable>
      ) : null}

      {draftCoordinate ? (
        <View style={styles.addPointSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.addPointHeader}><View><Text style={styles.addPointEyebrow}>NEW ACCESSIBILITY POINT</Text><Text style={styles.addPointTitle}>What is at this location?</Text></View><Pressable accessibilityLabel="Cancel adding point" onPress={cancelAddingPoint} style={styles.addPointClose}><Text style={styles.closeText}>×</Text></Pressable></View>
          <Text style={styles.coordinateText}>{draftCoordinate.latitude.toFixed(6)}, {draftCoordinate.longitude.toFixed(6)}</Text>
          <View style={styles.newPointOptions}>
            {NEW_POINT_OPTIONS.map((option) => (
              <Pressable accessibilityRole="button" accessibilityState={{ selected: draftKind === option.kind }} key={option.kind} onPress={() => setDraftKind(option.kind)} style={[styles.newPointOption, draftKind === option.kind && styles.newPointOptionActive]}>
                <View style={[styles.newPointOptionIcon, { backgroundColor: option.color }]}><Text style={styles.newPointOptionSymbol}>{option.symbol}</Text></View><Text style={[styles.newPointOptionLabel, draftKind === option.kind && styles.newPointOptionLabelActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.locationNoteHeader}><Text style={styles.locationNoteLabel}>LOCATION NOTE</Text><Text style={styles.locationNoteCount}>{draftLocationNote.length}/120</Text></View>
          <TextInput
            accessibilityLabel="Location note for this accessibility point"
            maxLength={120}
            multiline
            onChangeText={setDraftLocationNote}
            placeholder="e.g. In front of Building 44, on the left"
            placeholderTextColor="#8A9BA0"
            style={styles.locationNoteInput}
            textAlignVertical="top"
            value={draftLocationNote}
          />
          <View style={styles.addPointActions}><Pressable accessibilityRole="button" onPress={() => setDraftCoordinate(null)} style={styles.movePointButton}><Text style={styles.movePointButtonText}>Move pin</Text></Pressable><Pressable accessibilityRole="button" onPress={saveDraftPoint} style={styles.savePointButton}><Text style={styles.savePointButtonText}>Save point</Text></Pressable></View>
          <Text style={styles.localOnlyText}>{cloudSyncState === 'synced' ? 'Synced with RouteAble cloud · not verified' : cloudSyncState === 'connecting' ? 'Saving on this device · cloud sync pending' : cloudSyncState === 'error' ? 'Saved on this device · cloud sync unavailable' : 'Saved on this device · not verified'}</Text>
        </View>
      ) : isAddingPoint ? null : !selectedMarker && (locationState === 'denied' || locationState === 'unavailable') ? (
        <View style={styles.locationHelpCard}>
          <View style={styles.helpIcon}><Text style={styles.helpIconText}>◎</Text></View>
          <View style={styles.helpCopy}><Text style={styles.helpTitle}>Location access is off</Text><Text style={styles.helpText}>Turn it on to calculate distance from you.</Text></View>
          <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.settingsButton}><Text style={styles.settingsText}>Settings</Text></Pressable>
        </View>
      ) : !selectedMarker && destinationMarker ? (
        <View style={styles.destinationCard}>
          <View style={styles.destinationHeader}>
            <View style={[styles.destinationIcon, { backgroundColor: destinationMarker.color }]}><Text style={styles.destinationIconText}>{destinationMarker.symbol}</Text></View>
            <Pressable accessibilityLabel={`Show ${destinationMarker.title} and my location`} onPress={() => showDestinationOverview(destinationMarker)} style={styles.destinationCopy}>
              <Text style={styles.destinationLabel}>SELECTED DESTINATION</Text><Text numberOfLines={1} style={styles.destinationTitle}>{destinationMarker.title}</Text>
              <Text style={styles.destinationDistance}>{position ? `${formatDistance(distanceInMetres(position, destinationMarker.coordinate))} direct distance` : 'Waiting for GPS location'}</Text>
            </Pressable>
            <Pressable accessibilityLabel="Clear destination" onPress={() => { setDirectionsReady(false); setDestinationId(null); setSearchQuery(''); }} style={styles.clearDestination}><Text style={styles.clearDestinationText}>×</Text></Pressable>
          </View>
          <Pressable accessibilityRole="button" disabled={!position || !directionsReady} onPress={() => void openWalkingDirections()} style={[styles.directionsButton, (!position || !directionsReady) && styles.disabledButton]}><Text style={styles.directionsButtonText}>{!position ? 'GPS location required' : directionsReady ? 'Open in Google Maps' : 'Preparing directions…'}</Text><Text style={styles.directionsArrow}>↗</Text></Pressable>
          <Text style={styles.routeDisclaimer}>Not verified as a step-free or wheelchair-accessible route.</Text>
        </View>
      ) : !selectedMarker ? (
        allMarkers.some((marker) => ACCESSIBLE_KINDS.has(marker.kind) && marker.status !== 'unavailable') ? (
          <Pressable accessibilityRole="button" disabled={locationState === 'requesting'} onPress={findNearestAccessPoint} style={[styles.nearestButton, locationState === 'requesting' && styles.disabledButton]}>
            <View style={styles.nearestIconBox}><Text style={styles.nearestIcon}>♿︎</Text></View><View style={styles.nearestCopy}><Text style={styles.nearestTitle}>Nearest access point</Text><Text style={styles.nearestSubtitle}>{locationState === 'requesting' ? 'Waiting for your location…' : 'Ramp or elevator · check survey status'}</Text></View><Text style={styles.nearestArrow}>›</Text>
          </Pressable>
        ) : null
      ) : (
        <Animated.View style={[styles.detailSheet, selectedAccessProfile.length > 0 && !detailsExpanded && styles.compactDetailSheet, { opacity: sheetEntrance, transform: [{ translateY: sheetEntrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }]}>
          <View style={styles.sheetHandle} />
          <Pressable accessibilityLabel="Close place details" onPress={() => { setDetailsExpanded(false); setSelectedId(null); }} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
          <View style={styles.detailHeader}>
            <View style={[styles.detailIcon, { backgroundColor: selectedMarker.color }]}><Text style={styles.detailIconText}>{selectedMarker.symbol}</Text></View>
            <View style={styles.detailHeading}><Text style={styles.detailTitle}>{selectedMarker.title}</Text><Text numberOfLines={selectedMarker.id.startsWith('user-point-') ? 2 : 1} style={styles.detailLocation}>{selectedMarker.location}</Text></View>
            <View style={styles.distanceBlock}><Text style={styles.distance}>{formatDistance(distanceInMetres(referencePosition, selectedMarker.coordinate))}</Text><Text style={styles.distanceCaption}>{position ? 'FROM YOU' : 'DEMO'}</Text></View>
          </View>
          <View style={styles.statusRow}><View style={[styles.statusBadge, selectedMarker.status === 'available' ? styles.statusAvailableBackground : selectedMarker.status === 'unavailable' ? styles.statusUnavailableBackground : styles.statusCautionBackground]}><Text style={styles.statusBadgeIcon}>{selectedMarker.status === 'available' ? '✓' : selectedMarker.status === 'unavailable' ? '×' : '!'}</Text></View><Text style={styles.statusText}>{statusLabel(selectedMarker.status)}</Text><Text style={styles.typeText}>{selectedMarker.category.toUpperCase()} · {selectedMarker.kind.toUpperCase()}</Text></View>
          {selectedAccessProfile.length ? (
            <View style={styles.accessSection}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsExpanded }} onPress={toggleAccessDetails} style={styles.accessSummaryButton}>
                <View style={styles.accessSummaryIcon}><Text style={styles.accessSummaryIconText}>♿︎</Text></View>
                <View style={styles.accessSummaryCopy}><Text style={styles.accessSummaryTitle}>Accessibility details</Text><Text style={styles.accessSummarySubtitle}>Ramp · elevator · barriers</Text></View>
                <View style={styles.accessSummaryMeta}><Text style={styles.accessSummaryProgress}>{selectedAccessProfile.filter((item) => item.state !== 'unverified').length}/4</Text><Text style={styles.accessSummaryAction}>{detailsExpanded ? 'Hide ︿' : 'View ﹀'}</Text></View>
              </Pressable>
              {detailsExpanded ? (
                <>
                  <View style={styles.accessSectionHeader}><Text style={styles.accessSectionTitle}>SURVEY STATUS</Text><Text style={styles.accessSectionProgress}>{selectedAccessProfile.filter((item) => item.state !== 'unverified').length}/4 surveyed</Text></View>
                  <View style={styles.accessGrid}>
                    {selectedAccessProfile.map((item) => (
                      <Pressable
                        accessibilityHint={item.markerId ? 'Shows the survey point on the map' : 'A field survey point has not been added yet'}
                        accessibilityLabel={`${item.label}: ${accessStateLabel(item)}`}
                        disabled={!item.markerId}
                        key={item.kind}
                        onPress={() => {
                          const accessMarker = allMarkers.find((marker) => marker.id === item.markerId);
                          if (accessMarker) selectMarker(accessMarker);
                        }}
                        style={[styles.accessItem, item.markerId && styles.accessItemLinked]}
                      >
                        <Text style={styles.accessItemSymbol}>{item.symbol}</Text>
                        <View style={styles.accessItemCopy}><Text style={styles.accessItemLabel}>{item.label}</Text><Text style={[styles.accessItemState, accessStateStyle(item.state)]}>{accessStateLabel(item)}</Text></View>
                        {item.markerId ? <Text style={styles.accessItemArrow}>›</Text> : null}
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
          {!selectedAccessProfile.length || detailsExpanded ? <Text numberOfLines={2} style={styles.description}>{selectedMarker.description}</Text> : null}
          {!selectedAccessProfile.length || detailsExpanded ? <Text numberOfLines={1} style={styles.sourceText}>Source: {selectedMarker.sourceLabel}</Text> : null}
          {selectedMarker.id.startsWith('user-point-') ? (
            <View style={styles.userPointActions}>
              <Pressable accessibilityLabel={`Delete ${selectedMarker.title}`} accessibilityRole="button" onPress={() => deleteUserPoint(selectedMarker)} style={styles.deletePointButton}><Text style={styles.deletePointIcon}>⌫</Text><Text style={styles.deletePointText}>Delete point</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => setDestination(selectedMarker)} style={[styles.primaryButton, styles.userPointDestinationButton]}><Text style={styles.primaryButtonText}>{destinationId === selectedMarker.id ? 'Show destination' : 'Set destination'}</Text></Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setDestination(selectedMarker)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{destinationId === selectedMarker.id ? 'Show destination' : 'Set as destination'}</Text></Pressable>
          )}
        </Animated.View>
      )}
      <BottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { position: 'absolute', top: 20, left: 16, right: 16, minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#FFFFFF', borderRadius: 22, backgroundColor: '#F9FFFDF2', elevation: 8, shadowColor: '#17313A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.13, shadowRadius: 14 },
  brandMark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: COLORS.primary }, brandLetter: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  headerCopy: { flex: 1, marginLeft: 11 }, title: { color: COLORS.text, fontSize: 20, fontWeight: '900', letterSpacing: -0.3 }, eyebrow: { marginTop: 2, color: COLORS.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  gpsBadge: { minHeight: 36, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderRadius: 13, backgroundColor: '#E8F5F1' }, gpsText: { marginLeft: 6, color: COLORS.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  locationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.warning }, locationDotReady: { backgroundColor: COLORS.success },
  addPointButton: { position: 'absolute', left: 18, bottom: 178, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 16, backgroundColor: '#F9FFFDF2', elevation: 7, shadowColor: '#17313A', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.15, shadowRadius: 9 }, addPointButtonPressed: { backgroundColor: '#DDF1EE', transform: [{ scale: 0.96 }] }, addPointPlus: { color: COLORS.primary, fontSize: 27, fontWeight: '700', lineHeight: 31 },
  locateButton: { position: 'absolute', right: 18, bottom: 178, width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 18, backgroundColor: COLORS.primary, elevation: 8 }, locateIcon: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  searchArea: { position: 'absolute', left: 16, right: 16, zIndex: 20, elevation: 20 },
  searchBar: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 17, backgroundColor: '#FFFFFFF7', elevation: 5 }, searchBarFocused: { borderColor: COLORS.primary }, searchIcon: { marginRight: 9, color: COLORS.primary, fontSize: 25, fontWeight: '900' }, searchInput: { flex: 1, height: 48, paddingVertical: 0, color: COLORS.text, fontSize: 15, fontWeight: '700' }, clearSearch: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, clearSearchText: { color: COLORS.muted, fontSize: 25 },
  searchResults: { marginTop: 7, overflow: 'hidden', paddingTop: 10, paddingBottom: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, backgroundColor: '#FCFFFF', elevation: 12 }, searchResultsLabel: { marginBottom: 5, paddingHorizontal: 15, color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, searchResultRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, searchResultIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, searchResultSymbol: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' }, searchResultCopy: { flex: 1, marginLeft: 11 }, searchResultTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900' }, searchResultLocation: { marginTop: 2, color: COLORS.muted, fontSize: 11 }, searchResultArrow: { marginLeft: 8, color: COLORS.primary, fontSize: 26 }, emptySearch: { paddingHorizontal: 15, paddingTop: 8, paddingBottom: 14, color: COLORS.muted, fontSize: 13 },
  filters: { position: 'absolute', top: 112, left: 0, right: 0, maxHeight: 50 }, filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, backgroundColor: '#FFFFFFF2', elevation: 3 }, filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary }, filterText: { color: COLORS.text, fontSize: 14, fontWeight: '800' }, filterTextActive: { color: '#FFFFFF' },
  filterCount: { minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderRadius: 11, backgroundColor: '#E8F0F1' }, filterCountActive: { backgroundColor: '#FFFFFF30' }, filterCountText: { color: COLORS.muted, fontSize: 11, fontWeight: '900' }, filterCountTextActive: { color: '#FFFFFF' },
  zoomControls: { position: 'absolute', right: 18, zIndex: 15, width: 50, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 17, backgroundColor: '#F9FFFDF5', elevation: 9, shadowColor: '#17313A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 10 }, zoomButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FFFD' }, zoomButtonPressed: { backgroundColor: '#DDF1EE' }, zoomButtonText: { color: COLORS.primary, fontSize: 29, fontWeight: '700', lineHeight: 32 }, zoomDivider: { height: 1, marginHorizontal: 8, backgroundColor: COLORS.border },
  mapTypeControl: { position: 'absolute', right: 18, zIndex: 16, alignItems: 'flex-end' }, mapTypeButton: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 17, backgroundColor: '#F9FFFDF5', elevation: 9, shadowColor: '#17313A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 10 }, mapTypeButtonActive: { borderColor: '#C8E9E5', backgroundColor: COLORS.primary }, mapTypeButtonPressed: { opacity: 0.88 },
  layersIcon: { width: 28, height: 28 }, layersIconBack: { position: 'absolute', left: 5, top: 13, width: 18, height: 10, borderWidth: 2, borderColor: COLORS.primary, borderRadius: 3, transform: [{ rotate: '45deg' }] }, layersIconMiddle: { position: 'absolute', left: 5, top: 9, width: 18, height: 10, borderWidth: 2, borderColor: COLORS.primary, borderRadius: 3, backgroundColor: '#F9FFFD', transform: [{ rotate: '45deg' }] }, layersIconFront: { position: 'absolute', left: 5, top: 5, width: 18, height: 10, borderWidth: 2, borderColor: COLORS.primary, borderRadius: 3, backgroundColor: '#F9FFFD', transform: [{ rotate: '45deg' }] }, layersIconActive: { borderColor: '#FFFFFF', backgroundColor: COLORS.primary },
  mapTypeMenu: { width: 146, overflow: 'hidden', marginTop: 8, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: 17, backgroundColor: '#FCFFFF', elevation: 12, shadowColor: '#17313A', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.2, shadowRadius: 12 }, mapTypeOption: { minHeight: 45, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 }, mapTypeOptionActive: { backgroundColor: '#E9F6F3' }, mapTypeOptionPressed: { backgroundColor: '#DDF1EE' }, mapTypeRadio: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', marginRight: 9, borderWidth: 2, borderColor: '#9AAEB2', borderRadius: 9 }, mapTypeRadioActive: { borderColor: COLORS.primary }, mapTypeRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary }, mapTypeOptionText: { color: COLORS.text, fontSize: 13, fontWeight: '800' }, mapTypeOptionTextActive: { color: COLORS.primary, fontWeight: '900' },
  markerPin: { minWidth: 42, height: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 21, elevation: 7 }, buildingPin: { minWidth: 35, height: 35, borderRadius: 12 }, obstaclePin: { borderRadius: 12 }, destinationPin: { borderWidth: 4, borderColor: COLORS.primary, transform: [{ scale: 1.08 }] }, selectedPin: { borderWidth: 4, borderColor: COLORS.text, transform: [{ scale: 1.12 }] }, markerSymbol: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, compactSymbol: { fontSize: 11 },
  draftMarker: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFFFFF', borderRadius: 26, backgroundColor: COLORS.primary, elevation: 12, shadowColor: COLORS.text, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.28, shadowRadius: 10 }, draftMarkerText: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', lineHeight: 34 },
  demoMarker: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#176B8738' }, demoMarkerCore: { width: 22, height: 22, borderWidth: 4, borderColor: '#FFFFFF', borderRadius: 11, backgroundColor: COLORS.primary },
  placementBanner: { position: 'absolute', left: 16, right: 16, zIndex: 22, minHeight: 70, flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: '#A9D6D1', borderRadius: 19, backgroundColor: '#F8FFFDF7', elevation: 10 }, placementBannerIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: COLORS.primary }, placementBannerIconText: { color: '#FFFFFF', fontSize: 26, fontWeight: '700' }, placementBannerCopy: { flex: 1, marginLeft: 10 }, placementBannerTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' }, placementBannerText: { marginTop: 2, color: COLORS.muted, fontSize: 10 }, placementCancel: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 10 }, placementCancelText: { color: COLORS.danger, fontSize: 12, fontWeight: '900' },
  addPointSheet: { position: 'absolute', left: 12, right: 12, bottom: 86, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 28, backgroundColor: '#FCFFFF', elevation: 16, shadowColor: '#17313A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 }, addPointHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, addPointEyebrow: { color: COLORS.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 }, addPointTitle: { marginTop: 3, color: COLORS.text, fontSize: 18, fontWeight: '900' }, addPointClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, coordinateText: { marginTop: 2, color: COLORS.muted, fontSize: 11, fontWeight: '700' }, newPointOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 }, newPointOption: { minHeight: 43, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, backgroundColor: COLORS.background }, newPointOptionActive: { borderColor: COLORS.primary, backgroundColor: '#EAF7F4' }, newPointOptionIcon: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, newPointOptionSymbol: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' }, newPointOptionLabel: { marginLeft: 6, color: COLORS.muted, fontSize: 11, fontWeight: '800' }, newPointOptionLabelActive: { color: COLORS.text }, locationNoteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 6 }, locationNoteLabel: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, locationNoteCount: { color: COLORS.muted, fontSize: 10, fontWeight: '700' }, locationNoteInput: { minHeight: 66, maxHeight: 84, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, backgroundColor: COLORS.background, color: COLORS.text, fontSize: 13, lineHeight: 18 }, addPointActions: { flexDirection: 'row', gap: 8, marginTop: 12 }, movePointButton: { minHeight: 47, flex: 0.42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.primary, borderRadius: 14, backgroundColor: '#FFFFFF' }, movePointButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: '900' }, savePointButton: { minHeight: 47, flex: 0.58, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: COLORS.primary }, savePointButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, localOnlyText: { marginTop: 7, color: COLORS.warning, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  nearestButton: { position: 'absolute', left: 16, right: 82, bottom: 92, minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderRadius: 21, backgroundColor: COLORS.primary, elevation: 9, shadowColor: '#123D4B', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.2, shadowRadius: 13 }, disabledButton: { opacity: 0.72 }, nearestIconBox: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#FFFFFF20' }, nearestIcon: { color: '#FFFFFF', fontSize: 25 }, nearestCopy: { flex: 1, marginLeft: 11 }, nearestTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, nearestSubtitle: { marginTop: 3, color: '#D9F0F2', fontSize: 12 }, nearestArrow: { color: '#FFFFFF', fontSize: 30 },
  destinationCard: { position: 'absolute', left: 16, right: 16, bottom: 92, minHeight: 146, padding: 10, borderWidth: 1, borderColor: '#BBDADB', borderRadius: 23, backgroundColor: '#FCFFFF', elevation: 9 }, destinationHeader: { flexDirection: 'row', alignItems: 'center' }, destinationIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15 }, destinationIconText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, destinationCopy: { flex: 1, justifyContent: 'center', marginLeft: 11 }, destinationLabel: { color: COLORS.primary, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }, destinationTitle: { marginTop: 2, color: COLORS.text, fontSize: 16, fontWeight: '900' }, destinationDistance: { marginTop: 2, color: COLORS.muted, fontSize: 11, fontWeight: '700' }, clearDestination: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, clearDestinationText: { color: COLORS.muted, fontSize: 27 }, directionsButton: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, borderRadius: 14, backgroundColor: COLORS.primary }, directionsButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, directionsArrow: { marginLeft: 8, color: '#FFFFFF', fontSize: 18, fontWeight: '900' }, routeDisclaimer: { marginTop: 6, color: COLORS.warning, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  locationHelpCard: { position: 'absolute', left: 18, right: 18, bottom: 90, minHeight: 82, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, backgroundColor: COLORS.surface, elevation: 8 }, helpIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#FFF2DE' }, helpIconText: { color: COLORS.warning, fontSize: 24, fontWeight: '900' }, helpCopy: { flex: 1, marginHorizontal: 11 }, helpTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900' }, helpText: { marginTop: 3, color: COLORS.muted, fontSize: 12, lineHeight: 16 }, settingsButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 13, backgroundColor: '#E3F4F3' }, settingsText: { color: COLORS.primary, fontSize: 13, fontWeight: '900' },
  detailSheet: { position: 'absolute', left: 12, right: 12, bottom: 86, minHeight: 292, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 28, backgroundColor: '#FCFFFF', elevation: 16, shadowColor: '#17313A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 }, compactDetailSheet: { minHeight: 0 }, sheetHandle: { alignSelf: 'center', width: 42, height: 4, marginBottom: 14, borderRadius: 2, backgroundColor: COLORS.border },
  closeButton: { position: 'absolute', top: 10, right: 14, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { color: COLORS.muted, fontSize: 28 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingRight: 32 }, detailIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }, detailIconText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' }, detailHeading: { flex: 1, marginLeft: 12 }, detailTitle: { color: COLORS.text, fontSize: 18, fontWeight: '900' }, detailLocation: { marginTop: 3, color: COLORS.muted, fontSize: 13 }, distanceBlock: { alignItems: 'flex-end' }, distance: { color: COLORS.primary, fontSize: 16, fontWeight: '900' }, distanceCaption: { marginTop: 2, color: COLORS.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  statusRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 10, borderRadius: 13, backgroundColor: COLORS.background }, statusBadge: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderRadius: 8 }, statusAvailableBackground: { backgroundColor: '#DDF3E9' }, statusCautionBackground: { backgroundColor: '#FFF0D8' }, statusUnavailableBackground: { backgroundColor: '#FCE2E4' }, statusBadgeIcon: { color: COLORS.text, fontSize: 14, fontWeight: '900' }, statusText: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: '800' }, typeText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  accessSection: { marginTop: 9 }, accessSummaryButton: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#B8DDDA', borderRadius: 15, backgroundColor: '#F1FAF8' }, accessSummaryIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#DDF3ED' }, accessSummaryIconText: { color: COLORS.primary, fontSize: 21 }, accessSummaryCopy: { flex: 1, marginLeft: 10 }, accessSummaryTitle: { color: COLORS.text, fontSize: 13, fontWeight: '900' }, accessSummarySubtitle: { marginTop: 2, color: COLORS.muted, fontSize: 10 }, accessSummaryMeta: { alignItems: 'flex-end', marginLeft: 8 }, accessSummaryProgress: { color: COLORS.primary, fontSize: 12, fontWeight: '900' }, accessSummaryAction: { marginTop: 3, color: COLORS.primary, fontSize: 10, fontWeight: '800' },
  accessSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 7 }, accessSectionTitle: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, accessSectionProgress: { color: COLORS.muted, fontSize: 10, fontWeight: '800' },
  accessGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, accessItem: { width: '48.8%', minHeight: 49, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, borderWidth: 1, borderColor: COLORS.border, borderRadius: 13, backgroundColor: COLORS.background }, accessItemLinked: { borderColor: '#A9D6D1', backgroundColor: '#F0FAF8' }, accessItemSymbol: { width: 22, color: COLORS.primary, fontSize: 17, fontWeight: '900', textAlign: 'center' }, accessItemCopy: { flex: 1, marginLeft: 6 }, accessItemLabel: { color: COLORS.text, fontSize: 11, fontWeight: '900' }, accessItemState: { marginTop: 2, fontSize: 10, fontWeight: '800' }, accessStateUnknown: { color: COLORS.warning }, accessStatePositive: { color: COLORS.success }, accessStateNegative: { color: COLORS.danger }, accessItemArrow: { color: COLORS.primary, fontSize: 20, fontWeight: '900' },
  description: { marginTop: 10, color: COLORS.muted, fontSize: 13, lineHeight: 18 }, sourceText: { marginTop: 6, color: '#87999F', fontSize: 11 }, primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 15, backgroundColor: COLORS.primary }, primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  userPointActions: { flexDirection: 'row', gap: 8, marginTop: 10 }, deletePointButton: { minHeight: 50, flex: 0.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E6A8AD', borderRadius: 15, backgroundColor: '#FFF5F5' }, deletePointIcon: { marginRight: 5, color: COLORS.danger, fontSize: 18, fontWeight: '900' }, deletePointText: { color: COLORS.danger, fontSize: 12, fontWeight: '900' }, userPointDestinationButton: { flex: 0.6, marginTop: 0 },
});
