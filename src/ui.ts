import type { RediadsRendererConfig } from './types';

export interface PlayerChrome {
  root: HTMLElement;
  video: HTMLVideoElement;
  adContainer: HTMLElement;
  overlay: HTMLElement;
  controls: HTMLElement;
  progressBar: HTMLElement;
  progressFill: HTMLElement;
  timeLabel: HTMLElement;
  playButton: HTMLButtonElement;
  muteButton: HTMLButtonElement;
  fullscreenButton: HTMLButtonElement;
  skipButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  adLabel: HTMLElement;
  loader: HTMLElement;
  errorPanel: HTMLElement;
}

export function buildPlayerChrome(
  container: HTMLElement,
  config: RediadsRendererConfig,
  dimensions: { width: number; height: number }
): PlayerChrome {
  container.innerHTML = '';
  container.classList.add('rediads-outstream-slot');
  // Set the size vars on the slot so both the slot (max-width) and the player
  // root (inherits) size to the configured dimensions.
  container.style.setProperty('--rediads-width', `${dimensions.width}px`);
  container.style.setProperty('--rediads-height', `${dimensions.height}px`);

  const root = document.createElement('div');
  root.className = ['rediads-outstream', config.className].filter(Boolean).join(' ');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', config.adText ?? 'Ad');

  const stage = document.createElement('div');
  stage.className = 'rediads-outstream__stage';

  const adContainer = document.createElement('div');
  adContainer.className = 'rediads-outstream__ad-container';

  const video = document.createElement('video');
  video.className = 'rediads-outstream__video';
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.muted = config.muted !== false;
  video.playsInline = true;

  const overlay = document.createElement('div');
  overlay.className = 'rediads-outstream__overlay';

  const loader = document.createElement('div');
  loader.className = 'rediads-outstream__loader';
  loader.innerHTML = '<span class="rediads-outstream__spinner" aria-hidden="true"></span>';

  const errorPanel = document.createElement('div');
  errorPanel.className = 'rediads-outstream__error';
  errorPanel.hidden = true;
  errorPanel.innerHTML =
    '<p class="rediads-outstream__error-text">Unable to load video ad.</p>';

  const topBar = document.createElement('div');
  topBar.className = 'rediads-outstream__top-bar';

  const adLabel = document.createElement('span');
  adLabel.className = 'rediads-outstream__ad-label';
  adLabel.textContent = config.adText ?? 'Ad';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'rediads-outstream__btn rediads-outstream__btn--icon rediads-outstream__close';
  closeButton.setAttribute('aria-label', 'Close advertisement');
  closeButton.innerHTML = closeIcon();
  closeButton.hidden = config.showCloseButton === false;

  topBar.append(adLabel);
  if (config.showCloseButton !== false) {
    topBar.append(closeButton);
  }

  const controls = document.createElement('div');
  controls.className = 'rediads-outstream__controls';
  controls.hidden = config.showControls === false;

  const playButton = createIconButton('Play', playIcon(), 'rediads-outstream__play');
  const muteButton = createIconButton(
    video.muted ? 'Unmute' : 'Mute',
    video.muted ? muteIcon() : volumeIcon(),
    'rediads-outstream__mute'
  );
  const fullscreenButton = createIconButton(
    'Fullscreen',
    fullscreenIcon(),
    'rediads-outstream__fullscreen'
  );
  const skipButton = createIconButton('Skip ad', 'Skip', 'rediads-outstream__skip');
  skipButton.hidden = true;

  const timeLabel = document.createElement('span');
  timeLabel.className = 'rediads-outstream__time';
  timeLabel.textContent = '0:00';

  const progressBar = document.createElement('div');
  progressBar.className = 'rediads-outstream__progress';
  progressBar.setAttribute('role', 'progressbar');
  progressBar.setAttribute('aria-valuemin', '0');
  progressBar.setAttribute('aria-valuemax', '100');
  progressBar.setAttribute('aria-valuenow', '0');

  const progressFill = document.createElement('div');
  progressFill.className = 'rediads-outstream__progress-fill';
  progressBar.append(progressFill);

  const logo = document.createElement('a');
  logo.className = 'rediads-outstream__logo';
  logo.href = 'https://rediads.com';
  logo.target = '_blank';
  logo.rel = 'noopener noreferrer';
  logo.setAttribute('aria-label', 'Ad by Rediads');
  logo.innerHTML = logoMark();

  const controlGroup = document.createElement('div');
  controlGroup.className = 'rediads-outstream__control-group';
  controlGroup.append(playButton, muteButton, timeLabel, fullscreenButton, logo);

  controls.append(progressBar, controlGroup);

  overlay.append(topBar, loader, errorPanel, controls);
  stage.append(video, adContainer, overlay);
  root.append(stage);
  container.append(root);

  requestAnimationFrame(() => {
    root.classList.add('rediads-outstream--visible');
  });

  return {
    root,
    video,
    adContainer,
    overlay,
    controls,
    progressBar,
    progressFill,
    timeLabel,
    playButton,
    muteButton,
    fullscreenButton,
    skipButton,
    closeButton,
    adLabel,
    loader,
    errorPanel,
  };
}

export function setPlayingState(chrome: PlayerChrome, playing: boolean): void {
  chrome.playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  chrome.playButton.innerHTML = playing ? pauseIcon() : playIcon();
  chrome.root.classList.toggle('rediads-outstream--playing', playing);
}

export function setMutedState(chrome: PlayerChrome, muted: boolean): void {
  chrome.muteButton.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  chrome.muteButton.innerHTML = muted ? muteIcon() : volumeIcon();
  chrome.root.classList.toggle('rediads-outstream--muted', muted);
}

export function setLoading(chrome: PlayerChrome, loading: boolean): void {
  chrome.loader.hidden = !loading;
  chrome.root.classList.toggle('rediads-outstream--loading', loading);
}

export function clearError(chrome: PlayerChrome): void {
  chrome.errorPanel.hidden = true;
  chrome.root.classList.remove('rediads-outstream--error');
  const text = chrome.errorPanel.querySelector('.rediads-outstream__error-text');
  if (text) {
    text.textContent = 'Unable to load video ad.';
  }
}

export function showError(chrome: PlayerChrome, message: string): void {
  chrome.errorPanel.hidden = false;
  const text = chrome.errorPanel.querySelector('.rediads-outstream__error-text');
  if (text) {
    text.textContent = message;
  }
  chrome.root.classList.add('rediads-outstream--error');
  setLoading(chrome, false);
}

export function updateProgress(chrome: PlayerChrome, current: number, total: number): void {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  chrome.progressFill.style.width = `${pct}%`;
  chrome.progressBar.setAttribute('aria-valuenow', String(Math.round(pct)));
  chrome.timeLabel.textContent = `${formatTime(current)} / ${formatTime(total)}`;
}

export function updateSkipButton(
  chrome: PlayerChrome,
  visible: boolean,
  remainingSeconds?: number
): void {
  chrome.skipButton.hidden = !visible;
  if (visible && remainingSeconds != null && remainingSeconds > 0) {
    chrome.skipButton.textContent = `Skip in ${Math.ceil(remainingSeconds)}s`;
    chrome.skipButton.disabled = true;
  } else if (visible) {
    chrome.skipButton.textContent = 'Skip ad';
    chrome.skipButton.disabled = false;
  }
}

function createIconButton(
  label: string,
  content: string,
  className: string
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `rediads-outstream__btn rediads-outstream__btn--icon ${className}`;
  button.setAttribute('aria-label', label);
  button.innerHTML = content;
  return button;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function playIcon(): string {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
}

function pauseIcon(): string {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
}

function volumeIcon(): string {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06A4.51 4.51 0 0 0 16.5 12z"/></svg>';
}

function muteIcon(): string {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.14l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>';
}

function fullscreenIcon(): string {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h4V5H5v6h2V7zm10 0v4h2V5h-6v2h4zM7 17v-4H5v6h6v-2H7zm10 0h-4v2h6v-6h-2v4z"/></svg>';
}

function logoMark(): string {
  return '<svg viewBox="0 0 74.25 74.25" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="rgba(255,255,255,0.9)" d="M 28.289062 10.8125 C 28.789062 10.042969 29.644531 9.578125 30.5625 9.578125 C 35.089844 9.578125 49.011719 9.578125 57.757812 9.578125 C 59.429688 9.578125 60.996094 10.40625 61.9375 11.785156 C 62.875 13.167969 63.074219 14.925781 62.460938 16.484375 C 60.480469 21.53125 57.859375 28.191406 56.230469 32.335938 C 55.3125 34.675781 53.058594 36.210938 50.550781 36.210938 L 47.007812 36.210938 L 61.777344 58.859375 L 52.085938 58.859375 L 37.007812 36.210938 L 30.632812 45.984375 L 36.105469 45.984375 L 40.871094 53.085938 L 26.003906 53.085938 L 22.238281 58.859375 L 13.035156 58.859375 L 27.804688 36.210938 L 20.925781 36.210938 L 14.550781 45.984375 L 5.351562 45.984375 C 5.351562 45.984375 13.003906 34.246094 15.546875 30.351562 C 16.050781 29.578125 16.910156 29.109375 17.835938 29.109375 L 45.652344 29.109375 C 46.730469 29.109375 47.730469 28.566406 48.320312 27.664062 C 49.570312 25.746094 51.8125 22.3125 53.453125 19.792969 C 53.859375 19.171875 53.890625 18.382812 53.539062 17.734375 C 53.1875 17.082031 52.507812 16.679688 51.769531 16.679688 L 33.664062 16.679688 L 29.066406 23.722656 L 19.867188 23.722656 C 19.867188 23.722656 26.042969 14.253906 28.289062 10.8125 Z M 28.289062 10.8125 "/></svg>';
}

function closeIcon(): string {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.3 10.59 10.6l6.3-6.3z"/></svg>';
}
