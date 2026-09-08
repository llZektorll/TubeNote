import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    Notice
} from "obsidian";

import type { SettingDefinitionItem } from "obsidian";

interface TubeNoteSettings {
    youtubeUrl: string;
    volume: number;
}

const DEFAULT_SETTINGS: TubeNoteSettings = {
    youtubeUrl: "https://www.youtube.com/watch?v=5yx6BWlEVcY",
    volume: 50
};

export default class TubeNotePlugin extends Plugin {

    settings: TubeNoteSettings;

    private container: HTMLElement | null = null;
    private playerFrame: HTMLIFrameElement | null = null;
    private playButton: HTMLButtonElement | null = null;
    private volumeSlider: HTMLInputElement | null = null;
    private statusEl: HTMLElement | null = null;
    private isPlaying = false;

    async onload() {
        await this.loadSettings();

        this.addSettingTab(
            new TubeNoteSettingTab(this.app, this)
        );

        this.app.workspace.onLayoutReady(() => {
            this.createController();
        });

        this.registerEvent(
            this.app.workspace.on("layout-change", () => {
                this.ensureController();
            })
        );
    }

    onunload() {
        this.container?.remove();
        this.container = null;
        this.playerFrame = null;
    }

    async loadSettings() {
        const savedData =
            (await this.loadData()) as
                Partial<TubeNoteSettings> | null;

        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            savedData
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private createController() {

        if (this.container) {
            return;
        }

        const navHeader =
            document.querySelector(".nav-header");

        if (!navHeader) {
            return;
        }

        this.container =
            navHeader.parentElement?.insertBefore(
                createDiv({ cls: "tubenote-controller" }),
                navHeader
            ) ?? null;

        if (!this.container) {
            return;
        }

        const controls =
            this.container.createDiv(
                { cls: "tubenote-controls" }
            );

        // Play / Pause
        this.playButton =
            controls.createEl("button", {
                cls: "tubenote-play",
                text: "▶"
            });

        this.playButton.setAttribute(
            "aria-label",
            "Play livestream"
        );

        this.registerDomEvent(
            this.playButton,
            "click",
            () => this.togglePlayback()
        );

        // Status
        this.statusEl =
            controls.createDiv(
                { cls: "tubenote-status" }
            );

        this.statusEl.setText("Ready");

        // Volume icon
        controls.createSpan({
            cls: "tubenote-volume-icon",
            text: "🔊"
        });

        // Volume
        this.volumeSlider =
            controls.createEl("input", {
                cls: "tubenote-volume",
                attr: {
                    type: "range",
                    min: "0",
                    max: "100",
                    value: String(this.settings.volume)
                }
            });

        this.registerDomEvent(
            this.volumeSlider,
            "input",
            () => {
                const volume =
                    Number(this.volumeSlider?.value ?? 50);

                this.settings.volume = volume;
                this.setPlayerVolume(volume);

                void this.saveSettings();
            }
        );

        // Player
        const playerContainer =
            this.container.createDiv(
                { cls: "tubenote-player" }
            );

        this.createPlayer(playerContainer);
    }

    private ensureController() {
        if (
            !document.querySelector(
                ".tubenote-controller"
            )
        ) {
            this.container = null;
            this.createController();
        }
    }

    private createPlayer(playerContainer: HTMLElement) {

        const videoId =
            this.extractVideoId(
                this.settings.youtubeUrl
            );

        if (!videoId) {
            this.statusEl?.setText(
                "Invalid YouTube URL"
            );
            return;
        }

        playerContainer.empty();

        // Embeds YouTube's own player iframe directly. Playback is
        // controlled via postMessage to the embed (YouTube's documented
        // "Listening" postMessage protocol), so no external script is
        // ever injected by this plugin.
        this.playerFrame =
            playerContainer.createEl("iframe", {
                attr: {
                    src:
                        `https://www.youtube.com/embed/${videoId}` +
                        "?enablejsapi=1&autoplay=0&controls=0" +
                        "&modestbranding=1&rel=0&playsinline=1",
                    allow: "encrypted-media",
                    frameborder: "0"
                }
            });

        this.isPlaying = false;
        this.updatePlayButton(false);
        this.statusEl?.setText("Ready");
    }

    private togglePlayback() {

        if (!this.playerFrame) {
            new Notice(
                "YouTube player is not ready."
            );
            return;
        }

        if (this.isPlaying) {
            this.postPlayerCommand("pauseVideo");
            this.statusEl?.setText("Paused");
        } else {
            this.postPlayerCommand("playVideo");
            this.setPlayerVolume(this.settings.volume);
            this.statusEl?.setText("Live");
        }

        this.isPlaying = !this.isPlaying;
        this.updatePlayButton(this.isPlaying);
    }

    private setPlayerVolume(volume: number) {
        this.postPlayerCommand("setVolume", [volume]);
    }

    private postPlayerCommand(
        func: string,
        args: unknown[] = []
    ) {
        this.playerFrame?.contentWindow?.postMessage(
            JSON.stringify({ event: "command", func, args }),
            "https://www.youtube.com"
        );
    }

    private updatePlayButton(playing: boolean) {

        if (!this.playButton) {
            return;
        }

        this.playButton.setText(
            playing ? "⏸" : "▶"
        );

        this.playButton.setAttribute(
            "aria-label",
            playing
                ? "Pause livestream"
                : "Play livestream"
        );
    }

    private extractVideoId(url: string): string | null {

        try {

            const parsed =
                new URL(url);

            if (
                parsed.hostname.includes(
                    "youtube.com"
                )
            ) {
                return parsed.searchParams.get(
                    "v"
                );
            }

            if (
                parsed.hostname ===
                "youtu.be"
            ) {
                return parsed.pathname.substring(1);
            }

        } catch {
            // Not a valid URL: fall through and report it upstream.
        }

        return null;
    }

    updateYouTubeUrl() {

        const playerContainer =
            this.container?.querySelector<HTMLElement>(
                ".tubenote-player"
            );

        if (playerContainer) {
            this.createPlayer(playerContainer);
        }
    }
}

class TubeNoteSettingTab
    extends PluginSettingTab {

    plugin: TubeNotePlugin;

    constructor(
        app: App,
        plugin: TubeNotePlugin
    ) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            {
                name: "YouTube livestream URL",
                desc: "Enter the URL of the YouTube livestream.",
                control: {
                    type: "text",
                    key: "youtubeUrl",
                    placeholder:
                        "Paste a YouTube livestream link",
                    defaultValue:
                        DEFAULT_SETTINGS.youtubeUrl
                }
            },
            {
                name: "Default volume",
                desc: "Volume used when the livestream starts.",
                control: {
                    type: "slider",
                    key: "volume",
                    min: 0,
                    max: 100,
                    step: 1,
                    defaultValue:
                        DEFAULT_SETTINGS.volume
                }
            }
        ];
    }

    getControlValue(key: string): unknown {
        if (key === "youtubeUrl") {
            return this.plugin.settings.youtubeUrl;
        }

        if (key === "volume") {
            return this.plugin.settings.volume;
        }

        return undefined;
    }

    setControlValue(
        key: string,
        value: unknown
    ): void | Promise<void> {

        if (key === "youtubeUrl") {
            this.plugin.settings.youtubeUrl =
                String(value);

            return this.plugin.saveSettings().then(() => {
                this.plugin.updateYouTubeUrl();
            });
        }

        if (key === "volume") {
            const volume = Number(value);

            this.plugin.settings.volume = volume;

            return this.plugin.saveSettings();
        }
    }

    // Fallback for Obsidian versions older than 1.13.0, which don't know
    // about getSettingDefinitions() and render imperatively instead.
    display(): void {

        const { containerEl } =
            this;

        containerEl.empty();

        new Setting(containerEl)
            .setName(
                "YouTube livestream URL"
            )
            .setDesc(
                "Enter the URL of the YouTube livestream."
            )
            .addText(text => {

                text
                    .setPlaceholder(
                        "Paste a YouTube livestream link"
                    )
                    .setValue(
                        this.plugin.settings.youtubeUrl
                    );

                text.onChange(
                    async (value) => {

                        this.plugin.settings.youtubeUrl =
                            value;

                        await this.plugin.saveSettings();

                        this.plugin.updateYouTubeUrl();
                    }
                );
            });

        new Setting(containerEl)
            .setName("Default volume")
            .setDesc(
                "Volume used when the livestream starts."
            )
            .addSlider(slider => {

                slider
                    .setLimits(
                        0,
                        100,
                        1
                    )
                    .setValue(
                        this.plugin.settings.volume
                    )
                    .onChange(
                        async (value) => {

                            this.plugin.settings.volume =
                                value;

                            await this.plugin.saveSettings();
                        }
                    );
            });
    }
}
