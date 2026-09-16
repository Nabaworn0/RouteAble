import { useEffect, useState } from 'react';
import { type Href, useRouter } from 'expo-router';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

const PURPLE = '#176B87';

export default function RouteAbleWelcomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const compact = width < 520 || height < 760;
  const [reduceMotion, setReduceMotion] = useState(true);
  const [imageEntrance] = useState(() => new Animated.Value(0));
  const [buttonPulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    imageEntrance.stopAnimation();
    if (reduceMotion) {
      imageEntrance.setValue(1);
      return;
    }

    imageEntrance.setValue(0);
    const entrance = Animated.timing(imageEntrance, {
      toValue: 1,
      duration: 720,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    entrance.start();
    return () => entrance.stop();
  }, [imageEntrance, reduceMotion]);

  useEffect(() => {
    buttonPulse.stopAnimation();
    buttonPulse.setValue(0);
    if (reduceMotion) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.delay(850),
        Animated.timing(buttonPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(buttonPulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [buttonPulse, reduceMotion]);

  return (
    <View style={[styles.previewArea, compact && styles.previewAreaCompact]}>
      <View style={[styles.phoneScreen, compact && styles.phoneScreenCompact]}>
        <View style={styles.illustrationArea}>
          <Animated.Image
            accessibilityLabel="A student using a wheelchair follows an accessible route to a university building ramp"
            resizeMode="contain"
            source={require('../../assets/images/routeable-welcome-v2.png')}
            style={[
              styles.heroImage,
              {
                opacity: imageEntrance,
                transform: [
                  {
                    translateY: imageEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>

        <View style={styles.copyArea}>
          <Text style={styles.eyebrow}>WELCOME TO ROUTEABLE</Text>
          <Text style={styles.heading}>Move freely.{`\n`}Plan confidently.</Text>
          <Text style={styles.description}>
            RouteAble helps you find accessible campus routes, ramps, elevators, and potential barriers before you travel.
          </Text>
        </View>

        <View style={styles.bottomArea}>
          <View style={styles.decorativeLeaves} accessibilityElementsHidden>
            <View style={[styles.leaf, styles.leafPurple]} />
            <View style={[styles.leaf, styles.leafBlue]} />
            <View style={[styles.leaf, styles.leafOrange]} />
          </View>

          <Text style={styles.progressText}>EXPLORE KMUTNB</Text>

          <Animated.View
            style={[
              styles.startButtonPosition,
              {
                transform: [
                  {
                    scale: buttonPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.035],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable
              accessibilityHint="Opens the accessible KMUTNB map and requests your location"
              accessibilityLabel="Start using RouteAble"
              accessibilityRole="button"
              onPress={() => router.push('/map' as Href)}
              style={({ pressed }) => [
                styles.startButton,
                pressed && styles.startButtonPressed,
              ]}
            >
              <Text style={styles.startButtonText}>START</Text>
              <Text style={styles.startArrow}>→</Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  previewArea: {
    flex: 1,
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#E9E9ED',
  },
  previewAreaCompact: { padding: 0 },
  phoneScreen: {
    width: '100%',
    maxWidth: 390,
    height: 760,
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 30,
    backgroundColor: '#FDFDFE',
    shadowColor: '#2B2942',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
  },
  phoneScreenCompact: {
    maxWidth: 430,
    height: '100%',
    minHeight: 680,
    borderRadius: 0,
  },
  illustrationArea: {
    height: '61%',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F7F8FC',
  },
  heroImage: {
    position: 'absolute',
    top: -74,
    left: '-13%',
    width: '126%',
    height: '126%',
  },
  copyArea: {
    position: 'absolute',
    left: 30,
    right: 30,
    bottom: 112,
  },
  heading: {
    marginTop: 7,
    color: '#292737',
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  eyebrow: {
    color: PURPLE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.15,
  },
  description: {
    maxWidth: 315,
    marginTop: 14,
    color: '#85818E',
    fontSize: 12.5,
    lineHeight: 19.5,
  },
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  decorativeLeaves: {
    position: 'absolute',
    left: -7,
    bottom: -4,
    width: 62,
    height: 72,
  },
  leaf: { position: 'absolute', bottom: 0, width: 17, height: 55, borderRadius: 18 },
  leafPurple: { left: 12, backgroundColor: '#176B87', transform: [{ rotate: '-25deg' }] },
  leafBlue: { left: 28, bottom: -7, height: 61, backgroundColor: '#64CCC5', transform: [{ rotate: '18deg' }] },
  leafOrange: { left: 43, bottom: -11, height: 43, backgroundColor: '#FF9A66', transform: [{ rotate: '38deg' }] },
  progressText: {
    position: 'absolute',
    right: 105,
    bottom: 39,
    color: '#A09CAC',
    fontSize: 10,
    fontWeight: '700',
  },
  startButtonPosition: {
    position: 'absolute',
    right: 22,
    bottom: 20,
    width: 68,
    height: 68,
  },
  startButton: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
    backgroundColor: PURPLE,
    shadowColor: '#3C278C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 13,
  },
  startButtonPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  startButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  startArrow: { marginTop: 1, color: '#FFFFFF', fontSize: 15, lineHeight: 16, fontWeight: '700' },
});
