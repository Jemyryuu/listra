declare namespace Spicetify {
  interface TrackMetadata {
    title?: string;
    artist_name?: string;
    album_title?: string;
    image_url?: string;
    image_large_url?: string;
    image_xlarge_url?: string;
    duration?: string | number;
    [key: string]: any;
  }

  interface TrackData {
    uri: string;
    uid?: string;
    name?: string;
    metadata?: TrackMetadata;
    artists?: Array<{ name: string; uri: string }>;
    album?: { name: string; uri: string; images?: Array<{ url: string }> };
    [key: string]: any;
  }

  interface PlayerState {
    item?: TrackData;
    is_paused: boolean;
    is_playing?: boolean;
    position_as_of_timestamp: number;
    timestamp: number;
    duration: number;
    [key: string]: any;
  }

  namespace Player {
    const data: PlayerState | undefined;
    function isPlaying(): boolean;
    function getProgress(): number;
    function getDuration(): number;
    function play(): Promise<void> | void;
    function pause(): Promise<void> | void;
    function seek(positionMs: number): void;
    function playUri(uri: string, context?: any): Promise<void> | void;
    function addEventListener(event: 'songchange' | 'onplaypause' | 'onprogress', callback: (event?: any) => void): void;
    function removeEventListener(event: string, callback: (event?: any) => void): void;
  }

  namespace Topbar {
    class Button {
      constructor(
        label: string,
        icon: string,
        onClick: (self: Button) => void,
        disabled?: boolean,
        isRight?: boolean
      );
      element: HTMLElement;
      active: boolean;
      disabled: boolean;
      icon: string;
      label: string;
      tippy?: any;
    }
  }

  namespace Playbar {
    class Button {
      constructor(
        label: string,
        icon: string,
        onClick: (self: Button) => void,
        registerOnCreate?: boolean,
        disabled?: boolean,
        active?: boolean
      );
      element: HTMLElement;
      active: boolean;
      disabled: boolean;
      icon: string;
      label: string;
      tippy?: any;
      register(): void;
      deregister(): void;
    }
  }

  namespace PopupModal {
    interface Content {
      title: string;
      content: string | Element;
      isLarge?: boolean;
    }
    function display(content: Content): void;
    function hide(): void;
  }

  namespace Platform {
    const PlayerAPI: {
      getQueue?: () => Promise<any>;
      addToQueue?: (tracks: Array<{ uri: string }>) => Promise<any>;
      [key: string]: any;
    };
    const UserAPI?: {
      getUser?: () => Promise<{ displayName?: string; images?: Array<{ url: string }> }>;
    };
  }

  function showNotification(text: string, isError?: boolean, timeout?: number): void;
}
