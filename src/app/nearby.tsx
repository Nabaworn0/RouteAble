import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNav } from '../components/BottomNav';
import { COLORS } from '../constants/theme';
import { mapMarkers, type MarkerCategory } from '../data/access-points';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { distanceInMetres, formatDistance } from '../utils/distance';

type Filter = 'all' | MarkerCategory;
const DEMO_POSITION = { latitude: 13.81965, longitude: 100.51472 };
const ACCESSIBLE_KINDS = new Set(['ramp', 'elevator', 'toilet']);
const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'facility', label: '♿︎ Access' }, { id: 'obstacle', label: '⚠ Barriers' },
];

function matchesFilter(kind: string, category: MarkerCategory, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'facility') return ACCESSIBLE_KINDS.has(kind);
  return category === 'obstacle';
}

export default function NearbyScreen() {
  const router = useRouter();
  const { position, state } = useCurrentLocation();
  const [filter, setFilter] = useState<Filter>('all');
  const reference = position ?? DEMO_POSITION;
  const places = useMemo(
    () => mapMarkers
      .filter((marker) => matchesFilter(marker.kind, marker.category, filter))
      .map((marker) => ({ ...marker, distance: distanceInMetres(reference, marker.coordinate) }))
      .sort((a, b) => a.distance - b.distance),
    [filter, reference],
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>KMUTNB CAMPUS</Text>
        <Text style={styles.title}>Nearby places</Text>
        <Text style={styles.subtitle}>{state === 'ready' ? 'Sorted from your live GPS location' : 'Sorted from the campus demo position'}</Text>
      </View>
      <View style={styles.filters}>
        {filters.map((item) => (
          <Pressable accessibilityState={{ selected: filter === item.id }} key={item.id} onPress={() => setFilter(item.id)} style={[styles.filterChip, filter === item.id && styles.filterChipActive]}>
            <Text style={[styles.filterText, filter === item.id && styles.filterTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={places}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable accessibilityHint="Shows this point on the map" onPress={() => router.push({ pathname: '/map', params: { markerId: item.id } })} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
            <View style={[styles.iconBox, { backgroundColor: item.color }]}><Text style={styles.iconText}>{item.symbol}</Text></View>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text numberOfLines={1} style={styles.cardLocation}>{item.location}</Text>
              <View style={styles.metaRow}><Text style={styles.category}>{item.category} · {item.kind}</Text><Text style={[styles.status, item.status === 'available' ? styles.statusAvailable : item.status === 'unavailable' ? styles.statusUnavailable : styles.statusCaution]}>{item.status === 'available' ? '✓ Available' : item.status === 'unavailable' ? '× Unavailable' : '! Survey required'}</Text></View>
            </View>
            <View style={styles.distanceBox}><Text style={styles.distance}>{formatDistance(item.distance)}</Text><Text style={styles.showMap}>Map ›</Text></View>
          </Pressable>
        )}
        showsVerticalScrollIndicator={false}
      />
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 16 },
  eyebrow: { color: COLORS.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 5, color: COLORS.text, fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 6, color: COLORS.muted, fontSize: 14 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 14 },
  filterChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, backgroundColor: COLORS.surface },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  filterText: { color: COLORS.text, fontSize: 14, fontWeight: '800' }, filterTextActive: { color: '#FFFFFF' },
  listContent: { paddingHorizontal: 18, paddingBottom: 96, gap: 10 },
  card: { minHeight: 104, flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, backgroundColor: COLORS.surface },
  cardPressed: { opacity: 0.72 }, iconBox: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 15 }, iconText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  cardCopy: { flex: 1, marginLeft: 12 }, cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' }, cardLocation: { marginTop: 3, color: COLORS.muted, fontSize: 13 },
  metaRow: { flexDirection: 'row', marginTop: 8, gap: 8 }, category: { color: COLORS.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, status: { fontSize: 11, fontWeight: '800' }, statusAvailable: { color: COLORS.success }, statusCaution: { color: COLORS.warning }, statusUnavailable: { color: COLORS.danger },
  distanceBox: { minWidth: 55, alignItems: 'flex-end' }, distance: { color: COLORS.primary, fontSize: 14, fontWeight: '900' }, showMap: { marginTop: 14, color: COLORS.muted, fontSize: 12, fontWeight: '700' },
});
