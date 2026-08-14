(() => {
  const existingController = window.GreyEximImageBannerSubjectFocus;

  if (existingController) {
    existingController.refresh();
    return;
  }

  const mobileQuery = window.matchMedia('(max-width: 749px)');
  const bannerSelector = '.banner--mobile-center-zoom.banner--mobile-auto-subject-focus';
  const maxScanSize = 480;
  let detector = null;

  try {
    if ('FaceDetector' in window) {
      detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
    }
  } catch (error) {
    detector = null;
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const waitForImage = (image) => {
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();

    return new Promise((resolve) => {
      const done = () => resolve();

      image.addEventListener('load', done, { once: true });
      image.addEventListener('error', done, { once: true });
      window.setTimeout(done, 2500);
    });
  };

  const getVisibleImage = (banner) => {
    const images = [...banner.querySelectorAll('.banner__media img')];

    return (
      images.find((image) => image.getClientRects().length > 0 && image.offsetParent !== null) ||
      images[0] ||
      null
    );
  };

  const getLargestFace = (faces) =>
    faces.reduce((largestFace, face) => {
      if (!largestFace) return face;

      const currentArea = face.boundingBox.width * face.boundingBox.height;
      const largestArea = largestFace.boundingBox.width * largestFace.boundingBox.height;

      return currentArea > largestArea ? face : largestFace;
    }, null);

  const detectBannerSubject = async (banner) => {
    if (!detector || !mobileQuery.matches || banner.dataset.subjectFocusAttempted === 'true') return;

    const image = getVisibleImage(banner);

    if (!image) return;

    banner.dataset.subjectFocusAttempted = 'true';
    await waitForImage(image);

    if (!mobileQuery.matches || image.naturalWidth === 0 || image.naturalHeight === 0) return;

    const scale = Math.min(1, maxScanSize / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');

    if (!context) return;

    try {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const faces = await detector.detect(canvas);
      const face = faces.length > 0 ? getLargestFace(faces) : null;

      if (!face) return;

      const box = face.boundingBox;
      const focusX = ((box.x + box.width / 2) / canvas.width) * 100;
      const focusY = ((box.y + box.height * 1.15) / canvas.height) * 100;
      const positionX = clamp(focusX, 18, 82).toFixed(1);
      const positionY = clamp(focusY, 30, 62).toFixed(1);

      banner.style.setProperty('--mobile-banner-subject-position', `${positionX}% ${positionY}%`);
      banner.classList.add('banner--subject-detected');
    } catch (error) {
      banner.dataset.subjectFocusAttempted = 'true';
    }
  };

  const scheduleDetection = (banner) => {
    const run = () => detectBannerSubject(banner);

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 1200 });
      return;
    }

    window.setTimeout(run, 120);
  };

  const refresh = (root = document) => {
    if (!mobileQuery.matches) return;

    root.querySelectorAll(bannerSelector).forEach(scheduleDetection);
  };

  const resetAndRefresh = () => {
    document.querySelectorAll(bannerSelector).forEach((banner) => {
      banner.dataset.subjectFocusAttempted = 'false';
    });

    refresh();
  };

  document.addEventListener('DOMContentLoaded', () => refresh());
  window.addEventListener('load', () => refresh());
  window.addEventListener('resize', resetAndRefresh);
  document.addEventListener('shopify:section:load', (event) => refresh(event.target));

  if ('addEventListener' in mobileQuery) {
    mobileQuery.addEventListener('change', resetAndRefresh);
  } else if ('addListener' in mobileQuery) {
    mobileQuery.addListener(resetAndRefresh);
  }

  window.GreyEximImageBannerSubjectFocus = {
    refresh,
  };

  refresh();
})();
