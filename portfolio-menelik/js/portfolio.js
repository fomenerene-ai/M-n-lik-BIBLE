// Portfolio layer on top of the glass engine: FR / EN switch, section reveals,
// in-flow navigation. Classic script, runs before the engine module and without WebGL.
(function () {
    'use strict';
    var DICT = window.PORTFOLIO_I18N || {};
    var SITE_URL = window.PORTFOLIO_SITE_URL || '';
    var STORAGE_KEY = 'portfolio-lang';
    var root = document.documentElement;
    var current = 'fr';

    function get(lang, key) {
        return key.split('.').reduce(function (value, part) {
            return value == null ? value : value[part];
        }, DICT[lang]);
    }
    function readStored() {
        try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
    }
    function writeStored(lang) {
        try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* private mode */ }
    }
    function initialLang() {
        var match = /[?&]lang=(fr|en)\b/.exec(window.location.search);
        if (match) return match[1];
        return readStored() === 'en' ? 'en' : 'fr';
    }
    function titleHTML(lines) {
        return lines.map(function (line, i) {
            return '<span class="line' + (i ? ' muted' : '') + '"><span class="line-inner">' + line + '</span></span>';
        }).join('');
    }
    function setMeta(selector, attr, value) {
        var el = document.querySelector(selector);
        if (el && value) el.setAttribute(attr, value);
    }

    function apply(lang, firstRun) {
        if (!DICT[lang]) return;
        current = lang;
        // The HTML ships in French: nothing to rewrite on a French first load.
        if (!(firstRun && lang === 'fr')) {
            document.querySelectorAll('[data-i18n]').forEach(function (el) {
                var value = get(lang, el.getAttribute('data-i18n'));
                if (typeof value === 'string') el.innerHTML = value;
            });
            document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
                el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
                    var parts = pair.split(':');
                    var value = get(lang, parts[1]);
                    if (typeof value === 'string') el.setAttribute(parts[0], value);
                });
            });
            document.title = get(lang, 'title');
            setMeta('meta[name="description"]', 'content', get(lang, 'meta_description'));
        }
        // Titles always become two masked lines (the engine leaves split titles alone).
        document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
            var lines = get(lang, el.getAttribute('data-i18n-title'));
            if (Array.isArray(lines)) el.innerHTML = titleHTML(lines);
        });
        root.setAttribute('lang', lang);
        var toggle = document.getElementById('lang-toggle');
        if (toggle) toggle.setAttribute('lang', lang === 'fr' ? 'en' : 'fr');
        var url = SITE_URL ? SITE_URL + '/' + (lang === 'en' ? '?lang=en' : '') : '';
        setMeta('link[rel="canonical"]', 'href', url);
        setMeta('meta[property="og:url"]', 'content', url);
        setMeta('meta[property="og:locale"]', 'content', lang === 'en' ? 'en_GB' : 'fr_FR');
        setMeta('meta[property="og:locale:alternate"]', 'content', lang === 'en' ? 'fr_FR' : 'en_GB');
        if (!firstRun) {
            try {
                var params = new URLSearchParams(window.location.search);
                if (lang === 'en') params.set('lang', 'en'); else params.delete('lang');
                var query = params.toString();
                window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + window.location.hash);
            } catch (e) { /* file:// or sandboxed */ }
        }
        window.dispatchEvent(new CustomEvent('portfolio:lang', { detail: { lang: lang } }));
    }

    apply(initialLang(), true);

    var toggle = document.getElementById('lang-toggle');
    if (toggle) {
        toggle.addEventListener('click', function () {
            var next = current === 'fr' ? 'en' : 'fr';
            writeStored(next);
            apply(next, false);
        });
    }

    // In-flow sections: reveal once, highlight the matching header link.
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var reveals = document.querySelectorAll('.reveal, .flow-head, .tools');
    var flowLinks = document.querySelectorAll('.header-nav .nav-flow');
    if ('IntersectionObserver' in window && !reduced) {
        var revealer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-in');
                    revealer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        reveals.forEach(function (el) { el.classList.add('will-reveal'); revealer.observe(el); });
    }
    if ('IntersectionObserver' in window) {
        var active = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                flowLinks.forEach(function (link) {
                    if (link.getAttribute('href') === '#' + entry.target.id) link.classList.toggle('is-active', entry.isIntersecting);
                });
            });
        }, { rootMargin: '-45% 0px -45% 0px' });
        document.querySelectorAll('.flow-section').forEach(function (section) { active.observe(section); });
    }
    flowLinks.forEach(function (link) {
        link.addEventListener('click', function (event) {
            var target = document.querySelector(link.getAttribute('href'));
            if (!target) return;
            event.preventDefault();
            target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
            target.focus({ preventScroll: true });
        });
    });
})();
