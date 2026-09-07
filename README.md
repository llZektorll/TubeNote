# TubeNote

Adds a compact YouTube livestream controller above the vault name in
Obsidian's sidebar, so you can listen to (or watch) a YouTube livestream
without leaving your notes.

## Features

- A small play/pause control and volume slider docked above the file
  explorer's nav header.
- Configure the livestream URL and default volume from the plugin settings.
- The player persists across layout changes and reloads with your last
  saved settings.

## Usage

1. Open **Settings → TubeNote** and paste the URL of the YouTube livestream
   (or any YouTube video) you want to control, e.g.
   `https://www.youtube.com/watch?v=VIDEO_ID`.
2. Set your preferred default volume.
3. Use the play/pause button and volume slider docked at the top of the
   sidebar to control playback.

## Network use

This plugin loads the official YouTube IFrame Player API
(`https://www.youtube.com/iframe_api`) from YouTube's servers, and embeds
a YouTube video player for the livestream URL you provide. No other
external service is contacted, and no data is sent anywhere by the plugin
itself beyond what YouTube's own player requires to stream video/audio.

## Installation

### From Obsidian (once published)

1. Open **Settings → Community plugins → Browse**.
2. Search for "TubeNote" and select **Install**.
3. Enable the plugin.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the
   [latest release](../../releases/latest).
2. Copy them into `<your-vault>/.obsidian/plugins/tubenote/`.
3. Reload Obsidian and enable **TubeNote** under Community plugins.

## Support

Found a bug or have a feature request? Please open an issue in this
repository.

## License

Released under the [MIT License](./LICENSE).
