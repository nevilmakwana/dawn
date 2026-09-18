(() => {
  if (window.GreyEximResponsiveWebm) {
    window.GreyEximResponsiveWebm.initialize(document);
    return;
  }

  const selector = 'video[data-responsive-webm]';
  const mobileQuery = window.matchMedia('(max-width: 749px)');

  const resolveUrl = (url) => {
    if (!url) return '';
    return new URL(url, document.baseURI).href;
  };

  const bindPlaybackRecovery = (video) => {
    if (video.dataset.playbackRecoveryBound === 'true') return;
    video.dataset.playbackRecoveryBound = 'true';

    const retry = () => {
      video.play().catch(() => {});
      document.removeEventListener('pointerdown', retry);
      document.removeEventListener('touchstart', retry);
      document.removeEventListener('keydown', retry);
    };

    document.addEventListener('pointerdown', retry, { passive: true });
    document.addEventListener('touchstart', retry, { passive: true });
    document.addEventListener('keydown', retry);
  };

  const useFallbackSource = (video) => {
    const fallbackSource = video.dataset.activeFallbackSrc;
    const resolvedFallback = resolveUrl(fallbackSource);
    if (!resolvedFallback || video.dataset.fallbackAttempted === 'true') return false;

    video.dataset.fallbackAttempted = 'true';
    video.dataset.currentSrc = resolvedFallback;
    video.src = fallbackSource;
    video.load();
    return true;
  };

  const playVideo = (video) => {
    video.autoplay = true;
    video.loop = true;
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');

    const playRequest = video.play();
    if (playRequest && typeof playRequest.catch === 'function') {
      playRequest.catch((error) => {
        if (error?.name === 'NotSupportedError' && useFallbackSource(video)) {
          playVideo(video);
          return;
        }
        bindPlaybackRecovery(video);
      });
    }
  };

  const setVideoReady = (video, isReady) => {
    const media = video.closest('.banner__media');
    if (!media) return;
    media.classList.toggle('is-video-ready', isReady);
  };

  const updateVideo = (video) => {
    const isMobile = mobileQuery.matches;
    const viewport = isMobile ? 'mobile' : 'desktop';
    const nextSource = isMobile ? video.dataset.mobileSrc : video.dataset.desktopSrc;
    const nextFallbackSource = isMobile ? video.dataset.mobileFallbackSrc : video.dataset.desktopFallbackSrc;
    const nextPoster = isMobile ? video.dataset.mobilePoster : video.dataset.desktopPoster;
    const resolvedNextSource = resolveUrl(nextSource);

    if (!nextSource) return;

    setVideoReady(video, video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);

    if (nextPoster && video.getAttribute('poster') !== nextPoster) {
      video.setAttribute('poster', nextPoster);
    }

    if (video.dataset.currentViewport !== viewport) {
      video.dataset.fallbackAttempted = 'false';
    }
    video.dataset.currentViewport = viewport;
    video.dataset.activeFallbackSrc = nextFallbackSource || '';

    const activeSource = resolveUrl(video.currentSrc);
    if (activeSource === resolvedNextSource || (video.currentSrc && activeSource.includes(nextSource))) {
      video.dataset.currentSrc = resolvedNextSource;
    } else if (video.dataset.currentSrc !== resolvedNextSource && !video.currentSrc) {
      video.dataset.currentSrc = resolvedNextSource;
      video.src = nextSource;
      video.load();
    }

    if (video.dataset.playbackBound !== 'true') {
      video.dataset.playbackBound = 'true';
      video.addEventListener('loadeddata', () => {
        setVideoReady(video, true);
        playVideo(video);
      });
      video.addEventListener('canplay', () => {
        setVideoReady(video, true);
        playVideo(video);
      });
      video.addEventListener('playing', () => setVideoReady(video, true));
      video.addEventListener('emptied', () => setVideoReady(video, false));
      video.addEventListener('error', () => {
        setVideoReady(video, false);
        if (useFallbackSource(video)) playVideo(video);
      });
    }

    playVideo(video);
  };

  const initialize = (root = document) => {
    if (root.matches && root.matches(selector)) updateVideo(root);
    root.querySelectorAll(selector).forEach(updateVideo);
  };

  const api = { initialize };
  window.GreyEximResponsiveWebm = api;

  initialize(document);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initialize(document), { once: true });
  }

  const handleViewportChange = () => initialize(document);
  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener('change', handleViewportChange);
  } else {
    mobileQuery.addListener(handleViewportChange);
  }

  document.addEventListener('shopify:section:load', (event) => initialize(event.target));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) initialize(document);
  });
})();
