/* Shared behaviour for "hj" pages: login link, mobile menu and audience pricing tabs. */
(function () {
    'use strict';

    function initAccountLinks() {
        var token = null;
        try {
            token = sessionStorage.getItem('userToken') || sessionStorage.getItem('accessToken');
        } catch (e) {
            token = null;
        }
        var loginLink = document.getElementById('login-link');
        var portalLink = document.getElementById('portal-link');
        if (loginLink) loginLink.style.display = token ? 'none' : 'block';
        if (portalLink) portalLink.style.display = token ? 'block' : 'none';
    }

    function initMobileMenu() {
        var mobileToggle = document.querySelector('.mobile-menu-toggle');
        var navLinks = document.querySelector('.nav-links');
        if (!mobileToggle || !navLinks) return;
        mobileToggle.addEventListener('click', function () {
            this.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
        navLinks.querySelectorAll('a[href*="#"]').forEach(function (a) {
            a.addEventListener('click', function () {
                mobileToggle.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });
    }

    // Panels stay stacked (all visible) without JS. With JS each [data-tabs]
    // block gets a tab bar, and a link to a panel's id (#pricing-individual)
    // opens that panel.
    function initTabs() {
        document.querySelectorAll('[data-tabs]').forEach(function (group) {
            var panels = Array.prototype.slice.call(group.querySelectorAll('.hj-tabpanel'));
            if (panels.length < 2) return;

            var bar = document.createElement('div');
            bar.className = 'hj-tabs';
            bar.setAttribute('role', 'tablist');
            bar.setAttribute('aria-label', group.getAttribute('data-tabs'));

            var tabs = panels.map(function (panel) {
                var tab = document.createElement('button');
                tab.type = 'button';
                tab.className = 'hj-tab';
                tab.id = panel.id + '-tab';
                tab.textContent = panel.getAttribute('data-tab-label');
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-controls', panel.id);
                panel.setAttribute('role', 'tabpanel');
                panel.setAttribute('aria-labelledby', tab.id);
                tab.addEventListener('click', function () {
                    select(panel.id);
                    if (typeof window.juniorTrack === 'function') {
                        window.juniorTrack('pricing_tab', { tab: panel.id });
                    }
                });
                bar.appendChild(tab);
                return tab;
            });

            bar.addEventListener('keydown', function (e) {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                var i = tabs.indexOf(document.activeElement);
                if (i < 0) return;
                var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
                next.focus();
                next.click();
            });

            function select(id) {
                panels.forEach(function (panel, i) {
                    var on = panel.id === id;
                    panel.hidden = !on;
                    tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
                    tabs[i].tabIndex = on ? 0 : -1;
                });
            }

            function selectFromHash() {
                var id = (window.location.hash || '').slice(1);
                var match = id && panels.filter(function (p) { return p.id === id; })[0];
                if (match) {
                    select(match.id);
                    return true;
                }
                return false;
            }

            group.insertBefore(bar, panels[0]);
            document.body.classList.add('tabs-ready');
            // Arriving from another page: the browser scrolls to the panel itself
            // (past the tab bar), so scroll to the tab group once layout settles.
            if (selectFromHash()) {
                var scrollToGroup = function () { group.scrollIntoView({ block: 'start' }); };
                if (document.readyState === 'complete') setTimeout(scrollToGroup, 0);
                else window.addEventListener('load', function () { setTimeout(scrollToGroup, 0); });
            } else {
                select(panels[0].id);
            }

            window.addEventListener('hashchange', function () {
                if (selectFromHash()) group.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            // Same-hash clicks do not fire hashchange, so handle links directly.
            document.querySelectorAll('a[href*="#"]').forEach(function (a) {
                var id = a.getAttribute('href').split('#')[1];
                if (!panels.some(function (p) { return p.id === id; })) return;
                a.addEventListener('click', function (e) {
                    e.preventDefault();
                    select(id);
                    if (history.replaceState) history.replaceState(null, '', '#' + id);
                    group.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            });
        });
    }

    function init() {
        initAccountLinks();
        initMobileMenu();
        initTabs();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
