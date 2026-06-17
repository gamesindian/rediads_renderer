import type {
  ImaAdDisplayContainer,
  ImaAdErrorEvent,
  ImaAdStartedEvent,
  ImaAdsLoader,
  ImaAdsManager,
  ImaAdsManagerLoadedEvent,
} from './global';
import {
  buildPlayerChrome,
  clearError,
  setLoading,
  setMutedState,
  setPlayingState,
  showError,
  updateProgress,
  updateSkipButton,
} from './ui';
import {
  createUniqueId,
  emitEvent,
  loadImaSdk,
  normalizeVastFromBid,
  resolveContainer,
  resolveDimensions,
  resolveVastForIma,
  waitForViewability,
} from './utils';
import type { OutstreamPlayer, PrebidBid, RediadsRendererConfig, RendererEventType } from './types';

const DEFAULT_CONFIG: Required<
  Pick<
    RediadsRendererConfig,
    'adText' | 'autoplay' | 'muted' | 'showControls' | 'showCloseButton' | 'skipOffset' | 'imaSdkUrl'
  >
> = {
  adText: 'Advertisement',
  autoplay: 'viewable',
  muted: true,
  showControls: true,
  showCloseButton: true,
  skipOffset: 0,
  imaSdkUrl: 'https://imasdk.googleapis.com/js/sdkloader/ima3.js',
};

function getIma() {
  const ima = window.google?.ima;
  if (!ima) {
    throw new Error('Google IMA SDK is not available on window.google.ima');
  }
  return ima;
}

function getAdEventTypes(ima: ReturnType<typeof getIma>) {
  // IMA SDK v3+ nests constants under AdEvent.Type
  return ima.AdEvent.Type ?? (ima.AdEvent as typeof ima.AdEvent.Type);
}

function getImaEventName(
  eventGroup: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  const typed = eventGroup as { Type?: Record<string, string> };
  const fromType = typed.Type?.[key];
  const direct = eventGroup[key];
  if (typeof fromType === 'string') return fromType;
  if (typeof direct === 'string') return direct;
  return fallback;
}

function getImaErrorMessage(event: unknown, fallback: string): string {
  try {
    const errEvent = event as ImaAdErrorEvent;
    const err = typeof errEvent.getError === 'function' ? errEvent.getError() : null;
    const message = err?.getMessage?.();
    if (message) return message;
  } catch {
    // Fall through to fallback.
  }
  return fallback;
}

export function renderOutstream(
  bid: PrebidBid,
  container?: HTMLElement | null,
  config: RediadsRendererConfig = {},
  doc: Document = document
): OutstreamPlayer {
  const renderDoc = doc instanceof Document ? doc : document;
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  bid = normalizeVastFromBid(bid);
  const target = container ?? resolveContainer(bid.adUnitCode, renderDoc);

  if (!target) {
    throw new Error(
      `[Rediads Renderer] Container not found for ad unit "${bid.adUnitCode}".`
    );
  }

  if (!bid.vastUrl && !bid.vastXml) {
    throw new Error('[Rediads Renderer] Bid is missing both vastUrl and vastXml.');
  }

  const dimensions = resolveDimensions(bid, target);
  const chrome = buildPlayerChrome(target, mergedConfig, dimensions);
  const playerId = createUniqueId('rediads-player', bid.adId);

  let destroyed = false;
  let adsLoader: ImaAdsLoader | null = null;
  let adDisplayContainer: ImaAdDisplayContainer | null = null;
  let adsManager: ImaAdsManager | null = null;
  let started = false;
  let duration = 0;
  let progressTimer: number | null = null;
  let skipTimer: number | null = null;
  let loadTimer: number | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const fire = (
    type: RendererEventType,
    extra: Partial<{ message: string; data: unknown }> = {}
  ) => {
    emitEvent(mergedConfig, { type, bid, ...extra });
  };

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;

    if (progressTimer != null) {
      window.clearInterval(progressTimer);
      progressTimer = null;
    }
    if (skipTimer != null) {
      window.clearInterval(skipTimer);
      skipTimer = null;
    }
    if (loadTimer != null) {
      window.clearTimeout(loadTimer);
      loadTimer = null;
    }
    resizeObserver?.disconnect();
    resizeObserver = null;

    try {
      adsManager?.destroy();
    } catch {
      // ignore destroy errors
    }
    adsManager = null;

    try {
      adDisplayContainer?.destroy();
    } catch {
      // ignore destroy errors
    }
    adDisplayContainer = null;

    try {
      adsLoader?.destroy();
    } catch {
      // ignore destroy errors
    }
    adsLoader = null;

    chrome.video.src = '';
    chrome.video.load();
    fire('destroyed');
  };

  const getViewMode = (): string => {
    const ima = getIma();
    return document.fullscreenElement === chrome.root
      ? ima.ViewMode.FULLSCREEN
      : ima.ViewMode.NORMAL;
  };

  const resizeAds = () => {
    if (!adsManager) return;
    const { width, height } = resolveDimensions(bid, target);
    adsManager.resize(width, height, getViewMode());
    chrome.root.style.setProperty('--rediads-width', `${width}px`);
    chrome.root.style.setProperty('--rediads-height', `${height}px`);
  };

  const startPlayback = () => {
    if (started || !adsManager) return;
    try {
      started = true;
      adsManager.start();
      setPlayingState(chrome, true);
      fire('start');
    } catch (error) {
      started = false;
      const message =
        error instanceof Error ? error.message : 'Failed to start ad playback';
      showError(chrome, message);
      fire('error', { message });
      cleanup();
    }
  };

  const bindControls = () => {
    chrome.playButton.addEventListener('click', () => {
      if (!adsManager) return;
      if (chrome.root.classList.contains('rediads-outstream--playing')) {
        adsManager.pause();
      } else if (!started) {
        startPlayback();
      } else {
        adsManager.resume();
      }
    });

    chrome.muteButton.addEventListener('click', () => {
      if (!adsManager) return;
      const nextMuted = adsManager.getVolume() > 0;
      adsManager.setVolume(nextMuted ? 0 : 1);
      chrome.video.muted = nextMuted;
      setMutedState(chrome, nextMuted);
    });

    chrome.fullscreenButton.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement === chrome.root) {
          await document.exitFullscreen();
        } else {
          await chrome.root.requestFullscreen();
        }
      } catch {
        // Fullscreen may be blocked by browser policy.
      }
      resizeAds();
    });

    chrome.skipButton.addEventListener('click', () => {
      adsManager?.skip();
    });

    chrome.closeButton.addEventListener('click', () => {
      fire('closed');
      cleanup();
      target.style.minHeight = '0';
      target.innerHTML = '';
    });

    document.addEventListener('fullscreenchange', resizeAds);

    resizeObserver = new ResizeObserver(() => resizeAds());
    resizeObserver.observe(target);
  };

  const trackProgress = () => {
    if (progressTimer != null) {
      window.clearInterval(progressTimer);
    }
    progressTimer = window.setInterval(() => {
      if (!adsManager || duration <= 0) return;
      const remaining = adsManager.getRemainingTime();
      const current = Math.max(0, duration - remaining);
      updateProgress(chrome, current, duration);
    }, 250);
  };

  const setupSkipCountdown = (offset: number) => {
    if (offset <= 0) return;

    let remaining = offset;
    updateSkipButton(chrome, true, remaining);

    skipTimer = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        updateSkipButton(chrome, true, remaining);
      } else {
        window.clearInterval(skipTimer!);
        skipTimer = null;
        updateSkipButton(chrome, true);
      }
    }, 1000);
  };

  const onAdsManagerLoaded = (manager: ImaAdsManager) => {
    if (loadTimer != null) {
      window.clearTimeout(loadTimer);
      loadTimer = null;
    }
    const ima = getIma();
    const adEventTypes = getAdEventTypes(ima);
    adsManager = manager;
    clearError(chrome);
    setLoading(chrome, false);
    fire('loaded');

    const { width, height } = resolveDimensions(bid, target);
    adsManager.init(width, height, ima.ViewMode.NORMAL);
    adsManager.setVolume(mergedConfig.muted ? 0 : 1);

    const adEvents: Array<[string, RendererEventType]> = [
      [adEventTypes.IMPRESSION, 'impression'],
      [adEventTypes.FIRST_QUARTILE, 'firstQuartile'],
      [adEventTypes.MIDPOINT, 'midpoint'],
      [adEventTypes.THIRD_QUARTILE, 'thirdQuartile'],
      [adEventTypes.COMPLETE, 'complete'],
      [adEventTypes.PAUSED, 'pause'],
      [adEventTypes.RESUMED, 'resume'],
      [adEventTypes.SKIPPED, 'skipped'],
      [adEventTypes.CLICK, 'click'],
    ];

    adEvents.forEach(([imaEvent, eventType]) => {
      if (imaEvent) {
        adsManager!.addEventListener(imaEvent, () => fire(eventType));
      }
    });

    adsManager.addEventListener(adEventTypes.STARTED, (event: unknown) => {
      const adEvent = event as ImaAdStartedEvent;
      clearError(chrome);
      setLoading(chrome, false);
      duration = adEvent.getAd()?.getDuration?.() ?? 0;
      setPlayingState(chrome, true);
      trackProgress();

      const skipOffset =
        mergedConfig.skipOffset > 0
          ? mergedConfig.skipOffset
          : adEvent.getAd()?.getSkipTimeOffset?.() ?? 0;

      if (adEvent.getAd()?.isSkippable?.() && skipOffset > 0) {
        setupSkipCountdown(skipOffset);
      } else if (adEvent.getAd()?.isSkippable?.()) {
        updateSkipButton(chrome, true);
      }
    });

    adsManager.addEventListener(adEventTypes.ALL_ADS_COMPLETED, () => {
      setPlayingState(chrome, false);
      fire('complete');
      cleanup();
      target.classList.add('rediads-outstream-slot--completed');
    });

    adsManager.addEventListener(
      getImaEventName(ima.AdErrorEvent, 'AD_ERROR', 'adError'),
      (event: unknown) => {
      const message = getImaErrorMessage(event, 'Ad playback error');
      showError(chrome, message);
      fire('error', { message });
      cleanup();
    }
    );

    const maybeAutoplay = async () => {
      if (mergedConfig.autoplay === false) {
        setPlayingState(chrome, false);
        return;
      }

      if (mergedConfig.autoplay === 'viewable') {
        await waitForViewability(chrome.root, 0.5);
      }

      if (!destroyed) {
        startPlayback();
      }
    };

    void maybeAutoplay();
  };

  const requestAds = async () => {
    const ima = getIma();
    const { width, height } = resolveDimensions(bid, target);
    const request = new ima.AdsRequest();

    request.linearAdSlotWidth = width;
    request.linearAdSlotHeight = height;
    request.nonLinearAdSlotWidth = width;
    request.nonLinearAdSlotHeight = height;

    request.setAdWillAutoPlay?.(mergedConfig.autoplay !== false);
    request.setAdWillPlayMuted?.(mergedConfig.muted);

    try {
      const vast = await resolveVastForIma(bid);
      if (vast.adTagUrl) {
        request.adTagUrl = vast.adTagUrl;
      } else if (vast.adsResponse) {
        request.adsResponse = vast.adsResponse;
      } else {
        throw new Error('[Rediads Renderer] No VAST payload resolved for IMA request.');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to resolve VAST for ad request';
      showError(chrome, message);
      fire('error', { message });
      cleanup();
      return;
    }

    adDisplayContainer = new ima.AdDisplayContainer(chrome.adContainer, chrome.video);
    adDisplayContainer.initialize();
    adsLoader = new ima.AdsLoader(adDisplayContainer);

    adsLoader.addEventListener(
      getImaEventName(ima.AdsManagerLoadedEvent, 'ADS_MANAGER_LOADED', 'adsManagerLoaded'),
      (event: unknown) => {
      const loadedEvent = event as ImaAdsManagerLoadedEvent;
      const settings = new ima.AdsRenderingSettings();
      const manager = loadedEvent.getAdsManager(chrome.video, settings);
      if (!manager) {
        showError(chrome, 'Failed to create IMA ads manager.');
        fire('error', { message: 'Failed to create IMA ads manager.' });
        cleanup();
        return;
      }
      onAdsManagerLoaded(manager);
    }
    );

    adsLoader.addEventListener(
      getImaEventName(ima.AdErrorEvent, 'AD_ERROR', 'adError'),
      (event: unknown) => {
      const message = getImaErrorMessage(event, 'Failed to request ads');
      showError(chrome, message);
      fire('error', { message });
      cleanup();
    }
    );

    loadTimer = window.setTimeout(() => {
      if (!destroyed && !adsManager) {
        showError(chrome, 'Ad request timed out. Check VAST URL/XML and network.');
        fire('error', { message: 'Ad request timed out' });
        cleanup();
      }
    }, 15000);

    adsLoader.requestAds(request);
  };

  const init = async () => {
    bindControls();
    setLoading(chrome, true);
    fire('loading');
    fire('ready', { data: { playerId } });

    try {
      await loadImaSdk(mergedConfig.imaSdkUrl);
      if (destroyed) return;
      await requestAds();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to initialize IMA SDK';
      showError(chrome, message);
      fire('error', { message });
      cleanup();
    }
  };

  void init();

  return {
    destroy: cleanup,
    getContainer: () => chrome.root,
  };
}
