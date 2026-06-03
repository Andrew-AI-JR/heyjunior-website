/**
 * Redirect legacy signup URLs to register.html (unified signup flow).
 * Usage: <script src="js/register-redirect.js" data-src="checkout" data-coupon="JUNIOR50"></script>
 */
(function () {
  var script = document.currentScript;
  if (!script) return;

  var src = script.getAttribute('data-src') || 'redirect';
  var coupon = script.getAttribute('data-coupon');
  var params = new URLSearchParams(window.location.search);

  if (!params.get('src')) {
    params.set('src', src);
  }
  if (coupon && !params.get('coupon')) {
    params.set('coupon', coupon);
  }

  var base = script.getAttribute('data-base') || '/register.html';
  var query = params.toString();
  window.location.replace(base + (query ? '?' + query : ''));
})();
