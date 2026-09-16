# RouteAble

RouteAble is an Expo and React Native map application for presenting accessibility facilities and mobility barriers on a university campus.

## Project status

The current version is the renamed map scaffold. Planned RouteAble features include:

- Current user location
- Accessibility markers such as ramps, elevators, stairs, and rough surfaces
- Firebase Realtime Database integration
- Distance calculation and nearby-point filtering
- External navigation through Google Maps

## Requirements

- Node.js 22.13 or newer
- Expo-compatible Android device or emulator
- A Google Maps API key restricted to the Android package `com.em.routeable`

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Add a restricted Google Maps API key to the `react-native-maps` plugin configuration in `app.json`.

3. Start the development server:

   ```bash
   npx expo start
   ```

## Project origin

This independent student project was initialized from a map example supplied for coursework with the instructor's permission. The implementation will be extended and redesigned for the RouteAble project.

## License

See `LICENSE` for the license notice included with the original Expo scaffold.
