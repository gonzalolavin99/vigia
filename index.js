/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import ResponseScreen from './src/ui/ResponseScreen';
// Arranca el orquestador al cargar el bundle, también sin pantalla (servicio tras reinicio).
import './src/orchestrator/runtime';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('VigiaResponse', () => ResponseScreen);
