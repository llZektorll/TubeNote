import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    Notice
} from "obsidian";

interface YouTubeLiveSettings {
    youtubeUrl: string;
    volume: number;
}

const DEFAULT_SETTINGS: YouTubeLiveSettings = {
    youtubeUrl: "https://www.youtube.com/watch?v=5yx6BWlEVcY",
    volume: 50
};

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

export default class TubeNotePlugin extends Plugin {

    settings: YouTubeLiveSettings;
    player: any = null;

    private container: HTMLElement | null = null;
    private playerContainer: HTMLElement | null = null;
    private playButton: HTMLButtonElement | null = null;
    private volumeSlider: HTMLInputElement | null = null;
    private statusEl: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();

        await this.loadYouTubeAPI();

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

        if (this.player) {
            try {
                this.player.destroy();
            } catch (_) {}
        }
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private async loadYouTubeAPI(): Promise<void> {
        if (window.YT?.Player) {
            return;
        }

        await new Promise<void>((resolve) => {

            const existing = document.querySelector(
                'script[src="https://www.youtube.com/iframe_api"]'
            );

            if (existing) {
                const check = setInterval(() => {
                    if (window.YT?.Player) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);

                return;
            }

            const script = document.createElement("script");

            script.src =
                "https://www.youtube.com/iframe_api";

            document.head.appendChild(script);

            const previous =
                window.onYouTubeIframeAPIReady;

            window.onYouTubeIframeAPIReady = () => {
                previous?.();
                resolve();
            };
        });
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
                document.createElement("div"),
                navHeader
            ) ?? null;

        if (!this.container) {
            return;
        }

        this.container.addClass(
            "youtube-live-controller"
        );

        const controls =
            this.container.createDiv(
                "youtube-live-controls"
            );

        // Play / Pause
        this.playButton =
            controls.createEl("button", {
                cls: "youtube-live-play",
                text: "▶"
            });

        this.playButton.setAttribute(
            "aria-label",
            "Play livestream"
        );

        this.playButton.addEventListener(
            "click",
            () => this.togglePlayback()
        );

        // Status
        this.statusEl =
            controls.createDiv(
                "youtube-live-status"
            );

        this.statusEl.setText("YouTube Live");

        // Volume icon
        const volumeIcon =
            controls.createSpan({
                cls: "youtube-live-volume-icon",
                text: "🔊"
            });

        // Volume
        this.volumeSlider =
            controls.createEl("input", {
                cls: "youtube-live-volume",
                attr: {
                    type: "range",
                    min: "0",
                    max: "100",
                    value: String(this.settings.volume)
                }
            });

        this.volumeSlider.addEventListener(
            "input",
            () => {
                const volume =
                    Number(this.volumeSlider?.value ?? 50);

                this.settings.volume = volume;

                if (this.player) {
                    this.player.setVolume(volume);
                }

                this.saveSettings();
            }
        );

        // Hidden player
        this.playerContainer =
            this.container.createDiv(
                "youtube-live-player"
            );

        this.createPlayer();
    }

    private ensureController() {
        if (
            !document.querySelector(
                ".youtube-live-controller"
            )
        ) {
            this.container = null;
            this.createController();
        }
    }

    private createPlayer() {

        if (!this.playerContainer) {
            return;
        }

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

        this.player =
            new window.YT.Player(
                this.playerContainer,
                {
                    videoId,

                    playerVars: {
                        autoplay: 0,
                        controls: 0,
                        modestbranding: 1,
                        rel: 0,
                        playsinline: 1
                    },

                    events: {
                        onReady: (event: any) => {
                            event.target.setVolume(
                                this.settings.volume
                            );

                            this.statusEl?.setText(
                                "YouTube Live"
                            );
                        },

                        onStateChange: (event: any) => {

                            if (
                                event.data ===
                                window.YT.PlayerState.PLAYING
                            ) {
                                this.updatePlayButton(true);

                                this.statusEl?.setText(
                                    "Live"
                                );
                            }

                            if (
                                event.data ===
                                window.YT.PlayerState.PAUSED
                            ) {
                                this.updatePlayButton(false);

                                this.statusEl?.setText(
                                    "Paused"
                                );
                            }

                            if (
                                event.data ===
                                window.YT.PlayerState.ENDED
                            ) {
                                this.updatePlayButton(false);
                            }
                        }
                    }
                }
            );
    }

    private togglePlayback() {

        if (!this.player) {
            new Notice(
                "YouTube player is not ready."
            );
            return;
        }

        const state =
            this.player.getPlayerState();

        if (
            state ===
            window.YT.PlayerState.PLAYING
        ) {
            this.player.pauseVideo();
        } else {
            this.player.playVideo();
        }
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

        } catch (_) {}

        return null;
    }

    async updateYouTubeUrl() {

        if (this.player) {
            try {
                this.player.destroy();
            } catch (_) {}
        }

        this.player = null;

        if (this.playerContainer) {
            this.playerContainer.empty();
        }

        this.createPlayer();
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
                        "https://www.youtube.com/watch?v=..."
                    )
                    .setValue(
                        this.plugin.settings.youtubeUrl
                    );

                text.onChange(
                    async (value) => {

                        this.plugin.settings.youtubeUrl =
                            value;

                        await this.plugin.saveSettings();

                        await this.plugin
                            .updateYouTubeUrl();
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
                    .setDynamicTooltip()

                    .onChange(
                        async (value) => {

                            this.plugin.settings.volume =
                                value;

                            await this.plugin
                                .saveSettings();

                            if (
                                this.plugin.player
                            ) {
                                this.plugin.player
                                    .setVolume(value);
                            }
                        }
                    );
            });
    }
}
