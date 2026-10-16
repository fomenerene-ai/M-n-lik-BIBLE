"""Build the portfolio from the premium-3d-glass engine plus the portfolio extensions.

    python3 build.py [--out ../portfolio-menelik]

1. Copies the skill template into a staging folder, lays the portfolio overlay on top
   (index.html, css/portfolio.css, js/portfolio.js) and patches js/app.js and
   build_monofichier.py with small, asserted edits (see PATCHES).
2. Runs the skill's own tools/build_site.py on site.json (email taken from config.json).
3. Fills the portfolio tokens [[...]]: SEO head, projects, background, tools, CTAs.
4. Writes i18n.js (FR + EN), the legal pages, sitemap.xml, robots.txt, netlify.toml
   (with CSP hashes of the inline scripts), README-DEPLOY.md, then the single file.

Idempotent: run it again after any edit of site.json, config.json or content.json.
"""
from __future__ import annotations

import base64
import copy
import datetime
import hashlib
import html
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
SKILL_TEMPLATE = pathlib.Path(os.environ.get(
    'PREMIUM_GLASS_TEMPLATE', '~/.claude/skills/premium-3d-glass/template')).expanduser()
TODAY = datetime.date.today()


# ---------------------------------------------------------------------------- text
def esc_amp(text: str) -> str:
    """Escape bare ampersands (FP&A) while keeping entities and <br> markup."""
    return re.sub(r'&(?!#?\w+;)', '&amp;', text)


def fr_typo(text: str) -> str:
    """French typography: no-break space before ? ! : ; (never inside URLs or tags)."""
    return re.sub(r'(?<=\w|»|\)) ([?!:;])(?=\s|$|<)', '\u00a0\\1', text)


def transform(value, lang, raw=False):
    if isinstance(value, str):
        if lang == 'fr':
            value = fr_typo(value)
        return value if raw else esc_amp(value)
    if isinstance(value, list):
        return [transform(v, lang, raw) for v in value]
    if isinstance(value, dict):
        return {k: transform(v, lang, raw) for k, v in value.items()}
    return value


def strip_tags(text: str) -> str:
    return html.unescape(re.sub(r'<[^>]+>', ' ', text)).replace('  ', ' ').strip()


def check_titles(dic, lang):
    """Engine rule: every title is exactly two lines of at most 18 characters."""
    titles = {
        'hero': dic['hero']['title'], 'about': dic['about']['title'],
        'benefits': dic['benefits']['title'], 'results': dic['results']['title'],
        'contact': dic['contact']['title'], 'projects': dic['ui']['projects_title'],
        'path': dic['ui']['path_title'], 'tools': dic['ui']['tools_title'],
    }
    for name, lines in titles.items():
        plain = [html.unescape(line).replace('\u00a0', ' ') for line in lines]
        if len(plain) != 2 or any(len(line) > 18 for line in plain):
            raise SystemExit(f'title {name} ({lang}) breaks the 2 x 18 rule: {plain}')


# ------------------------------------------------------------------- engine patches
PATCHES = {
    'js/app.js': [
        # Reduced motion flag.
        ("const lerp = THREE.MathUtils.lerp;\n",
         "const lerp = THREE.MathUtils.lerp;\n"
         "// Portfolio: honour prefers-reduced-motion (no inertia, no drift, no sparks).\n"
         "const REDUCED_MOTION = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);\n"),
        # Titles already split by the language switcher are left alone.
        ("    document.querySelectorAll('.slide-title').forEach(title => {\n        const parts",
         "    document.querySelectorAll('.slide-title').forEach(title => {\n"
         "        if (title.querySelector('.line')) return;   // portfolio: already split by i18n\n"
         "        const parts"),
        # Refit titles after a language switch.
        ("window.addEventListener('resize', () => { onWindowResize(); headerState.chapter = -1; fitTitles(); });\n",
         "window.addEventListener('resize', () => { onWindowResize(); headerState.chapter = -1; fitTitles(); });\n"
         "window.addEventListener('portfolio:lang', () => { headerState.chapter = -1; fitTitles(); });\n"),
        # Reduced motion in the loop.
        ("    if (Math.abs(targetContact - currentContact) < 0.0015) currentContact = targetContact;\n",
         "    if (Math.abs(targetContact - currentContact) < 0.0015) currentContact = targetContact;\n"
         "    if (REDUCED_MOTION) { currentScroll = targetScroll; currentContact = targetContact; targetMouseX = targetMouseY = 0; }\n"),
        ("    if (sparkParticles) {\n        const positions",
         "    if (sparkParticles && !REDUCED_MOTION) {\n        const positions"),
        ("    camera.position.lerp(targetPos, damping(0.025));\n",
         "    if (REDUCED_MOTION) camera.position.copy(targetPos); else camera.position.lerp(targetPos, damping(0.025));\n"),
        ("        shaderUniforms.uTime.value = clock.getElapsedTime();\n",
         "        shaderUniforms.uTime.value = REDUCED_MOTION ? 0 : clock.getElapsedTime();\n"),
        ("    createSparks();\n",
         "    createSparks();\n    if (REDUCED_MOTION && sparkParticles) sparkParticles.visible = false;\n"),
        # Portrait framing: pull the camera back a little more while the fragments are
        # apart, so the exploded object stays clear of the stacked text on phones.
        ("    const portraitRadius = 8.9 - Math.sin(scroll * Math.PI) * 0.4 + separation * 2.0 + morph * 0.4;\n",
         "    const portraitRadius = 8.9 - Math.sin(scroll * Math.PI) * 0.4 + separation * 3.4 + morph * 0.4;\n"),
        # Chapter links only: the portfolio adds in-flow links (Projects, Background).
        ("    const links = document.querySelectorAll('.header-nav .nav-link');\n",
         "    const links = document.querySelectorAll('.header-nav .nav-link[data-chapter]');\n"),
        ("    const navLinks = document.querySelectorAll('.nav-link');\n",
         "    const navLinks = document.querySelectorAll('.header-nav .nav-link[data-chapter]');\n"),
        # Contact reveal follows the section itself: Projects and Background sit between.
        ("function updateContact() {\n",
         "let contactInView = false;\n"
         "if (contactSection && 'IntersectionObserver' in window) {\n"
         "    new IntersectionObserver(([entry]) => { contactInView = entry.isIntersecting; }, { threshold: 0.15 }).observe(contactSection);\n"
         "}\n"
         "function updateContact() {\n"),
        ("    contactSection.classList.toggle('is-visible', currentContact > 0.45);\n",
         "    contactSection.classList.toggle('is-visible', contactInView);\n"),
        # Localised mailto, single e-mail constant (no hard-coded fallback address).
        ("    const to = form.dataset.email || 'juliendumas33500@gmail.com';\n"
         "    const subject = `Project enquiry from ${name}${company ? ` (${company})` : ''}`;\n"
         "    const body = [`Name: ${name}`, `E-mail: ${email}`, company ? `Company: ${company}` : null, '', project]\n",
         "    const to = form.dataset.email;\n"
         "    const labels = form.dataset;\n"
         "    const subject = (labels.subject || '{name}{company}').replace('{name}', name).replace('{company}', company ? ` (${company})` : '');\n"
         "    const body = [`${labels.lName || 'Name'}: ${name}`, `${labels.lEmail || 'E-mail'}: ${email}`, company ? `${labels.lCompany || 'Company'}: ${company}` : null, '', project]\n"),
        # QA hook for in-flow sections.
        ("    mailto() { const form",
         "    section(id) {\n"
         "        const el = document.getElementById(id);\n"
         "        if (!el) return;\n"
         "        this.snap(1);\n"
         "        const top = el.getBoundingClientRect().top + window.scrollY;\n"
         "        window.scrollTo(0, top);\n"
         "        currentContact = targetContact = THREE.MathUtils.clamp((top - stageMaxScroll()) / window.innerHeight, 0, 1);\n"
         "    },\n"
         "    mailto() { const form"),
        # WebGL failure: static layout instead of a stuck preloader.
        ("function init() {\n    splitTitlesIntoLines();\n",
         "function init() {\n"
         "    if (document.documentElement.classList.contains('no-webgl')) return;\n"
         "    window.__glassStarted = true;\n"
         "    try { initEngine(); }\n"
         "    catch (error) {\n"
         "        console.warn('3D disabled, static layout:', error && error.message);\n"
         "        if (window.__portfolioFallback) window.__portfolioFallback();\n"
         "    }\n"
         "}\n"
         "function initEngine() {\n    splitTitlesIntoLines();\n"),
    ],
    'build_monofichier.py': [
        # Inline every local stylesheet and classic script, not only styles.css.
        ("    html = re.sub(r'<link rel=\"stylesheet\" href=\"\\./css/styles\\.css[^\"]*\">',\n"
         "                  lambda m: '<style>\\n' + fonts_css + '\\n' + styles_css + '\\n</style>', html)\n",
         "    html = re.sub(r'<link rel=\"stylesheet\" href=\"\\./css/styles\\.css[^\"]*\">',\n"
         "                  lambda m: '<style>\\n' + fonts_css + '\\n' + styles_css + '\\n</style>', html)\n"
         "    # Portfolio: the other local stylesheets and classic scripts, inlined too.\n"
         "    html = re.sub(r'<link rel=\"stylesheet\" href=\"\\./css/([\\w-]+\\.css)[^\"]*\">',\n"
         "                  lambda m: '<style>\\n' + (ROOT / 'css' / m.group(1)).read_text(encoding='utf-8') + '\\n</style>', html)\n"
         "    html = re.sub(r'<script src=\"\\./js/([\\w-]+\\.js)[^\"]*\"></script>',\n"
         "                  lambda m: '<script>\\n' + (ROOT / 'js' / m.group(1)).read_text(encoding='utf-8') + '\\n</script>'\n"
         "                  if (ROOT / 'js' / m.group(1)).exists() else m.group(0), html)\n"
         "    if (ROOT / 'assets/brand/favicon.svg').exists():\n"
         "        html = re.sub(r'href=\"\\./assets/brand/favicon\\.svg\"',\n"
         "                      lambda m: 'href=\"' + data_uri(ROOT / 'assets/brand/favicon.svg', 'image/svg+xml') + '\"', html)\n"
         "    photo = ROOT / 'assets/photo.jpg'\n"
         "    if photo.exists():\n"
         "        html = html.replace('src=\"./assets/photo.jpg\"', 'src=\"' + data_uri(photo, 'image/jpeg') + '\"')\n"),
    ],
}


def apply_patches(stage: pathlib.Path):
    for rel, edits in PATCHES.items():
        path = stage / rel
        text = path.read_text(encoding='utf-8')
        for old, new in edits:
            count = text.count(old)
            if count != 1:
                raise SystemExit(f'patch anchor found {count} times in {rel}:\n{old[:120]}')
            text = text.replace(old, new)
        path.write_text(text, encoding='utf-8')


# --------------------------------------------------------------------- inline scripts
BOOT_SCRIPT = (
    "(function(){var d=document.documentElement;"
    "try{var c=document.createElement('canvas'),g=c.getContext('webgl2');"
    "if(!g){d.classList.add('no-webgl');}else{var x=g.getExtension('WEBGL_lose_context');if(x)x.loseContext();}}"
    "catch(e){d.classList.add('no-webgl');}"
    "if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('reduced-motion');})();"
)


def loader_script(template_html: str) -> str:
    """The engine preloader, plus a static fallback when the 3D cannot start."""
    body = re.search(r'<body>.*?<script>\n(.*?)</script>', template_html, re.S).group(1)
    body = body.replace(
        "  window.__glassLoader = { done: function () { ready = true; } };\n"
        "  requestAnimationFrame(tick);\n",
        "  window.__glassLoader = { done: function () { ready = true; } };\n"
        "  // Portfolio: no WebGL 2, or the 3D never started: static layout, content readable.\n"
        "  window.__portfolioFallback = function () {\n"
        "    document.documentElement.classList.add('no-webgl');\n"
        "    ready = true; finish();\n"
        "  };\n"
        "  if (document.documentElement.classList.contains('no-webgl')) { finish(); return; }\n"
        "  requestAnimationFrame(tick);\n"
        "  setTimeout(function () { if (!window.__glassStarted) window.__portfolioFallback(); }, 12000);\n")
    if '__portfolioFallback' not in body:
        raise SystemExit('loader script anchor not found')
    return '\n' + body


def csp_hash(text: str) -> str:
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode('utf-8')).digest()).decode() + "'"


# ------------------------------------------------------------------------ dictionaries
def engine_dict_fr(site):
    return {
        'title': site['title'], 'meta_description': site['meta_description'],
        'nav': site['nav'], 'nav_label': site.get('nav_label', 'Sections'),
        'loader_hint': site.get('loader_hint', 'Chargement'),
        'hero': site['hero'], 'about': site['about'],
        'benefits': {'title': site['benefits']['title'], 'items': [i['text'] for i in site['benefits']['items']]},
        'results': {'title': site['results']['title'], 'lead': site['results']['lead']},
        'figures': [{'suffix': f.get('suffix', ''), 'label': f['label']} for f in site['figures']],
        'contact': site['contact'], 'form': site['form'], 'footer': site['footer'],
    }


def build_dicts(site, content):
    year = str(TODAY.year)
    dicts = {}
    for lang in ('fr', 'en'):
        base = engine_dict_fr(site) if lang == 'fr' else copy.deepcopy(content['engine_en'])
        ui = copy.deepcopy(content['ui'][lang])
        ui['copyright'] = ui['copyright'].replace('{year}', year)
        base['ui'] = ui
        base['projects'] = {p['id']: dict(p[lang], name=p.get(f'name_{lang}', p['name'])) for p in content['projects']}
        base['path'] = {p['id']: p[lang] for p in content['path']}
        base['tools'] = [t[lang] for t in content['tools']]
        raw_keys = {'title', 'meta_description'}
        out = {k: transform(v, lang, raw=k in raw_keys) for k, v in base.items()}
        # Attribute-only strings are set with setAttribute: no entity escaping there.
        out['form'] = {k: (transform(base['form'][k], lang, raw=True) if k.endswith('placeholder') else v)
                       for k, v in out['form'].items()}
        for key in ('mail_subject', 'mail_name', 'mail_email', 'mail_company', 'lang_toggle_label', 'photo_alt'):
            out['ui'][key] = transform(ui[key], lang, raw=True)
        check_titles(out, lang)
        dicts[lang] = out
    return dicts


def lookup(dic, key):
    value = dic
    for part in key.split('.'):
        value = value[int(part)] if isinstance(value, list) else value[part]
    return value


# ---------------------------------------------------------------------------- blocks
def title_html(lines, el_id, key, cls='flow-title'):
    inner = ''.join(f'<span class="line{" muted" if i else ""}"><span class="line-inner">{line}</span></span>'
                    for i, line in enumerate(lines))
    return f'<h2 class="{cls}" id="{el_id}" data-i18n-title="{key}">{inner}</h2>'


def section_head(fr, eyebrow_key, title_key, lead_key, title_id, aside=''):
    return (
        '<div class="flow-head">\n'
        '  <div class="flow-head-text">\n'
        f'    <p class="flow-eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span><span data-i18n="ui.{eyebrow_key}">{fr["ui"][eyebrow_key]}</span></p>\n'
        f'    {title_html(fr["ui"][title_key], title_id, "ui." + title_key)}\n'
        f'    <p class="flow-lead" data-i18n="ui.{lead_key}">{fr["ui"][lead_key]}</p>\n'
        '  </div>\n'
        f'{aside}'
        '</div>\n')


def projects_section(fr, content):
    cases = []
    labels = [('context', 'label_context'), ('problem', 'label_problem'), ('solution', 'label_solution'),
              ('tools', 'label_tools'), ('result', 'label_result')]
    for index, project in enumerate(content['projects'], start=1):
        pid, data = project['id'], fr['projects'][project['id']]
        items = '\n'.join(
            f'        <div class="case-item case-{field}"><dt data-i18n="ui.{label}">{fr["ui"][label]}</dt>'
            f'<dd data-i18n="projects.{pid}.{field}">{data[field]}</dd></div>'
            for field, label in labels)
        cases.append(
            f'  <li class="case reveal" id="case-{pid}">\n'
            f'    <article aria-labelledby="case-{pid}-title">\n'
            f'      <div class="case-head">\n'
            f'        <span class="case-index" aria-hidden="true">{index:02d}</span>\n'
            f'        <div>\n'
            f'          <p class="case-tag" data-i18n="projects.{pid}.tag">{data["tag"]}</p>\n'
            f'          <h3 class="case-title" id="case-{pid}-title" data-i18n="projects.{pid}.name">{data["name"]}</h3>\n'
            f'          <p class="case-summary" data-i18n="projects.{pid}.summary">{data["summary"]}</p>\n'
            f'        </div>\n'
            f'      </div>\n'
            f'      <dl class="case-grid">\n{items}\n      </dl>\n'
            f'      <!-- TODO: à compléter par Ménélik : {html.escape(project["todo"])} -->\n'
            f'    </article>\n'
            f'  </li>')
    return (
        '<section class="flow-section projects" id="projets" aria-labelledby="projets-title" tabindex="-1">\n'
        '<div class="flow-inner">\n'
        + section_head(fr, 'projects_eyebrow', 'projects_title', 'projects_lead', 'projets-title')
        + '<ol class="cases">\n' + '\n'.join(cases) + '\n</ol>\n</div>\n</section>')


def path_section(fr, content, has_photo):
    items = []
    for entry in content['path']:
        pid, data = entry['id'], fr['path'][entry['id']]
        heading = 'title' if data['title'] else 'org'
        org_line = ''
        if data['org'] and heading == 'title':
            org_line = f'<span data-i18n="path.{pid}.org">{data["org"]}</span>'
        if data['place']:
            org_line += (' · ' if org_line else '') + f'<span data-i18n="path.{pid}.place">{data["place"]}</span>'
        items.append(
            f'  <li class="tl-item reveal">\n'
            f'    <span class="tl-dot" aria-hidden="true"></span>\n'
            f'    <article class="tl-card" aria-labelledby="tl-{pid}">\n'
            f'      <p class="tl-type" data-i18n="path.{pid}.type">{data["type"]}</p>\n'
            f'      <h3 class="tl-title" id="tl-{pid}" data-i18n="path.{pid}.{heading}">{data[heading]}</h3>\n'
            + (f'      <p class="tl-org">{org_line}</p>\n' if org_line else '')
            + f'      <!-- TODO: à compléter par Ménélik : {html.escape(entry["todo"])} -->\n'
            f'    </article>\n'
            f'  </li>')
    if has_photo:
        aside = (f'  <figure class="portrait"><img src="./assets/photo.jpg" alt="{fr["ui"]["photo_alt"]}" '
                 f'data-i18n-attr="alt:ui.photo_alt" width="320" height="400" loading="lazy" decoding="async"></figure>\n')
    else:
        aside = ('  <!-- Photo : emplacement prévu, masqué. Dépose ta photo dans '
                 'portfolio-menelik-source/assets/photo.jpg (portrait 4:5) puis relance build.py. -->\n')
    chips = '\n'.join(f'    <li class="chip" data-i18n="tools.{i}">{tool}</li>' for i, tool in enumerate(fr['tools']))
    return (
        '<section class="flow-section path" id="parcours" aria-labelledby="parcours-title" tabindex="-1">\n'
        '<div class="flow-inner">\n'
        + section_head(fr, 'path_eyebrow', 'path_title', 'path_lead', 'parcours-title', aside)
        + '<ol class="timeline">\n' + '\n'.join(items) + '\n</ol>\n'
        + '<div class="tools" id="outils">\n'
        + section_head(fr, 'tools_eyebrow', 'tools_title', 'tools_lead', 'outils-title')
        + f'  <ul class="chips">\n{chips}\n  </ul>\n</div>\n'
        + '</div>\n</section>')


def contact_extras(fr, config):
    ui = fr['ui']
    new_tab = f'<span class="sr-only" data-i18n="ui.new_tab">{ui["new_tab"]}</span>'
    return (
        '<div class="availability">\n'
        f'        <p class="availability-title" data-i18n="ui.availability_title">{ui["availability_title"]}</p>\n'
        '        <ul>\n'
        f'          <li data-i18n="ui.availability_rhythm">{ui["availability_rhythm"]}</li>\n'
        f'          <li data-i18n="ui.availability_start">{ui["availability_start"]}</li>\n'
        f'          <li data-i18n="ui.availability_mobility">{ui["availability_mobility"]}</li>\n'
        '        </ul>\n'
        '      </div>\n'
        '      <div class="cta-row">\n'
        f'        <!-- TODO: remplace assets/cv.pdf par ton vrai CV (portfolio-menelik-source/assets/cv.pdf). -->\n'
        f'        <a class="cta-btn cta-primary" href="./{config["CV_PATH"]}" download><span data-i18n="ui.cta_cv">{ui["cta_cv"]}</span> <span aria-hidden="true">&darr;</span></a>\n'
        f'        <!-- TODO: BOOKING_URL dans config.json (lien Cal.com ou Google Agenda). -->\n'
        f'        <a class="cta-btn" href="{html.escape(config["BOOKING_URL"])}" target="_blank" rel="noopener"><span data-i18n="ui.cta_booking">{ui["cta_booking"]}</span> {new_tab}<span aria-hidden="true">&#8599;</span></a>\n'
        f'        <!-- TODO: LINKEDIN_URL dans config.json. -->\n'
        f'        <a class="cta-btn" href="{html.escape(config["LINKEDIN_URL"])}" target="_blank" rel="noopener me"><span data-i18n="ui.cta_linkedin">{ui["cta_linkedin"]}</span> {new_tab}<span aria-hidden="true">&#8599;</span></a>\n'
        '      </div>')


def head_seo(site, en, config):
    url = config['SITE_URL'].rstrip('/')
    title = html.escape(site['title'])
    desc = html.escape(site['meta_description'])
    person = {
        '@context': 'https://schema.org', '@type': 'Person',
        'name': 'Ménélik René Tatiodjio Fomene',
        'alternateName': 'Ménélik Tatiodjio',
        'jobTitle': 'Contrôle de gestion et FP&A (Master 2 en cours)',
        'description': site['meta_description'],
        'email': f'mailto:{config["EMAIL"]}',
        'url': url + '/',
        'image': url + '/og.png',
        'alumniOf': {'@type': 'CollegeOrUniversity', 'name': 'EM Strasbourg Business School',
                     'sameAs': 'https://www.em-strasbourg.com'},
        'knowsAbout': ['Contrôle de gestion', 'FP&A', 'Modélisation financière', 'Budget et prévisions',
                       'Reporting', 'Audit', 'SYSCOHADA', 'Excel', 'Power Query', 'Power BI', 'Python', 'SQL', 'SAP'],
        'knowsLanguage': ['fr', 'en'],
    }
    same_as = [u for u in (config['LINKEDIN_URL'],) if 'TODO' not in u]
    if same_as:
        person['sameAs'] = same_as
    analytics = config['ANALYTICS']
    if analytics.get('enabled'):
        domain = re.sub(r'^https?://', '', url)
        if analytics['provider'] == 'umami':
            tag = f'<script defer src="{analytics["umami_src"]}" data-website-id="{analytics["umami_website_id"]}"></script>'
        else:
            tag = f'<script defer data-domain="{domain}" src="{analytics["plausible_src"]}"></script>'
    else:
        tag = ('<!-- TODO analytics : mesure d\'audience sans cookie, donc sans bannière. Active-la dans config.json '
               '(ANALYTICS.enabled), le build insère la balise et ouvre la CSP. Exemple Plausible :\n'
               f'<script defer data-domain="{re.sub(r"^https?://", "", url)}" src="https://plausible.io/js/script.js"></script>\n'
               'ou Umami : <script defer src="https://cloud.umami.is/script.js" data-website-id="TODO"></script> -->')
    return '\n'.join([
        f'<!-- TODO domaine : SITE_URL dans config.json ({url}) -->',
        f'<link rel="canonical" href="{url}/">',
        f'<link rel="alternate" hreflang="fr" href="{url}/">',
        f'<link rel="alternate" hreflang="en" href="{url}/?lang=en">',
        f'<link rel="alternate" hreflang="x-default" href="{url}/">',
        '<meta property="og:type" content="profile">',
        '<meta property="profile:first_name" content="Ménélik">',
        '<meta property="profile:last_name" content="Tatiodjio Fomene">',
        f'<meta property="og:site_name" content="{html.escape(site["brand"])}">',
        f'<meta property="og:title" content="{title}">',
        f'<meta property="og:description" content="{desc}">',
        f'<meta property="og:url" content="{url}/">',
        f'<meta property="og:image" content="{url}/og.png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="Objet en verre 3D en forme de courbe de croissance, sur fond bleu nuit et or">',
        '<meta property="og:locale" content="fr_FR">',
        '<meta property="og:locale:alternate" content="en_GB">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{title}">',
        f'<meta name="twitter:description" content="{desc}">',
        f'<meta name="twitter:image" content="{url}/og.png">',
        '<script type="application/ld+json">' + json.dumps(person, ensure_ascii=False) + '</script>',
        tag,
    ])


# ------------------------------------------------------------------------ side files
LEGAL_SHELL = """<!DOCTYPE html>
<html lang="fr" class="legal">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} | Ménélik Tatiodjio Fomene</title>
<meta name="description" content="{description}">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="{url}/{file}">
<link rel="icon" href="./assets/brand/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="./css/fonts.css">
<link rel="stylesheet" href="./css/portfolio.css?v={version}">
</head>
<body class="legal-page">
<header class="legal-header">
  <a class="brand legal-brand" href="./index.html"><span class="brand-mark" aria-hidden="true">{mark}</span><span class="brand-text">Ménélik Tatiodjio</span></a>
  <a class="cta-btn" href="./index.html">Retour au site</a>
</header>
<main class="legal-main">
<h1>{title}</h1>
{body}
</main>
<footer class="legal-footer">
  <span>© {year} · Ménélik Tatiodjio Fomene</span>
  <span><a href="./mentions-legales.html">Mentions légales</a> · <a href="./confidentialite.html">Confidentialité</a></span>
</footer>
</body>
</html>
"""


def legal_pages(out, config, version, mark_svg):
    email = config['EMAIL']
    mail = f'<a href="mailto:{email}">{email}</a>'
    todo = '<span class="todo">[À compléter]</span>'
    mentions = f"""
<p class="legal-updated">Dernière mise à jour : {TODAY.strftime('%d/%m/%Y')}</p>
<h2>Éditeur du site</h2>
<p>Ce site est le portfolio personnel de Ménélik René Tatiodjio Fomene, particulier.</p>
<ul>
  <li>Adresse : {todo} <!-- TODO: adresse postale. Un particulier non professionnel peut, selon l'article 6 de la LCEN, ne publier que les coordonnées de son hébergeur, à condition de lui avoir communiqué son identité. Vérifie et choisis. --></li>
  <li>Contact : {mail}</li>
  <li>Directeur de la publication : Ménélik René Tatiodjio Fomene</li>
</ul>
<h2>Hébergeur</h2>
<ul>
  <li>Raison sociale : {todo} <!-- TODO: nom de l'hébergeur (par exemple Netlify ou Vercel) --></li>
  <li>Adresse : {todo} <!-- TODO: adresse postale de l'hébergeur, à recopier depuis ses propres mentions légales --></li>
  <li>Contact : {todo} <!-- TODO: téléphone ou formulaire de contact de l'hébergeur --></li>
</ul>
<h2>Propriété intellectuelle</h2>
<p>Les textes et contenus de ce site appartiennent à Ménélik René Tatiodjio Fomene. Toute reproduction sans autorisation écrite est interdite.</p>
<p>Le rendu 3D utilise la bibliothèque Three.js (licence MIT) et la police Space Grotesk (SIL Open Font License). Les licences complètes figurent dans le dossier <a href="./licenses/Three-MIT.txt">licenses</a>.</p>
<h2>Données personnelles</h2>
<p>Voir la page <a href="./confidentialite.html">Confidentialité</a>.</p>
"""
    privacy = f"""
<p class="legal-updated">Dernière mise à jour : {TODAY.strftime('%d/%m/%Y')}</p>
<h2>Responsable du traitement</h2>
<p>Ménélik René Tatiodjio Fomene, joignable à l'adresse {mail}.</p>
<h2>Aucun cookie, aucun traceur publicitaire</h2>
<p>Ce site ne dépose aucun cookie et n'intègre aucun outil publicitaire ni réseau social tiers. C'est pourquoi aucun bandeau de consentement ne s'affiche.</p>
<h2>Formulaire de contact</h2>
<p>Le formulaire n'envoie rien à un serveur. Il ouvre votre messagerie avec un message prérempli, que vous restez libre d'envoyer ou non. Si vous m'écrivez, votre nom, votre adresse e-mail, le nom de votre entreprise et votre message servent uniquement à vous répondre. Ils ne sont ni revendus ni transmis à des tiers.</p>
<p>Durée de conservation : {todo} <!-- TODO: indique combien de temps tu gardes les e-mails reçus (par exemple 3 ans après le dernier échange). --></p>
<h2>Préférence de langue</h2>
<p>Votre choix entre français et anglais est mémorisé dans le stockage local de votre navigateur (localStorage). Cette information ne contient aucune donnée personnelle et ne quitte pas votre appareil.</p>
<h2>Mesure d'audience</h2>
<p>{todo} <!-- TODO: si tu actives Plausible ou Umami (config.json), écris ici : « Ce site utilise [Plausible / Umami], un outil de mesure d'audience sans cookie qui ne collecte que des statistiques agrégées et anonymes. » Sinon, écris : « Ce site n'utilise aucun outil de mesure d'audience. » --></p>
<h2>Hébergement</h2>
<p>Comme tout serveur web, l'hébergeur peut enregistrer des journaux techniques (adresse IP, date, page demandée) pour assurer la sécurité du service. {todo} <!-- TODO: nom de l'hébergeur et lien vers sa politique de confidentialité. --></p>
<h2>Vos droits</h2>
<p>Vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition sur vos données. Pour l'exercer, écrivez à {mail}. Vous pouvez aussi adresser une réclamation à la CNIL (<a href="https://www.cnil.fr" rel="noopener">cnil.fr</a>).</p>
"""
    url = config['SITE_URL'].rstrip('/')
    for file, title, description, body in (
            ('mentions-legales.html', 'Mentions légales', 'Mentions légales du portfolio de Ménélik Tatiodjio Fomene.', mentions),
            ('confidentialite.html', 'Confidentialité', 'Politique de confidentialité du portfolio de Ménélik Tatiodjio Fomene.', privacy)):
        (out / file).write_text(LEGAL_SHELL.format(title=title, description=description, url=url, file=file,
                                                   version=version, mark=mark_svg, body=body.strip(),
                                                   year=TODAY.year), encoding='utf-8')


def placeholder_pdf(path: pathlib.Path):
    """A one-page PDF saying the CV is coming. Replace it with the real CV."""
    text = 'CV a venir / CV coming soon. Remplacer assets/cv.pdf par le vrai CV.'
    stream = f'BT /F1 18 Tf 72 760 Td ({text}) Tj ET'.encode('latin-1')
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    pdf, offsets = bytearray(b'%PDF-1.4\n'), []
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n'
    xref = len(pdf)
    pdf += f'xref\n0 {len(objects) + 1}\n0000000000 65535 f \n'.encode()
    pdf += b''.join(f'{o:010d} 00000 n \n'.encode() for o in offsets)
    pdf += f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    path.write_bytes(bytes(pdf))


def netlify_toml(csp):
    return f"""# Netlify : dossier publié = ce dossier. Généré par build.py, ne pas éditer à la main.
[build]
  publish = "."

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    Cross-Origin-Opener-Policy = "same-origin"

# CSP stricte sur les pages servies (hashes des scripts inline calculés par build.py).
[[headers]]
  for = "/"
  [headers.values]
    Content-Security-Policy = "{csp}"
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/index.html"
  [headers.values]
    Content-Security-Policy = "{csp}"
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/mentions-legales.html"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"

[[headers]]
  for = "/confidentialite.html"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"

[[headers]]
  for = "/assets/fonts/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/vendor/*"
  [headers.values]
    Cache-Control = "public, max-age=604800"

[[headers]]
  for = "/css/*"
  [headers.values]
    Cache-Control = "public, max-age=86400"

[[headers]]
  for = "/js/*"
  [headers.values]
    Cache-Control = "public, max-age=86400"

[[headers]]
  for = "/assets/shapes/*"
  [headers.values]
    Cache-Control = "public, max-age=3600"
"""


README_DEPLOY = """# Mise en ligne (Netlify ou Vercel)

1. Déploiement : sur app.netlify.com, « Add new site » puis « Deploy manually », glisse le dossier `portfolio-menelik/` (ou relie le dépôt GitHub avec « Base directory » = `portfolio-menelik`). Vercel : « New Project », même dossier, preset « Other ».
2. Avant chaque mise en ligne : modifie `portfolio-menelik-source/config.json` (e-mail, domaine, LinkedIn, Cal.com), puis `python3 build.py` dans `portfolio-menelik-source/`.
3. Domaine : achète-le chez un registrar (OVHcloud, Gandi, Namecheap…), compte 10 à 20 € par an pour un .com ou un .fr.
4. Dans Netlify : Domain management, « Add a domain », saisis ton domaine.
5. DNS chez le registrar : enregistrement `A` de `@` vers l'IP indiquée par Netlify, `CNAME` de `www` vers `ton-site.netlify.app` (ou délègue les DNS à Netlify).
6. Vercel : mêmes étapes, enregistrements affichés dans Settings, Domains.
7. HTTPS : certificat Let's Encrypt automatique et gratuit, actif quelques minutes après la propagation DNS (jusqu'à 24 h).
8. Vérifie ensuite : https://ton-domaine, `/robots.txt`, `/sitemap.xml`, puis déclare le sitemap dans Google Search Console.
9. Les en-têtes de sécurité et de cache sont dans `netlify.toml` (régénéré par build.py ; Vercel les ignore, ajoute un `vercel.json` si besoin).
10. `version-monofichier.html` sert à l'envoi par e-mail ou à l'ouverture hors ligne, pas à l'hébergement.
"""


# ------------------------------------------------------------------------------ main
def main(argv):
    out = pathlib.Path(argv[argv.index('--out') + 1]).expanduser() if '--out' in argv else HERE.parent / 'portfolio-menelik'
    out = out.resolve()
    if not (SKILL_TEMPLATE / 'tools/build_site.py').exists():
        raise SystemExit(f'premium-3d-glass template not found at {SKILL_TEMPLATE} (set PREMIUM_GLASS_TEMPLATE)')

    site = json.loads((HERE / 'site.json').read_text(encoding='utf-8'))
    config = json.loads((HERE / 'config.json').read_text(encoding='utf-8'))
    content = json.loads((HERE / 'content.json').read_text(encoding='utf-8'))
    dicts = build_dicts(site, content)
    fr, en = dicts['fr'], dicts['en']

    with tempfile.TemporaryDirectory(prefix='glass-stage-') as tmp:
        stage = pathlib.Path(tmp) / 'template'
        shutil.copytree(SKILL_TEMPLATE, stage, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        shutil.copytree(HERE / 'overlay', stage, dirs_exist_ok=True)
        apply_patches(stage)

        # Brief for the engine: FR text, typography and escaping applied, single e-mail.
        brief = transform(copy.deepcopy(site), 'fr')
        brief['title'] = transform(site['title'], 'fr', raw=True).replace('&', '&amp;')
        brief['meta_description'] = transform(site['meta_description'], 'fr', raw=True).replace('&', '&amp;')
        for key in ('name_placeholder', 'email_placeholder', 'company_placeholder', 'project_placeholder'):
            brief['form'][key] = html.escape(transform(site['form'][key], 'fr', raw=True), quote=True)
        brief['email'] = config['EMAIL']
        brief_path = pathlib.Path(tmp) / 'brief.json'
        brief_path.write_text(json.dumps(brief, ensure_ascii=False), encoding='utf-8')
        subprocess.run([sys.executable, str(stage / 'tools/build_site.py'), str(brief_path), '--out', str(out)],
                       check=True)

    # Tokens [[...]] in index.html
    index_path = out / 'index.html'
    page = index_path.read_text(encoding='utf-8')
    template_html = (SKILL_TEMPLATE / 'index.html').read_text(encoding='utf-8')
    loader = loader_script(template_html)
    has_photo = (HERE / 'assets/photo.jpg').exists()
    blocks = {
        'HEAD_SEO': head_seo(site, en, config),
        'BOOT_SCRIPT': BOOT_SCRIPT,
        'LOADER_SCRIPT': loader,
        'SECTION_PROJECTS': projects_section(fr, content),
        'SECTION_PATH': path_section(fr, content, has_photo),
        'CONTACT_EXTRAS': contact_extras(fr, config),
    }
    for key, value in blocks.items():
        page = page.replace(f'[[{key}]]', value)
    page = re.sub(r'\[\[(ui\.\w+)\]\]', lambda m: str(lookup(fr, m.group(1))), page)
    leftover = re.findall(r'\[\[[^\]]+\]\]', page)
    if leftover:
        raise SystemExit(f'unfilled tokens: {leftover}')
    # Engine footer separator is an em dash: the copy rules forbid it.
    if '\u2014' in page or '&mdash;' in page or '\u2013' in page or '&ndash;' in page:
        raise SystemExit('em or en dash found in index.html')
    index_path.write_text(page, encoding='utf-8')

    # Every data-i18n key must exist in both languages.
    for attr in re.findall(r'data-i18n(?:-title)?="([^"]+)"', page) + \
            [k.split(':', 1)[1] for a in re.findall(r'data-i18n-attr="([^"]+)"', page) for k in a.split(';')]:
        for lang in ('fr', 'en'):
            try:
                lookup(dicts[lang], attr)
            except (KeyError, IndexError, ValueError):
                raise SystemExit(f'missing {lang} translation for {attr}')

    # i18n dictionary
    (out / 'js/i18n.js').write_text(
        '// Generated by build.py from site.json and content.json. Edit those, then rebuild.\n'
        'window.PORTFOLIO_I18N = ' + json.dumps(dicts, ensure_ascii=False, indent=1) + ';\n'
        'window.PORTFOLIO_SITE_URL = ' + json.dumps(config['SITE_URL'].rstrip('/')) + ';\n',
        encoding='utf-8')

    # Assets: favicon, photo, CV, OG image
    mark = (out / 'assets/brand/mark.svg').read_text(encoding='utf-8')
    (out / 'assets/brand/favicon.svg').write_text(
        mark.replace('fill="currentColor"', 'fill="#f1c966"').replace('<title>Mark</title>', ''), encoding='utf-8')
    mark_inline = re.sub(r'<title>.*?</title>', '', mark)
    if has_photo:
        shutil.copyfile(HERE / 'assets/photo.jpg', out / 'assets/photo.jpg')
    cv_source = HERE / 'assets/cv.pdf'
    if cv_source.exists():
        shutil.copyfile(cv_source, out / config['CV_PATH'])
    else:
        placeholder_pdf(out / config['CV_PATH'])
    if (HERE / 'assets/og.png').exists():
        shutil.copyfile(HERE / 'assets/og.png', out / 'og.png')

    version = re.search(r'styles\.css\?v=(\d+)', page).group(1)
    legal_pages(out, config, version, mark_inline)

    url = config['SITE_URL'].rstrip('/')
    (out / 'robots.txt').write_text(
        f'User-agent: *\nAllow: /\nDisallow: /version-monofichier.html\n\nSitemap: {url}/sitemap.xml\n', encoding='utf-8')
    (out / 'sitemap.xml').write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>{url}/</loc>
    <lastmod>{TODAY.isoformat()}</lastmod>
    <xhtml:link rel="alternate" hreflang="fr" href="{url}/"/>
    <xhtml:link rel="alternate" hreflang="en" href="{url}/?lang=en"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="{url}/"/>
  </url>
  <url>
    <loc>{url}/?lang=en</loc>
    <lastmod>{TODAY.isoformat()}</lastmod>
    <xhtml:link rel="alternate" hreflang="fr" href="{url}/"/>
    <xhtml:link rel="alternate" hreflang="en" href="{url}/?lang=en"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="{url}/"/>
  </url>
</urlset>
""", encoding='utf-8')

    # CSP: hashes of every executable inline script (JSON-LD is data, not executed).
    inline = re.findall(r'<script(?: type="importmap")?>(.*?)</script>', page, re.S)
    analytics = config['ANALYTICS']
    extra = ''
    if analytics.get('enabled'):
        src = analytics['umami_src'] if analytics['provider'] == 'umami' else analytics['plausible_src']
        extra = ' ' + re.match(r'https?://[^/]+', src).group(0)
    csp = ("default-src 'self'; script-src 'self' " + ' '.join(csp_hash(s) for s in inline) + extra +
           "; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'" + extra +
           "; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
    (out / 'netlify.toml').write_text(netlify_toml(csp), encoding='utf-8')
    (out / 'README-DEPLOY.md').write_text(README_DEPLOY, encoding='utf-8')
    (out / 'README.md').write_text(
        '# Portfolio Ménélik Tatiodjio Fomene\n\n'
        'Dossier généré : ne l\'édite pas à la main. Sources dans `../portfolio-menelik-source/` '
        '(`site.json`, `content.json`, `config.json`), puis `python3 build.py`.\n\n'
        'Voir le site : `python3 serve.py 5180` puis http://127.0.0.1:5180. '
        '`version-monofichier.html` s\'ouvre directement, sans serveur.\n'
        'Mise en ligne : `README-DEPLOY.md`.\n', encoding='utf-8')
    # Engine authoring tools are not needed to host the site.
    shutil.rmtree(out / 'tools', ignore_errors=True)

    subprocess.run([sys.executable, str(out / 'build_monofichier.py')], check=True, cwd=out)
    print(f'portfolio written to {out}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
