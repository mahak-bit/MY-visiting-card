/* ============================================================================
   app.js — renders the landing page from config/profile.js.

   Everything on the page comes from PROFILE. There is no copy in this file and
   no copy hard-coded in index.html's body, so editing the config is the only
   step needed to update the page.

   All text is written with textContent, never innerHTML: config values are
   treated as data, so a stray angle bracket in a project description can never
   become markup.
   ========================================================================== */

(function () {
  'use strict';

  var P = window.PROFILE;

  /* --- small helpers ---------------------------------------------------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function setText(id, value) {
    var n = document.getElementById(id);
    if (n && value != null) { n.textContent = value; }
  }

  /* A value is an unfilled placeholder when it is wrapped in [SQUARE BRACKETS]. */
  function isPlaceholder(s) {
    return typeof s === 'string' && /\[[^\]]+\]/.test(s);
  }

  function isConfigured(link) {
    return typeof link.url === 'string' && link.url.trim() !== '' && !isPlaceholder(link.url);
  }

  /* Accept a bare address or a full mailto: in the config. */
  function hrefFor(link) {
    var v = link.url.trim();
    if (link.kind === 'email') { return /^mailto:/i.test(v) ? v : 'mailto:' + v; }
    return v;
  }

  /* --- head + hero ------------------------------------------------------ */

  function renderMeta() {
    if (P.meta && P.meta.pageTitle) { document.title = P.meta.pageTitle; }
    var d = document.querySelector('meta[name="description"]');
    if (d && P.meta && P.meta.description) { d.setAttribute('content', P.meta.description); }
  }

  function renderHero() {
    setText('name', P.name);
    setText('title', P.title);
    setText('focus', P.focus);
    setText('tagline', P.tagline);
    setText('intro', P.intro);
  }

  /* --- links ------------------------------------------------------------ */

  function renderLinks() {
    var list = document.getElementById('links');
    if (!list || !Array.isArray(P.links)) { return; }
    list.textContent = '';

    var liveCount = 0;
    /* The ink fill marks the lead destination. Give it to the first link that
       actually works, so the emphasis never lands on a disabled row while the
       config is still being filled in. */
    var primaryKey = (P.links.filter(isConfigured)[0] || {}).key;

    P.links.forEach(function (link, i) {
      var li = el('li');
      var configured = isConfigured(link);
      if (configured) { liveCount++; }

      /* A configured destination is an anchor. An unconfigured one is a
         <div>: not focusable, not clickable, impossible to follow. */
      var row = document.createElement(configured ? 'a' : 'div');
      row.className = 'link' + (configured && link.key === primaryKey ? ' link--primary' : '') +
                      (configured ? '' : ' link--pending');

      if (configured) {
        row.href = hrefFor(link);
        if (link.kind !== 'email') {
          row.target = '_blank';
          row.rel = 'noopener noreferrer';
        }
      } else {
        row.setAttribute('role', 'link');
        row.setAttribute('aria-disabled', 'true');
      }

      var body = el('span', 'link__body');
      body.appendChild(el('span', 'link__label', link.label));
      body.appendChild(el('span', 'link__meta', configured ? link.meta : (link.hint || 'Not configured yet')));
      row.appendChild(body);

      if (configured) {
        var arrow = el('span', 'link__arrow', '↗');   /* ↗ */
        arrow.setAttribute('aria-hidden', 'true');
        row.appendChild(arrow);
      } else {
        row.appendChild(el('span', 'chip', 'Not configured'));
      }

      li.appendChild(row);
      list.appendChild(li);
    });

    setText('links-count', liveCount + ' of ' + P.links.length + ' live');
  }

  /* --- projects --------------------------------------------------------- */

  function renderProjects() {
    var list = document.getElementById('projects');
    if (!list || !Array.isArray(P.projects)) { return; }
    list.textContent = '';

    var placeholders = 0;

    P.projects.forEach(function (p) {
      var placeholder = isPlaceholder(p.title);
      if (placeholder) { placeholders++; }

      var li = el('li', 'project' + (placeholder ? ' project--placeholder' : ''));

      /* Screenshot of the live site, when one is supplied. Dimensions are set
         so the card reserves its space before the image arrives — no reflow. */
      if (p.image && !isPlaceholder(p.image)) {
        var img = document.createElement('img');
        img.className = 'project__shot';
        img.src = p.image;
        img.alt = p.imageAlt || ('Screenshot of the ' + p.title + ' website');
        img.loading = 'lazy';
        img.decoding = 'async';
        img.width = 1000;
        img.height = 625;
        li.appendChild(img);
      }

      var body = el('div', 'project__body');

      var head = el('div', 'project__head');
      head.appendChild(el('h3', 'project__title', p.title));
      if (p.year) { head.appendChild(el('span', 'project__year', p.year)); }
      body.appendChild(head);

      if (p.summary) { body.appendChild(el('p', 'project__summary', p.summary)); }

      if (Array.isArray(p.stack) && p.stack.length) {
        var ul = el('ul', 'project__stack');
        p.stack.forEach(function (s) { ul.appendChild(el('li', 'tag', s)); });
        body.appendChild(ul);
      }

      if (typeof p.url === 'string' && p.url.trim() && !isPlaceholder(p.url)) {
        var a = el('a', 'project__link', 'Visit live site ↗');
        a.href = p.url.trim();
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        body.appendChild(a);
      }

      li.appendChild(body);
      list.appendChild(li);
    });

    setText('projects-count', placeholders === 0
      ? P.projects.length + ' projects'
      : placeholders + ' to complete');

    /* Only explain the placeholders while some are still unfilled. */
    var note = document.getElementById('projects-note');
    if (note) { note.hidden = placeholders === 0; }
  }

  /* --- footer ----------------------------------------------------------- */

  function renderFooter() {
    var a = document.getElementById('foot-handle');
    if (!a) { return; }
    var gh = (P.links || []).filter(function (l) { return l.key === 'github'; })[0];
    a.textContent = P.githubHandle || '';
    if (gh && isConfigured(gh)) {
      a.href = gh.url.trim();
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    } else {
      a.removeAttribute('href');
    }
    setText('foot-name', P.name);
  }

  /* --- go --------------------------------------------------------------- */

  function init() {
    if (!P) {
      document.body.textContent = 'config/profile.js did not load.';
      return;
    }
    renderMeta();
    renderHero();
    renderLinks();
    renderProjects();
    renderFooter();
    document.documentElement.setAttribute('data-ready', 'true');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
