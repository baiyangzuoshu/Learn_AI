import { BundleName, MusicID } from '../../Scripts/Constant';
import { util } from '../Utils/util';
import { ResManager } from './ResManager';

export class SoundManager extends cc.Component {
    public static Instance: SoundManager;

    public static MAX_SOUNDS = 8;

    // 注: LocalStrorage,多个h5 游戏都共用一个,
    private static MusicMuteKey = "MusicMute";
    private static SoundMuteKey = "SoundMute";
    private static ShakeMuteKey = "ShakeMute";
    private static VolumeMusic = "VolumeMusic";
    private static VolumeSound = "VolumeSound";
    //private static SoundsBundleName = "Music";
    //private static MusicBundleName = "Music";

    private isMusicMute = true;
    private isSoundMute = true;
    private isShakeMute = false;

    private volumeMusic = 0;
    private volumeSound = 0;

    private curMusicAudioClip!: cc.AudioClip;
    private musicID = 0;

    protected onLoad(): void {
        SoundManager.Instance = this;

        this.Init();
    }

    public Init(): void {
        this.isMusicMute = true;
        this.isSoundMute = true;
        this.isShakeMute = true;

        this.volumeMusic = 0.1;
        this.volumeSound = 0.5;

        // 从localStroage读取配置
        let value: string = localStorage.getItem(SoundManager.MusicMuteKey) as string;
        if (value != null) {
            this.isMusicMute = (value == "true") ? true : false;
        }

        value = localStorage.getItem(SoundManager.SoundMuteKey) as string;
        if (value != null) {
            this.isSoundMute = (value == "true") ? true : false;
        }

        value = localStorage.getItem(SoundManager.ShakeMuteKey) as string;
        if (value != null) {
            this.isShakeMute = (value == "true") ? true : false;
        }

        value = localStorage.getItem(SoundManager.VolumeSound) as string;
        if (value !== null) {
            // this.volumeSound = parseFloat(value);
            // this.volumeSound = (this.volumeSound < 0)? 0 : this.volumeSound;
            // this.volumeSound = (this.volumeSound > 1)? 1 : this.volumeSound;
        }
        value = localStorage.getItem(SoundManager.VolumeMusic) as string;
        if (value !== null) {
            // this.volumeMusic = parseFloat(value);
            // this.volumeMusic = (this.volumeMusic < 0)? 0 : this.volumeMusic;
            // this.volumeMusic = (this.volumeMusic > 1)? 1 : this.volumeMusic;
        }
        // end
    }

    public StopMainMusic(): void {
        cc.audioEngine.stop(this.musicID);
    }

    public ResumeMainMusic(): void {
        cc.audioEngine.stop(this.musicID);
    }

    public StopEffect(id: number) {
        cc.audioEngine.stopEffect(id);
    }

    public async PlayMusic(assetPath: string, isLoop = true) {
        const clip = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, assetPath, cc.AudioClip) as cc.AudioClip;
        if (clip === null) {
            console.error("PlayMusic clip === null", assetPath);
            return;
        }

        this.curMusicAudioClip = clip as cc.AudioClip;

        if (!this.isMusicMute) {
            return;
        }

        this.musicID = cc.audioEngine.playMusic(clip, isLoop);
        // cc.audioEngine.setFinishCallback(this.musicID, () => {
        //     const paths = ["Music/easy", "Music/hard", "Music/main", "Music/normal"];
        //     const name = paths[Math.floor(Math.random() * paths.length)]
        //     util.Log("PlayMusic finish", name);
        //     this.PlayMusic(name)
        // });
    }

    public ResumeMusic() {
        this.scheduleOnce(() => {
            cc.audioEngine.setMusicVolume(1);
            cc.audioEngine.setEffectsVolume(1);
            cc.audioEngine.resumeMusic();
            this.PlayMusic(MusicID.main);
        }, 0.2)
    }

    public async PlaySound(id: string, isLoop = false) {
        if (!this.isSoundMute) {
            return -1;
        }

        const clip = await ResManager.Instance.IE_GetAsset(BundleName.BundleMain, "Sound/" + id, cc.AudioClip) as cc.AudioClip;
        if (clip === null) {
            console.error("clip === null", id);
            return -1;
        }

        const audioID = cc.audioEngine.playEffect(clip, isLoop);

        return audioID;
    }

    // get, set
    public SetMusicVolume(volume: number): void {
        this.volumeMusic = util.clamp(volume, 0, 1);

        localStorage.setItem(SoundManager.VolumeMusic, this.volumeMusic.toString());
    }


    public SetSoundVolume(volume: number): void {
        this.volumeSound = util.clamp(volume, 0, 1);

        localStorage.setItem(SoundManager.VolumeSound, this.volumeSound.toString());
    }

    public SetMusicMute(isMute: boolean): void {
        util.Log("SetMusicMute=", this.musicID, isMute);
        this.isMusicMute = isMute;
        if (!this.isMusicMute) {
            cc.audioEngine.stop(this.musicID);
        }
        else {
            if (this.curMusicAudioClip) {
                this.musicID = cc.audioEngine.playMusic(this.curMusicAudioClip, true)
            }
        }

        localStorage.setItem(SoundManager.MusicMuteKey, this.isMusicMute.toString());
    }

    public SetShakeMute(isMute: boolean): void {

        this.isShakeMute = isMute;

        localStorage.setItem(SoundManager.ShakeMuteKey, this.isShakeMute.toString());
    }

    public GetMusicMute(): boolean {
        return this.isMusicMute;
    }

    public GetShakeMute(): boolean {
        return this.isShakeMute;
    }

    public SetSoundMute(isMute: boolean): void {

        this.isSoundMute = isMute;

        localStorage.setItem(SoundManager.SoundMuteKey, this.isSoundMute.toString());
    }

    public GetSoundMute(): boolean {
        return this.isSoundMute;
    }
}
