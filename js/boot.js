/* Runs in <head> before first paint.
   - marks the document as scripted so the hidden-until-animated styles apply
   - decides between the full preloader (first visit) and the quick curtain
   - failsafe: if the animation libraries never arrive, show everything anyway */
(function () {
  var root = document.documentElement;
  root.classList.add('js');

  var seen = false;
  try { seen = sessionStorage.getItem('us-seen') === '1'; } catch (e) {}
  root.classList.add(seen ? 'arriving' : 'first-visit');

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('reduced');
  }

  window.setTimeout(function () {
    if (!window.__siteBooted) root.classList.add('failsafe');
  }, 8000);
})();
