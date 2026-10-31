(() => {
  'use strict';
  const DOCS = window.RUN_DOCS || {};
  const ASSETS = window.RUN_ASSETS || {};
  const $ = selector => document.querySelector(selector);
  const article = $('#article');
  const nav = $('#nav');
  const search = $('#search');
  let activePage = 'README.md';
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (isIos && !isStandalone) $('#install-hint').hidden = false;

  const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const stripMarkup = value => String(value).replace(/[`*_~]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
  function titleFor(key) {
    const source = DOCS[key] || '';
    const heading = source.match(/^#\s+(.+)$/m);
    if (heading) return stripMarkup(heading[1].replace(/\s+#+\s*$/, ''));
    const name = key.split('/').pop().replace(/\.(md|csv)$/i, '').replace(/[-_]/g, ' ');
    return name || key;
  }
  function fileTitle(key) { return titleFor(key).replace(/\s+/g, ' ').trim(); }
  function pageHash(key, section = '') {
    const params = new URLSearchParams();
    params.set('page', key);
    if (section) params.set('section', section);
    return `#${params.toString()}`;
  }
  function decodeHash() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const page = params.get('page');
    const section = params.get('section') || '';
    if (page && DOCS[page]) return { page, section };
    return { page: 'README.md', section: '' };
  }
  function normalizePath(from, href) {
    const rooted = href.startsWith('/');
    const clean = href.replace(/\\/g, '/').replace(/^\//, '');
    const parent = rooted ? '' : from.split('/').slice(0, -1).join('/');
    const parts = `${parent ? `${parent}/` : ''}${clean}`.split('/');
    const out = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') out.pop(); else out.push(part);
    }
    return out.join('/');
  }
  function linkTarget(href, from) {
    const raw = String(href || '').trim();
    if (!raw) return { external: false, page: from, section: '' };
    if (/^(https?:\/\/|mailto:)/i.test(raw)) return { external: true, href: raw };
    if (/^(javascript:|data:|file:)/i.test(raw)) return { external: false, page: from, section: '' };
    const hashIndex = raw.indexOf('#');
    const pathname = hashIndex < 0 ? raw : raw.slice(0, hashIndex);
    const section = hashIndex < 0 ? '' : decodeURIComponent(raw.slice(hashIndex + 1));
    if (!pathname) return { external: false, page: from, section };
    const page = normalizePath(from, pathname);
    if (DOCS[page]) return { external: false, page, section };
    if (ASSETS[page]) return { external: false, asset: page, section };
    return { external: true, href: `https://github.com/BryceYuuu/RUN/blob/main/${page}${section ? `#${section}` : ''}` };
  }
  function anchorAttrs(target) {
    if (target.external) return `href="${esc(target.href)}" target="_blank" rel="noopener noreferrer"`;
    return `href="${pageHash(target.page, target.section)}" data-page="${esc(target.page)}"${target.section ? ` data-section="${esc(target.section)}"` : ''}`;
  }
  function inline(text, from) {
    const code = [];
    let value = esc(text);
    value = value.replace(/`([^`]+)`/g, (_, content) => {
      const key = `\u0000C${code.length}\u0000`;
      code.push(`<code>${content}</code>`);
      return key;
    });
    value = value.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, href) => {
      const target = linkTarget(href, from);
      if (target.asset && ASSETS[target.asset]) {
        const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ASSETS[target.asset])}`;
        return `<figure class="inline-figure"><img src="${uri}" alt="${esc(alt)}"><figcaption>${esc(alt)}</figcaption></figure>`;
      }
      return `<span class="image-alt">${esc(alt || '图片')}</span>`;
    });
    value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const target = linkTarget(href, from);
      return `<a ${anchorAttrs(target)}>${label}</a>`;
    });
    value = value.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>');
    return value.replace(/\u0000C(\d+)\u0000/g, (_, index) => code[Number(index)] || '');
  }
  const allowedTags = new Set(['A','B','STRONG','EM','I','U','S','DEL','CODE','PRE','P','BR','HR','UL','OL','LI','DL','DT','DD','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','DIV','SPAN','BLOCKQUOTE','DETAILS','SUMMARY','SUB','SUP','CENTER','IMG','H1','H2','H3','H4']);
  function safeHtmlBlock(source, from) {
    if (/^\s*<!--/.test(source)) return '';
    const template = document.createElement('template');
    template.innerHTML = source;
    const elements = [...template.content.querySelectorAll('*')].reverse();
    for (const element of elements) {
      if (element.tagName === 'H1') { element.remove(); continue; }
      if (!allowedTags.has(element.tagName)) {
        element.replaceWith(...element.childNodes);
        continue;
      }
      const keep = new Set(['href','src','alt','title','width','height','align','valign','colspan','rowspan','scope','open','target']);
      for (const attribute of [...element.attributes]) if (!keep.has(attribute.name.toLowerCase())) element.removeAttribute(attribute.name);
      if (element.tagName === 'A' && element.hasAttribute('href')) {
        const target = linkTarget(element.getAttribute('href'), from);
        for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
        for (const [key, value] of Object.entries(target.external ? {href:target.href,target:'_blank',rel:'noopener noreferrer'} : {href:pageHash(target.page,target.section),'data-page':target.page,...(target.section?{'data-section':target.section}:{})})) element.setAttribute(key, value);
      }
      if (element.tagName === 'IMG') {
        const target = linkTarget(element.getAttribute('src') || '', from);
        if (target.asset && ASSETS[target.asset]) element.setAttribute('src', `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ASSETS[target.asset])}`);
        else {
          const label = document.createElement('span');
          label.className = 'image-alt'; label.textContent = element.getAttribute('alt') || '图片';
          element.replaceWith(label);
        }
      }
    }
    const textNodes = [];
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const node of textNodes) {
      const parent = node.parentElement;
      if (!parent || parent.closest('code,pre') || !/[`*_\[#]/.test(node.nodeValue)) continue;
      const html = node.nodeValue.split('\n').map(part => {
        const heading = part.match(/^\s{0,3}#{1,6}\s+(.+)$/);
        return heading ? `<strong>${inline(heading[1], from)}</strong>` : inline(part, from);
      }).join('<br>');
      const replacement = document.createElement('template'); replacement.innerHTML = html;
      node.replaceWith(replacement.content);
    }
    return template.innerHTML;
  }
  function tableCells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.replace(/\\\|/g, '|').trim());
  }
  function isTableStart(lines, i) { return i + 1 < lines.length && lines[i].includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1]); }
  function renderMarkdown(markdown, from) {
    const lines = markdown.replace(/\r/g, '').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (/^\s*```/.test(line) || /^\s*~~~/.test(line)) {
        const fence = line.trim().slice(0, 3); i++;
        const code = [];
        while (i < lines.length && !lines[i].trim().startsWith(fence)) code.push(lines[i++]);
        if (i < lines.length) i++;
        out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue;
      }
      if (/^\s*<!--/.test(line)) {
        const block = [line]; i++;
        while (i < lines.length && !block.join('\n').includes('-->')) block.push(lines[i++]);
        continue;
      }
      const htmlStart = line.match(/^\s*<(table|div|details|center|p|img|hr|ul|ol|blockquote|sub|sup)\b/i);
      if (htmlStart) {
        const block = [line]; i++;
        const tag = htmlStart[1].toLowerCase();
        const voidTag = ['img','hr'].includes(tag);
        let depth = (line.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length - (line.match(new RegExp(`</${tag}\\s*>`, 'gi')) || []).length;
        while (!voidTag && depth > 0 && i < lines.length) {
          const next = lines[i++]; block.push(next);
          depth += (next.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length - (next.match(new RegExp(`</${tag}\\s*>`, 'gi')) || []).length;
        }
        out.push(safeHtmlBlock(block.join('\n'), from)); continue;
      }
      const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (heading) {
        let text = heading[2];
        let explicit = '';
        text = text.replace(/\s*\{#([^}]+)\}\s*$/, (_, id) => { explicit = id; return ''; });
        const id = explicit || stripMarkup(text).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || `section-${i}`;
        const level = heading[1].length;
        if (level === 1 && stripMarkup(text) === fileTitle(from)) { i++; continue; }
        out.push(`<h${level} id="${esc(id)}">${inline(text, from)}</h${level}>`); i++; continue;
      }
      if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
      if (isTableStart(lines, i)) {
        const headers = tableCells(lines[i]); i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(tableCells(lines[i++]));
        const head = `<thead><tr>${headers.map(cell => `<th>${inline(cell, from)}</th>`).join('')}</tr></thead>`;
        const body = rows.map(row => `<tr>${headers.map((_, index) => `<td>${inline(row[index] || '', from)}</td>`).join('')}</tr>`).join('');
        out.push(`<div class="table-wrap"><table>${head}<tbody>${body}</tbody></table></div>`); continue;
      }
      if (/^\s*>/.test(line)) {
        const quote = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
        const label = quote[0]?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
        if (label) quote[0] = quote[0].replace(/^\[!\w+\]\s*/i, '');
        out.push(`<blockquote class="${label ? `callout callout-${label[1].toLowerCase()}` : ''}">${quote.map(q => `<p>${inline(q, from)}</p>`).join('')}</blockquote>`); continue;
      }
      if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
        const ordered = /^\s*\d+[.)]\s+/.test(line), tag = ordered ? 'ol' : 'ul';
        const items = [];
        while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/.test(lines[i]) : /^\s*[-*+]\s+/.test(lines[i]))) items.push(lines[i++].replace(/^\s*(?:[-*+] |\d+[.)] )/, ''));
        out.push(`<${tag}>${items.map(item => `<li>${inline(item, from)}</li>`).join('')}</${tag}>`); continue;
      }
      const para = [line]; i++;
      while (i < lines.length && lines[i].trim() && !/^\s*(?:#{1,6}\s|```|~~~|>|[-*+]\s|\d+[.)]\s|---+\s*$|<(?:table|div|details|center|p|img|hr|ul|ol|blockquote|sub|sup)\b)/i.test(lines[i]) && !isTableStart(lines, i)) para.push(lines[i++]);
      out.push(`<p>${para.map(part => inline(part, from)).join('<br>')}</p>`);
    }
    return out.join('\n');
  }

  const rootGroups = [
    ['开始阅读', ['README.md','docs/routes/choose-route.md','docs/europe/README.md','docs/global/README.md','docs/resources.md']],
    ['按路线查看', Object.keys(DOCS).filter(key => key.startsWith('docs/routes/') && key.endsWith('.md')).sort()],
    ['欧洲目的地', Object.keys(DOCS).filter(key => key.startsWith('docs/europe/') && key.endsWith('.md') && !key.endsWith('/README.md')).sort()],
    ['其他目的地', Object.keys(DOCS).filter(key => key.startsWith('docs/global/') && key.endsWith('.md') && !key.endsWith('/README.md')).sort()],
    ['实用指南', Object.keys(DOCS).filter(key => key.startsWith('docs/practical/') && key.endsWith('.md')).sort()],
    ['其他文件', ['DISCLAIMER.md','CONTRIBUTING.md','README.en.md','data/programmes.csv','LICENSE','LICENSE-CODE'].filter(key => DOCS[key])],
  ].map(([name, keys]) => [name, keys.filter(key => DOCS[key])]);

  function updateNav(query = '') {
    nav.innerHTML = '';
    const q = query.trim().toLocaleLowerCase();
    if (q) {
      const matches = Object.keys(DOCS).filter(key => `${fileTitle(key)}\n${DOCS[key]}`.toLocaleLowerCase().includes(q));
      const section = document.createElement('section');
      section.className = 'nav-group';
      const title = document.createElement('div'); title.className = 'nav-title'; title.textContent = `搜索结果 · ${matches.length}`; section.appendChild(title);
      if (!matches.length) {
        const empty = document.createElement('div'); empty.className = 'empty-search'; empty.textContent = '没有匹配内容'; section.appendChild(empty);
      }
      for (const key of matches.slice(0, 80)) section.appendChild(makeNavLink(key));
      nav.appendChild(section); return;
    }
    for (const [label, keys] of rootGroups) {
      if (!keys.length) continue;
      const section = document.createElement('section'); section.className = 'nav-group';
      const heading = document.createElement('div'); heading.className = 'nav-title'; heading.textContent = label; section.appendChild(heading);
      for (const key of keys) section.appendChild(makeNavLink(key));
      nav.appendChild(section);
    }
  }
  function makeNavLink(key) {
    const link = document.createElement('a');
    link.className = `nav-link${key === activePage ? ' active' : ''}`;
    link.href = pageHash(key); link.dataset.page = key; link.textContent = fileTitle(key);
    link.title = key;
    return link;
  }
  function renderArticle(key) {
    if (key.endsWith('.csv')) {
      const rows = (DOCS[key] || '').split(/\r?\n/).length - 1;
      return `<div class="csv-card"><div><strong>路线结构化数据</strong><span>${rows} 行 · CSV</span></div><a class="button-link" href="data:text/csv;charset=utf-8,${encodeURIComponent(DOCS[key] || '')}" download="programmes.csv">下载 CSV</a></div><pre class="csv-preview"><code>${esc((DOCS[key] || '').slice(0, 5000))}${(DOCS[key] || '').length > 5000 ? '\n… 预览已截断；请下载完整 CSV。' : ''}</code></pre>`;
    }
    if (key === 'LICENSE' || key === 'LICENSE-CODE') return `<pre class="license-text"><code>${esc(DOCS[key] || '')}</code></pre>`;
    return renderMarkdown(DOCS[key] || '暂无内容。', key);
  }
  function showPage(key, section = '') {
    if (!DOCS[key]) key = 'README.md';
    activePage = key;
    const title = fileTitle(key);
    $('#breadcrumb').textContent = `${key.startsWith('docs/europe/') ? '欧洲' : key.startsWith('docs/global/') ? '其他目的地' : key.startsWith('docs/routes/') ? '路线' : key.startsWith('docs/practical/') ? '实用指南' : '手册'} / ${title}`;
    const words = (DOCS[key] || '').trim().split(/\s+/).length;
    $('#readtime').textContent = key.endsWith('.md') ? `约 ${Math.max(1, Math.ceil(words / 450))} 分钟阅读` : '';
    article.innerHTML = `<h1 class="article-title">${esc(title)}</h1>${key !== 'README.md' && !key.endsWith('README.md') ? `<div class="source-path">${esc(key)}</div>` : ''}${renderArticle(key)}`;
    document.title = `${title} · RUN 离线手册`;
    updateNav(search.value);
    if (section) setTimeout(() => document.getElementById(section)?.scrollIntoView({behavior:'smooth',block:'start'}), 30);
    else window.scrollTo({top:0,behavior:'instant'});
    article.focus({preventScroll:true});
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-page]');
    if (!link) return;
    event.preventDefault();
    const key = link.dataset.page || 'README.md';
    const section = link.dataset.section || '';
    history.pushState(null, '', pageHash(key, section));
    showPage(key, section);
  });
  window.addEventListener('popstate', () => { const state = decodeHash(); showPage(state.page, state.section); });
  window.addEventListener('hashchange', () => { const state = decodeHash(); if (state.page !== activePage) showPage(state.page, state.section); });
  search.addEventListener('input', () => updateNav(search.value));
  $('#copylink').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${location.href.split('#')[0]}${pageHash(activePage)}`);
      $('#copylink').textContent = '已复制';
      setTimeout(() => { $('#copylink').textContent = '复制页面链接'; }, 1400);
    } catch { $('#copylink').textContent = '请复制地址栏'; setTimeout(() => { $('#copylink').textContent = '复制页面链接'; }, 1800); }
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); search.focus(); }
    if (event.key === 'Escape' && document.activeElement === search) { search.value = ''; updateNav(); search.blur(); }
  });
  const initial = decodeHash();
  updateNav();
  showPage(initial.page, initial.section);
})();
