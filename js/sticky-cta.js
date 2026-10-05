(function () {
    'use strict';

    var COMPETING_SELECTORS = [
        '.hj-hero', '.audience-hero', '#pricing', '.hj-final', '.home-final-cta',
        '.enterprise-band', 'form', 'footer'
    ];

    function init() {
        var sticky = document.querySelector('.sticky-global-cta');
        if (!sticky || typeof IntersectionObserver !== 'function') return;

        var targets = document.querySelectorAll(COMPETING_SELECTORS.join(','));
        if (!targets.length) return;

        sticky.classList.add('is-hidden');
        var visible = new Set();
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) visible.add(entry.target);
                else visible.delete(entry.target);
            });
            var hide = visible.size > 0;
            sticky.classList.toggle('is-hidden', hide);
            sticky.setAttribute('aria-hidden', hide ? 'true' : 'false');
            sticky.tabIndex = hide ? -1 : 0;
        }, { threshold: 0.15 });

        targets.forEach(function (el) { observer.observe(el); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
