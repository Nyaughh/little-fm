const fs = require('node:fs/promises');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');

const minimums = { friendlistening: { width: 150, height: 140 }, listeningcircle: { width: 210, height: 140 } };

function withMinimums(xml, { width, height }) {
  return xml.replace(/\s+android:minResize(?:Width|Height)="[^"]*"/g, '')
    .replace('<appwidget-provider ', `<appwidget-provider android:minResizeWidth="${width}dp" android:minResizeHeight="${height}dp" `);
}

// Register before react-native-android-widget: Expo runs dangerous mods in
// reverse order, so these attributes are applied after it generates the XML.
module.exports = config => withDangerousMod(config, ['android', async mod => {
  for (const [name, minimum] of Object.entries(minimums)) {
    const file = path.join(mod.modRequest.platformProjectRoot, `app/src/main/res/xml/widgetprovider_${name}.xml`);
    await fs.writeFile(file, withMinimums(await fs.readFile(file, 'utf8'), minimum));
  }
  return mod;
}]);
module.exports.withMinimums = withMinimums;
module.exports.minimums = minimums;
