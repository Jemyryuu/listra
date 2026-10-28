export interface CurrentTrackInfo {
  uri: string;
  title: string;
  artist: string;
  albumArtUrl: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
}

export class PlayerAdapter {
  public static getCurrentTrack(): CurrentTrackInfo | null {
    const data = Spicetify.Player.data;
    if (!data?.item) return null;

    const item = data.item;
    const meta = item.metadata || {};

    let albumArt = meta.image_xlarge_url || meta.image_large_url || meta.image_url || '';
    if (albumArt.startsWith('spotify:image:')) {
      albumArt = `https://i.scdn.co/image/${albumArt.slice(14)}`;
    }

    return {
      uri: item.uri,
      title: item.name || meta.title || 'Unknown Title',
      artist: (item.artists && item.artists[0]?.name) || meta.artist_name || 'Unknown Artist',
      albumArtUrl: albumArt,
      durationMs: data.duration || 0,
      progressMs: Spicetify.Player.getProgress(),
      isPlaying: Spicetify.Player.isPlaying(),
    };
  }

  public static isPlaying(): boolean {
    return Spicetify.Player.isPlaying();
  }

  public static getProgressMs(): number {
    return Spicetify.Player.getProgress();
  }

  public static async play(): Promise<void> {
    if (!Spicetify.Player.isPlaying()) {
      await Spicetify.Player.play();
    }
  }

  public static async pause(): Promise<void> {
    if (Spicetify.Player.isPlaying()) {
      await Spicetify.Player.pause();
    }
  }

  public static seek(positionMs: number): void {
    Spicetify.Player.seek(positionMs);
  }

  public static async playUri(uri: string): Promise<void> {
    await Spicetify.Player.playUri(uri);
  }

  public static async prefetchNext(uri: string): Promise<void> {
    try {
      if (Spicetify.Platform?.PlayerAPI?.addToQueue) {
        await Spicetify.Platform.PlayerAPI.addToQueue([{ uri }]);
      }
    } catch (err) {
      console.warn('[Listra] Failed to prefetch track into queue:', err);
    }
  }

  public static onSongChange(callback: () => void): void {
    Spicetify.Player.addEventListener('songchange', callback);
  }

  public static onPlayPause(callback: () => void): void {
    Spicetify.Player.addEventListener('onplaypause', callback);
  }

  public static removeEventListener(event: 'songchange' | 'onplaypause', callback: () => void): void {
    try {
      Spicetify.Player.removeEventListener(event, callback);
    } catch (e) {}
  }
}
