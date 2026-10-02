export {};

export interface RediadsRendererApi {
  renderOutstream: typeof import('./player').renderOutstream;
  renderBid: typeof import('./prebid').renderBid;
  createRenderer: typeof import('./prebid').createRenderer;
  createSafeRenderer: typeof import('./prebid').createSafeRenderer;
  registerSafeRenderer: typeof import('./prebid').registerSafeRenderer;
  enableOutstream: typeof import('./bootstrap').enableOutstream;
  autoInitFromScript: typeof import('./bootstrap').autoInitFromScript;
}

export interface RediAdsNativeApi {
  version: string;
  sizes: string[];
  render: (input: unknown, opts?: Record<string, unknown>) => string;
  normalize: (input: unknown, ortbArg?: unknown) => Record<string, string>;
  pick: (w: number, h: number) => [number, number];
  page: (assets: unknown, opts?: Record<string, unknown>) => string;
}

declare global {
  interface Window {
    RediadsRenderer?: RediadsRendererApi;
    /** Publisher-friendly global alias */
    rediads?: RediadsRendererApi;
    /** Prebid native rendererUrl contract (defined by rediads-native-renderer.js only). */
    renderAd?: (assets: unknown, ortb?: unknown) => string;
    RediAdsNative?: RediAdsNativeApi;
    /** Force native layout size in tests: e.g. `728x90` */
    rediadsSize?: string;
    google?: GoogleIma;
    pbRenderInFrame?: (payload: import('./types').SafeRendererPayload) => void;
  }
}

export interface GoogleIma {
  ima: {
    AdEvent: {
      Type: {
        LOADED: string;
        STARTED: string;
        IMPRESSION: string;
        FIRST_QUARTILE: string;
        MIDPOINT: string;
        THIRD_QUARTILE: string;
        COMPLETE: string;
        PAUSED: string;
        RESUMED: string;
        SKIPPED: string;
        CLICK: string;
        ALL_ADS_COMPLETED: string;
        AD_ERROR: string;
      };
    };
    AdErrorEvent: {
      Type?: Record<string, string>;
      AD_ERROR?: string;
    };
    ViewMode: {
      NORMAL: string;
      FULLSCREEN: string;
    };
    AdsLoader: new (container: ImaAdDisplayContainer) => ImaAdsLoader;
    AdDisplayContainer: new (
      container: HTMLElement,
      video?: HTMLVideoElement
    ) => ImaAdDisplayContainer;
    AdsRequest: new () => ImaAdsRequest;
    AdsManager: ImaAdsManager;
    AdsRenderingSettings: new () => ImaAdsRenderingSettings;
    AdsManagerLoadedEvent: {
      Type?: Record<string, string>;
      ADS_MANAGER_LOADED?: string;
    };
  };
}

export interface ImaAdDisplayContainer {
  initialize(): void;
  destroy(): void;
}

export interface ImaAdsRenderingSettings {
  loadVideoTimeout?: number;
}

export interface ImaAdsLoader {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
  requestAds(request: ImaAdsRequest): void;
  contentComplete(): void;
  destroy(): void;
}

export interface ImaAdsRequest {
  adTagUrl?: string;
  adsResponse?: string;
  linearAdSlotWidth?: number;
  linearAdSlotHeight?: number;
  nonLinearAdSlotWidth?: number;
  nonLinearAdSlotHeight?: number;
  setAdWillAutoPlay?(willAutoPlay: boolean): void;
  setAdWillPlayMuted?(willPlayMuted: boolean): void;
}

export interface ImaAdsManager {
  init(width: number, height: number, viewMode: string): void;
  start(): void;
  pause(): void;
  resume(): void;
  skip(): void;
  destroy(): void;
  setVolume(volume: number): void;
  getVolume(): number;
  resize(width: number, height: number, viewMode: string): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
  removeEventListener(type: string, listener: (event: unknown) => void): void;
  getRemainingTime(): number;
  getAdSkippableState(): boolean;
}

export interface ImaAdError {
  getMessage(): string;
  getErrorCode(): number;
}

export interface ImaAdErrorEvent {
  getError(): ImaAdError;
}

export interface ImaAd {
  getDuration(): number;
  isSkippable(): boolean;
  getSkipTimeOffset(): number;
}

export interface ImaAdStartedEvent {
  getAd(): ImaAd;
}

export interface ImaAdsManagerLoadedEvent {
  getAdsManager(
    video: HTMLVideoElement,
    settings?: ImaAdsRenderingSettings
  ): ImaAdsManager;
}
