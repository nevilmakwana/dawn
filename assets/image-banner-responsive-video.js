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
    const nextSource = isMobile ? video.dataset.mobileSrc : video.dataset.desktopSrc;
    const nextPoster = isMobile ? video.dataset.mobilePoster : video.dataset.desktopPoster;

    if (!nextSource) return;

    if (nextPoster && video.getAttribute('poster') !== nextPoster) {
      video.setAttribute('poster', nextPoster);
    }

    if (video.dataset.currentSrc !== nextSource) {
      video.dataset.currentSrc = nextSource;
      video.src = nextSource;
      video.load();
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      playVideo(video);
      return;
    }

    video.addEventListener('loadeddata', () => playVideo(video), { once: true });
    video.addEventListener('canplay', () => playVideo(video), { once: true });
  };

  const initialize = (root = document) => {
    if (root.matches && root.matches(selector)) updateVideo(root);
    root.querySelectorAll(selector).forEach(updateVideo);
  };

  const api = { initialize };
  window.GreyEximResponsiveWebm = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initialize(document), { once: true });
  } else {
    initialize(document);
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
