import { registerWidgets } from './widgets/bridge';
registerWidgets();
// Preserve Expo Router's normal application registration.
require('expo-router/entry');
