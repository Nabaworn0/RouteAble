import { type Href, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../constants/theme';

const items = [
  { route: '/map', icon: '⌖', label: 'Map' },
  { route: '/nearby', icon: '≡', label: 'Nearby' },
  { route: '/info', icon: 'i', label: 'Info' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {items.map((item) => {
        const active = pathname === item.route;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={item.route}
            onPress={() => router.replace(item.route as Href)}
            style={({ pressed }) => [styles.item, active && styles.itemActive, pressed && styles.pressed]}
          >
            <Text style={[styles.icon, active && styles.activeText]}>{item.icon}</Text>
            <Text style={[styles.label, active && styles.activeText]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', left: 16, right: 16, bottom: 12, height: 66,
    flexDirection: 'row', padding: 6, borderRadius: 20, backgroundColor: COLORS.surface,
    elevation: 10, shadowColor: '#17313A', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.16, shadowRadius: 15,
  },
  item: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  itemActive: { backgroundColor: '#E3F4F3' },
  pressed: { opacity: 0.72 },
  icon: { color: COLORS.muted, fontSize: 19, lineHeight: 20, fontWeight: '900' },
  label: { marginTop: 2, color: COLORS.muted, fontSize: 12, fontWeight: '700' },
  activeText: { color: COLORS.primary },
});
