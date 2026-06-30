
import { util } from "../Utils/util";

interface PlayingSound {
    source: AudioBufferSourceNode;
    gainNode: GainNode;
    startTime: number;
    pausedAt: number;
    url: string;
    volume: number;
    loop: boolean;
}

export default class WebAudioManager {
    private static instance: WebAudioManager;
    private audioContext: AudioContext;
    private buffers: Map<string, AudioBuffer>;
    private isContextSuspended: boolean;
    private playingSounds: Set<PlayingSound>;
    private backgroundMusic: PlayingSound | null;
    private backgroundMusicUrl: string | null;
    private backgroundMusicPausedAt: number;

    private constructor() {
        //this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.audioContext = new window.AudioContext();
        this.buffers = new Map();
        this.isContextSuspended = false;
        this.playingSounds = new Set();
        this.backgroundMusic = null;
        this.backgroundMusicUrl = null;
        this.backgroundMusicPausedAt = 0;

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

        // 用户首次交互时恢复 AudioContext
        window.addEventListener('click', this.resumeAudioContext.bind(this), { once: true });
        window.addEventListener('touchstart', this.resumeAudioContext.bind(this), { once: true });
    }

    public static getInstance(): WebAudioManager {
        if (!WebAudioManager.instance) {
            WebAudioManager.instance = new WebAudioManager();
        }
        return WebAudioManager.instance;
    }

    private handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.resumeAudioContext();
        } else {
            this.suspendAudioContext();
        }
    }

    private async resumeAudioContext() {
        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                this.isContextSuspended = false;
                util.Log('AudioContext resumed');
            } catch (e) {
                console.error('Failed to resume AudioContext', e);
            }
        }
    }

    private suspendAudioContext() {
        if (this.audioContext.state === 'running') {
            this.audioContext.suspend();
            this.isContextSuspended = true;
            util.Log('AudioContext suspended', this.isContextSuspended);
        }
    }

    public async loadAudio(url: string): Promise<void> {
        if (this.buffers.has(url)) {
            return;
        }

        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.buffers.set(url, audioBuffer);
            util.Log(`Loaded audio: ${url}`);
        } catch (error) {
            console.error(`Failed to load audio: ${url}`, error);
        }
    }

    public async playSound(url: string, volume = 1.0, loop = false): Promise<void> {
        if (this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                util.Log('AudioContext resumed on playSound');
            } catch (e) {
                console.error('Failed to resume AudioContext on playSound', e);
                return;
            }
        }

        const buffer = this.buffers.get(url);
        if (!buffer) {
            console.warn(`Audio buffer not found for URL: ${url}`);
            return;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = buffer;
        source.loop = loop;

        gainNode.gain.value = volume;

        source.connect(gainNode).connect(this.audioContext.destination);
        source.start(0);

        const playingSound: PlayingSound = {
            source,
            gainNode,
            startTime: this.audioContext.currentTime,
            pausedAt: 0,
            url,
            volume,
            loop,
        };

        this.playingSounds.add(playingSound);

        // 当音效结束时，从集合中移除
        source.onended = () => {
            this.playingSounds.delete(playingSound);
        };
    }

    // 背景音乐相关的方法
    public async playBackgroundMusic(url: string, volume = 1.0, loop = true): Promise<void> {
        if (this.backgroundMusic) {
            this.stopBackgroundMusic();
        }

        await this.loadAudio(url);

        const buffer = this.buffers.get(url);
        if (!buffer) {
            console.warn(`Audio buffer not found for URL: ${url}`);
            return;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = buffer;
        source.loop = loop;

        gainNode.gain.value = volume;

        source.connect(gainNode).connect(this.audioContext.destination);
        source.start(0);

        this.backgroundMusic = {
            source,
            gainNode,
            startTime: this.audioContext.currentTime,
            pausedAt: 0,
            url,
            volume,
            loop,
        };
        this.backgroundMusicUrl = url;

        source.onended = () => {
            this.backgroundMusic = null;
            this.backgroundMusicUrl = null;
        };
    }

    public pauseBackgroundMusic(): void {
        if (this.backgroundMusic) {
            const { source, startTime, pausedAt, url, volume, loop } = this.backgroundMusic;
            util.Log(source, startTime, pausedAt, url, volume, loop);
            // 计算已播放时间
            const elapsed = this.audioContext.currentTime - startTime;
            this.backgroundMusicPausedAt += elapsed;

            // 停止当前播放
            source.stop();
            this.backgroundMusic = null;
        }
    }

    public async resumeBackgroundMusic(): Promise<void> {
        if (this.backgroundMusicUrl && this.backgroundMusicPausedAt > 0) {
            const buffer = this.buffers.get(this.backgroundMusicUrl);
            if (!buffer) {
                console.warn(`Audio buffer not found for URL: ${this.backgroundMusicUrl}`);
                return;
            }

            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();

            source.buffer = buffer;
            source.loop = true;

            gainNode.gain.value = 1.0; // 或者存储并使用之前的音量

            source.connect(gainNode).connect(this.audioContext.destination);
            source.start(0, this.backgroundMusicPausedAt % buffer.duration);

            this.backgroundMusic = {
                source,
                gainNode,
                startTime: this.audioContext.currentTime - this.backgroundMusicPausedAt,
                pausedAt: this.backgroundMusicPausedAt,
                url: this.backgroundMusicUrl,
                volume: 1.0,
                loop: true,
            };

            source.onended = () => {
                this.backgroundMusic = null;
                this.backgroundMusicUrl = null;
            };
        }
    }

    public stopBackgroundMusic(): void {
        if (this.backgroundMusic) {
            this.backgroundMusic.source.stop();
            this.backgroundMusic = null;
            this.backgroundMusicUrl = null;
            this.backgroundMusicPausedAt = 0;
        }
    }

    public pauseAllSounds(): void {
        // 暂停所有正在播放的音效
        this.playingSounds.forEach((playingSound) => {
            playingSound.source.stop();
            const elapsed = this.audioContext.currentTime - playingSound.startTime;
            playingSound.pausedAt += elapsed;
            this.playingSounds.delete(playingSound);
            // 可以选择记录 pausedAt 以便恢复播放
        });

        // 暂停背景音乐
        this.pauseBackgroundMusic();
    }

    public async resumeAllSounds(): Promise<void> {
        // 恢复所有被暂停的音效（需要记录 pausedAt）
        // 此处仅演示恢复背景音乐
        await this.resumeBackgroundMusic();
    }

    public stopAllSounds(): void {
        // 停止所有音效
        this.playingSounds.forEach((playingSound) => {
            playingSound.source.stop();
            this.playingSounds.delete(playingSound);
        });

        // 停止背景音乐
        this.stopBackgroundMusic();
    }

    public onShowMusic() {
        this.audioContext.close();
        //this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.isContextSuspended = false;
        this.playingSounds = new Set();
        this.backgroundMusic = null;
        this.backgroundMusicUrl = null;
        this.backgroundMusicPausedAt = 0;
    }

    public preloadAllAudio() {
        this.loadAudio('https://mow2.yolinet.cn/carSound/game.mp3');
        this.loadAudio('https://mow2.yolinet.cn/carSound/1.mp3');
        this.loadAudio('https://mow2.yolinet.cn/carSound/2.mp3');
        this.loadAudio('https://mow2.yolinet.cn/carSound/3.mp3');
        this.loadAudio('https://mow2.yolinet.cn/carSound/4.mp3');
        this.loadAudio('https://mow2.yolinet.cn/carSound/5.mp3');
        this.loadAudio('https://mow2.yolinet.cn/carSound/6.mp3');
        this.loadAudio('https://mow2.yolinet.cn/carSound/7.mp3');
        this.loadAudio('https://mow2.yolinet.cn/carSound/8.mp3');
        this.loadAudio('https://mow2.yolinet.cn/carSound/9.mp3');
    }
}


