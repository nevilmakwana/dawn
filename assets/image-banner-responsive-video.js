(() => {
  if (window.GreyEximResponsiveWebm) {
    window.GreyEximResponsiveWebm.initialize(document);
    return;
  }

  const selector = 'video[data-responsive-webm]';
  const mobileQuery = window.matchMedia('(max-width: 749px)');

  const playVideo = (video) => {
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');

    const playRequest = video.play();
    if (playRequest && typeof playRequest.catch === 'function') {
      playRequest.catch(() => {});
    }
  };

  const updateVideo = (video) => {
    const isMobile = mobileQuery.matches;
    const viewport = isMobile ? 'mobile' : 'desktop';
    const nextSource = isMobile ? video.dataset.mobileSrc : video.dataset.desktopSrc;
    const nextPoster = isMobile ? video.dataset.mobilePoster : video.dataset.desktopPoster;
    const hasNativeSources = Boolean(video.querySelector('source[src]'));

    if (!nextSource) return;

    if (nextPoster && video.getAttribute('poster') !== nextPoster) {
      video.setAttribute('poster', nextPoster);
    }

    if (!hasNativeSources && video.dataset.currentSrc !== nextSource) {
      video.dataset.currentSrc = nextSource;
      video.src = nextSource;
      video.load();
    } else if (hasNativeSources && video.dataset.currentViewport && video.dataset.currentViewport !== viewport) {
      video.load();
    }
    video.dataset.currentViewport = viewport;

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      playVideo(video);
      return;
    }

    if (video.dataset.playbackBound !== 'true') {
      video.dataset.playbackBound = 'true';
      video.addEventListener('loadeddata', () => playVideo(video));
      video.addEventListener('canplay', () => playVideo(video));
    }
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
