import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNav } from '../components/BottomNav';
import { COLORS } from '../constants/theme';

const legend = [
  { symbol: '♿︎', title: 'Ramp', detail: 'Candidate wheelchair-accessible entrance', color: COLORS.success },
  { symbol: '↕', title: 'Elevator', detail: 'Lift or elevator location', color: '#527DC8' },
  { symbol: 'WC', title: 'Accessible toilet', detail: 'Added after on-site verification', color: COLORS.primary },
  { symbol: '≡', title: 'Stairs', detail: 'Potential mobility barrier', color: COLORS.danger },
  { symbol: '!', title: 'Rough surface', detail: 'Uneven or difficult surface', color: COLORS.warning },
];

export default function InfoScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>ROUTEABLE GUIDE</Text>
        <Text style={styles.title}>Map information</Text>
        <Text style={styles.intro}>RouteAble helps mobility-limited users discover campus facilities and potential barriers before travelling.</Text>

        <Text style={styles.sectionTitle}>Marker legend</Text>
        <View style={styles.card}>
          {legend.map((item, index) => (
            <View key={item.title} style={[styles.legendRow, index < legend.length - 1 && styles.divider]}>
              <View style={[styles.iconBox, { backgroundColor: item.color }]}><Text style={styles.iconText}>{item.symbol}</Text></View>
              <View style={styles.legendCopy}><Text style={styles.legendTitle}>{item.title}</Text><Text style={styles.legendDetail}>{item.detail}</Text></View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Status meanings</Text>
        <View style={styles.card}>
          <Text style={styles.body}><Text style={styles.available}>● Available</Text>{'  '}The place is listed as usable.</Text>
          <Text style={styles.body}><Text style={styles.caution}>● Caution</Text>{'  '}Information is incomplete or needs field verification.</Text>
          <Text style={styles.body}><Text style={styles.unavailable}>● Unavailable</Text>{'  '}The point should not currently be used.</Text>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Important limitation</Text>
          <Text style={styles.noticeText}>RouteAble version 1 does not calculate or guarantee a wheelchair-accessible route. Marker positions and accessibility conditions should be verified on site before public use.</Text>
        </View>
        <Text style={styles.source}>Campus locations: KMUTNB public information and OpenStreetMap. Accessibility data: RouteAble field survey.</Text>
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background }, content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 104 },
  eyebrow: { color: COLORS.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1 }, title: { marginTop: 5, color: COLORS.text, fontSize: 24, fontWeight: '900' },
  intro: { marginTop: 10, color: COLORS.muted, fontSize: 15, lineHeight: 22 }, sectionTitle: { marginTop: 24, marginBottom: 10, color: COLORS.text, fontSize: 18, fontWeight: '900' },
  card: { paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, backgroundColor: COLORS.surface },
  legendRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }, divider: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconBox: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }, iconText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  legendCopy: { flex: 1, marginLeft: 13 }, legendTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' }, legendDetail: { marginTop: 3, color: COLORS.muted, fontSize: 13 },
  body: { marginVertical: 10, color: COLORS.muted, fontSize: 14, lineHeight: 21 }, available: { color: COLORS.success, fontWeight: '900' }, caution: { color: COLORS.warning, fontWeight: '900' }, unavailable: { color: COLORS.danger, fontWeight: '900' },
  notice: { marginTop: 24, padding: 18, borderLeftWidth: 5, borderLeftColor: COLORS.warning, borderRadius: 16, backgroundColor: '#FFF7EA' }, noticeTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' }, noticeText: { marginTop: 7, color: COLORS.muted, fontSize: 14, lineHeight: 21 },
  source: { marginTop: 18, color: COLORS.muted, fontSize: 12, lineHeight: 18 },
});
