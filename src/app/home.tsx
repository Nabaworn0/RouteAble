import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

type Category = 'All' | 'Buildings' | 'Ramps' | 'Elevators' | 'Barriers';

type Place = {
  id: string;
  name: string;
  detail: string;
  category: Category;
  icon: string;
  accent: string;
  status: string;
};

const PURPLE = '#6548E8';
const categories: Category[] = ['All', 'Buildings', 'Ramps', 'Elevators', 'Barriers'];

const places: Place[] = [
  {
    id: 'building-44',
    name: 'Building 44',
    detail: 'Practical & Workshop Building',
    category: 'Buildings',
    icon: '44',
    accent: '#6548E8',
    status: 'Access survey pending',
  },
  {
    id: 'building-52',
    name: 'Building 52',
    detail: 'Faculty of Technical Education',
    category: 'Buildings',
    icon: '52',
    accent: '#4A9FCF',
    status: 'Access survey pending',
  },
  {
    id: 'eti-department',
    name: 'ETI Department',
    detail: 'Building 52 · Floor 6',
    category: 'Buildings',
    icon: 'ETI',
    accent: '#49A987',
    status: 'Location confirmed',
  },
];

export default function RouteAbleHomeScreen() {
  const { width, height } = useWindowDimensions();
  const compact = width < 520 || height < 760;
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [query, setQuery] = useState('');

  const visiblePlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return places.filter(
      (place) =>
        (activeCategory === 'All' || place.category === activeCategory) &&
        (!normalizedQuery || `${place.name} ${place.detail}`.toLowerCase().includes(normalizedQuery)),
    );
  }, [activeCategory, query]);

  return (
    <View style={[styles.previewArea, compact && styles.previewAreaCompact]}>
      <View style={[styles.phoneScreen, compact && styles.phoneScreenCompact]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable accessibilityLabel="Open menu" style={styles.menuButton}>
              <View style={styles.menuLineLong} />
              <View style={styles.menuLineShort} />
            </Pressable>
            <View style={styles.avatar} accessibilityLabel="Profile">
              <Text style={styles.avatarText}>M</Text>
              <View style={styles.onlineDot} />
            </View>
          </View>

          <Text style={styles.greeting}>Hi, M</Text>
          <Text style={styles.subtitle}>Explore the KMUTNB North Bangkok campus</Text>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              accessibilityLabel="Search KMUTNB buildings and access points"
              onChangeText={setQuery}
              placeholder="Search KMUTNB buildings"
              placeholderTextColor="#AAA7B0"
              style={styles.searchInput}
              value={query}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.categoryRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {categories.map((category) => {
              const active = activeCategory === category;
              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={category}
                  onPress={() => setActiveCategory(category)}
                  style={[styles.categoryTab, active && styles.categoryTabActive]}
                >
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{category}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.featureCard}>
            <View style={styles.featureImageArea}>
              <Image
                accessibilityLabel="Concept illustration for the Building 44 accessibility survey area"
                resizeMode="cover"
                source={require('../../assets/images/accessible-route-card.png')}
                style={styles.featureImage}
              />
              <View style={styles.imageBadge}>
                <Text style={styles.imageBadgeIcon}>◎</Text>
                <Text style={styles.imageBadgeText}>SURVEY AREA</Text>
              </View>
              <View style={styles.metricColumn}>
                <View style={styles.metricBox}><Text style={styles.metricLabel}>AREA</Text><Text style={styles.metricValue}>FTE</Text></View>
                <View style={styles.metricBox}><Text style={styles.metricLabel}>BUILDING</Text><Text style={styles.metricValue}>44</Text></View>
                <View style={styles.metricBox}><Text style={styles.metricLabel}>ACCESS</Text><Text style={styles.metricValue}>Pending</Text></View>
              </View>
            </View>

            <View style={styles.featureContent}>
              <View style={styles.featureTitleRow}>
                <View style={styles.featureCopy}>
                  <Text style={styles.featureTitle}>Building 44</Text>
                  <Text style={styles.featureMeta}>Practical & Workshop Building</Text>
                </View>
                <Pressable accessibilityLabel="Save Building 44" style={styles.saveButton}>
                  <Text style={styles.saveIcon}>♥</Text>
                </Pressable>
              </View>
              <View style={styles.featureFooter}>
                <View>
                  <Text style={styles.featureFooterLabel}>MVP FIELD SURVEY</Text>
                  <Text style={styles.featureFooterValue}>Access data pending</Text>
                </View>
                <Pressable accessibilityLabel="View Building 44 details" style={styles.viewRouteButton}>
                  <Text style={styles.viewRouteText}>View details</Text>
                  <Text style={styles.viewRouteArrow}>→</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Explore KMUTNB</Text>
            <Pressable accessibilityLabel="See all KMUTNB locations"><Text style={styles.seeAll}>See all</Text></Pressable>
          </View>

          {visiblePlaces.length > 0 ? (
            <View style={styles.placeGrid}>
              {visiblePlaces.slice(0, 2).map((place) => (
                <Pressable accessibilityRole="button" key={place.id} style={styles.placeCard}>
                  <View style={[styles.placeArtwork, { backgroundColor: `${place.accent}12` }]}>
                    <View style={[styles.placeCircle, { backgroundColor: place.accent }]}>
                      <Text style={styles.placeIcon}>{place.icon}</Text>
                    </View>
                    <View style={[styles.artRoute, { backgroundColor: place.accent }]} />
                    <View style={styles.artBuilding} />
                  </View>
                  <Text numberOfLines={1} style={styles.placeName}>{place.name}</Text>
                  <Text numberOfLines={1} style={styles.placeDetail}>{place.detail}</Text>
                  <Text numberOfLines={1} style={styles.placeStatus}>{place.status}</Text>
                  <View style={styles.placeActionRow}>
                    <View style={styles.placeButton}><Text style={styles.placeButtonText}>View</Text></View>
                    <Text style={styles.placeArrow}>→</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No verified records yet</Text>
              <Text style={styles.emptyText}>Add data after the KMUTNB field survey.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewArea: { flex: 1, minHeight: '100%', alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#E9E9ED' },
  previewAreaCompact: { padding: 0 },
  phoneScreen: { width: '100%', maxWidth: 390, height: 760, overflow: 'hidden', borderRadius: 30, backgroundColor: '#F7F7F9', shadowColor: '#2B2942', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.16, shadowRadius: 34 },
  phoneScreenCompact: { maxWidth: 430, height: '100%', minHeight: 680, borderRadius: 0 },
  content: { paddingHorizontal: 27, paddingTop: 23, paddingBottom: 35 },
  topBar: { height: 39, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuButton: { width: 44, height: 44, justifyContent: 'center' },
  menuLineLong: { width: 17, height: 2, borderRadius: 2, backgroundColor: '#302D39' },
  menuLineShort: { width: 10, height: 2, marginTop: 5, borderRadius: 2, backgroundColor: '#302D39' },
  avatar: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#E8E3FF' },
  avatarText: { color: PURPLE, fontSize: 14, fontWeight: '900' },
  onlineDot: { position: 'absolute', right: -2, bottom: -2, width: 11, height: 11, borderWidth: 3, borderColor: '#F7F7F9', borderRadius: 6, backgroundColor: '#4BB68D' },
  greeting: { marginTop: 9, color: '#312E39', fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 4, color: '#96929C', fontSize: 11.5, fontWeight: '600' },
  searchBox: { height: 43, flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingHorizontal: 13, borderWidth: 1, borderColor: '#E7E5EB', borderRadius: 14, backgroundColor: '#FFFFFF' },
  searchIcon: { color: '#77727F', fontSize: 20 },
  searchInput: { flex: 1, height: '100%', marginLeft: 8, color: '#393541', fontSize: 11.5 },
  categoryRow: { paddingTop: 14, paddingBottom: 14 },
  categoryTab: { minWidth: 70, minHeight: 31, alignItems: 'center', justifyContent: 'center', marginRight: 8, paddingHorizontal: 12, borderRadius: 16 },
  categoryTabActive: { backgroundColor: PURPLE },
  categoryText: { color: '#AAA6AF', fontSize: 9.5, fontWeight: '700' },
  categoryTextActive: { color: '#FFFFFF', fontWeight: '900' },
  featureCard: { overflow: 'hidden', borderRadius: 18, backgroundColor: '#FFFFFF', shadowColor: '#282334', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.11, shadowRadius: 18 },
  featureImageArea: { height: 183, overflow: 'hidden', position: 'relative', backgroundColor: '#FAFAFC' },
  featureImage: { width: '100%', height: '100%' },
  imageBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, backgroundColor: '#FFFFFFE8' },
  imageBadgeIcon: { color: PURPLE, fontSize: 12, fontWeight: '900' },
  imageBadgeText: { marginLeft: 4, color: '#514C60', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.45 },
  metricColumn: { position: 'absolute', top: 17, right: 12 },
  metricBox: { width: 47, minHeight: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 1, borderColor: '#E8E6EC', borderRadius: 9, backgroundColor: '#FFFFFFEC' },
  metricLabel: { color: '#AAA6AF', fontSize: 6.5, fontWeight: '800' },
  metricValue: { marginTop: 2, color: '#55505C', fontSize: 8.5, fontWeight: '900' },
  featureContent: { padding: 14 },
  featureTitleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  featureCopy: { flex: 1 },
  featureTitle: { color: '#34313B', fontSize: 15, fontWeight: '900' },
  featureMeta: { marginTop: 3, color: '#AAA6AF', fontSize: 8.5 },
  saveButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#FFF0F1' },
  saveIcon: { color: '#FF7079', fontSize: 15 },
  featureFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 },
  featureFooterLabel: { color: '#AAA6AF', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  featureFooterValue: { marginTop: 3, color: '#4D4855', fontSize: 10, fontWeight: '900' },
  viewRouteButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, borderRadius: 11, backgroundColor: PURPLE },
  viewRouteText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },
  viewRouteArrow: { marginLeft: 6, color: '#FFFFFF', fontSize: 13 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 11 },
  sectionTitle: { color: '#3B3742', fontSize: 14, fontWeight: '900' },
  seeAll: { color: '#9F9AA5', fontSize: 8.5, fontWeight: '700' },
  placeGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  placeCard: { width: '48.5%', minHeight: 174, padding: 10, borderWidth: 1, borderColor: '#E7E5EA', borderRadius: 15, backgroundColor: '#FFFFFF' },
  placeArtwork: { height: 74, overflow: 'hidden', position: 'relative', borderRadius: 11 },
  placeCircle: { position: 'absolute', left: 12, top: 15, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', zIndex: 2, borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 17 },
  placeIcon: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  artRoute: { position: 'absolute', left: 38, top: 44, width: 64, height: 4, borderRadius: 2, transform: [{ rotate: '-18deg' }] },
  artBuilding: { position: 'absolute', right: 11, top: 11, width: 39, height: 28, borderRadius: 4, backgroundColor: '#DAD7E2' },
  placeName: { marginTop: 10, color: '#46414D', fontSize: 10.5, fontWeight: '900' },
  placeDetail: { marginTop: 3, color: '#A09BA6', fontSize: 8 },
  placeStatus: { marginTop: 3, color: '#7B6FC5', fontSize: 7.5, fontWeight: '700' },
  placeActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  placeButton: { minWidth: 48, minHeight: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: PURPLE },
  placeButtonText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  placeArrow: { color: '#9D98A3', fontSize: 15 },
  emptyState: { alignItems: 'center', paddingVertical: 35, borderRadius: 16, backgroundColor: '#FFFFFF' },
  emptyTitle: { color: '#48434F', fontSize: 12, fontWeight: '900' },
  emptyText: { marginTop: 5, color: '#9D98A3', fontSize: 9 },
});
