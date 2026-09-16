module.exports = ({ config }) => {
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY || '';
  const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY || '';
  const plugins = (config.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === 'react-native-maps') {
      return [
        'react-native-maps',
        {
          ...plugin[1],
          androidGoogleMapsApiKey,
          iosGoogleMapsApiKey,
        },
      ];
    }
    return plugin;
  });

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: androidGoogleMapsApiKey },
      },
    },
    plugins,
  };
};
