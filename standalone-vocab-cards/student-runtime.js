/**
 * Student vocab viewer runtime.
 * Each HTML page sets window.VOCAB_SET before loading this script.
 */

(function () {
  const config = window.VOCAB_SET;
  if (!config || !Array.isArray(config.cards)) {
    document.body.innerHTML = '<p style="padding:24px;font-family:system-ui">Missing vocabulary data.</p>';
    return;
  }

  const title = String(config.title || 'Vocabulary').trim();
  const cards = config.cards
    .map((c, i) => ({
      id: 'c' + i,
      front: String(c.front ?? '').trim(),
      back: String(c.back ?? '').trim(),
    }))
    .filter(c => c.front || c.back);

  const root = document.getElementById('root');
  const THEME_KEY = 'vocab-theme';
  let view = 'list';
  let presenterCleanup = null;
  let quizCleanup = null;

  function readTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  let theme = readTheme();

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function syncThemeToggleLabels() {
    document.querySelectorAll('[data-theme-toggle]').forEach(node => {
      node.textContent = theme === 'dark' ? 'Light' : 'Dark';
      node.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, theme);
    applyTheme();
    syncThemeToggleLabels();
  }

  function themeToggleButton(className) {
    return el('button', {
      type: 'button',
      className: className ? className : 'btn btn--theme',
      'data-theme-toggle': true,
      'aria-label': theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      onClick: toggleTheme,
    }, theme === 'dark' ? 'Light' : 'Dark');
  }

  function pageHeader(subtitle) {
    return el('div', { className: 'page-header' },
      el('header', { className: 'app-header app-header--compact' },
        el('h1', null, title),
        el('p', null, subtitle),
      ),
      themeToggleButton('btn btn--theme'),
    );
  }

  function shuffleCards(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickTermChoices(pool, correct, count = 4) {
    const wrong = shuffleCards(pool.filter(c => c.id !== correct.id)).slice(0, count - 1);
    const choices = shuffleCards([correct, ...wrong]);
    while (choices.length < count) {
      choices.push({ id: 'pad_' + choices.length, front: '—', back: '—' });
    }
    return choices.slice(0, count);
  }

  function pageDelta(key) {
    switch (key) {
      case 'PageDown': case 'ArrowRight': case 'ArrowDown': case ' ': case 'MediaTrackNext': return 1;
      case 'PageUp': case 'ArrowLeft': case 'ArrowUp': case 'MediaTrackPrevious': return -1;
      default: return 0;
    }
  }

  function requestFullscreen(el) {
    if (!el) return Promise.resolve();
    if (el.requestFullscreen) return el.requestFullscreen().catch(() => {});
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    return Promise.resolve();
  }

  function exitFullscreen() {
    if (document.fullscreenElement && document.exitFullscreen) return document.exitFullscreen().catch(() => {});
    if (document.webkitFullscreenElement && document.webkitExitFullscreen) return document.webkitExitFullscreen();
    return Promise.resolve();
  }

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === 'className') node.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v != null && v !== false) node.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const child of children.flat()) {
      if (child == null) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  }

  function btn(label, opts = {}) {
    const classes = ['btn'];
    if (opts.variant === 'primary') classes.push('btn--primary');
    if (opts.className) classes.push(opts.className);
    return el('button', {
      type: 'button',
      className: classes.join(' '),
      onClick: opts.onClick,
      disabled: opts.disabled || undefined,
    }, label);
  }

  function goToList() {
    if (presenterCleanup) {
      presenterCleanup();
      presenterCleanup = null;
    }
    if (quizCleanup) {
      quizCleanup();
      quizCleanup = null;
    }
    view = 'list';
    render();
  }

  function topNav(active) {
    return el('nav', { className: 'top-nav' },
      btn('Flashcards', {
        className: active === 'flashcards' ? 'btn--primary' : '',
        disabled: !cards.length,
        onClick: () => { view = 'flashcards'; render(); },
      }),
      btn('Practice quiz', {
        className: active === 'quiz' ? 'btn--primary' : '',
        disabled: cards.length < 4,
        onClick: () => { view = 'quiz'; render(); },
      }),
    );
  }

  function renderList() {
    root.innerHTML = '';

    root.appendChild(pageHeader(cards.length + ' vocabulary terms'));
    root.appendChild(topNav('list'));

    if (cards.length < 4) {
      root.appendChild(el('p', { className: 'hint hint--nav' }, 'Practice quiz needs at least 4 terms.'));
    }

    const list = el('ul', { className: 'vocab-list' });
    cards.forEach(c => {
      list.appendChild(el('li', { className: 'vocab-list__item' },
        el('div', { className: 'vocab-list__term' }, c.front),
        el('div', { className: 'vocab-list__def' }, c.back),
      ));
    });

    root.appendChild(el('div', { className: 'panel' }, list));
  }

  function renderFlashcards() {
    root.innerHTML = '';
    const container = el('div', { className: 'presenter' });
    root.appendChild(container);

    let deck = shuffleCards(cards);
    let index = 0;
    let cyclePhase = 'term';

    function current() { return deck[index]; }
    function done() { return index >= deck.length; }

    function paint() {
      container.innerHTML = '';
      const canGoBack = cyclePhase === 'def' || index > 0;

      const bar = el('header', { className: 'presenter__bar' },
        el('span', null, title),
        el('span', null, done() ? '' : (index + 1) + ' / ' + deck.length),
        el('span', null, 'Flashcards'),
        el('div', { className: 'presenter__bar-actions' },
          themeToggleButton('presenter__theme'),
          el('button', { type: 'button', className: 'presenter__exit', onClick: goToList }, 'Exit'),
        ),
      );

      if (!deck.length) {
        container.append(bar, el('p', { className: 'presenter__hint', style: { margin: 'auto' } }, 'No terms in this set.'));
        return;
      }

      if (done()) {
        container.append(
          bar,
          el('h2', { className: 'presenter__done' }, 'End of set'),
          el('p', { className: 'presenter__hint' }, title),
          el('div', { className: 'presenter__actions' },
            btn('Start over', {
              className: 'btn--primary presenter__nav-btn presenter__nav-btn--primary',
              onClick: () => { index = 0; cyclePhase = 'term'; deck = shuffleCards(cards); paint(); },
            }),
            btn('Back to list', { className: 'presenter__nav-btn', onClick: goToList }),
          ),
        );
        return;
      }

      const cur = current();
      const nav = el('div', { className: 'presenter__nav' },
        el('button', {
          type: 'button',
          className: 'presenter__nav-btn',
          disabled: !canGoBack || undefined,
          onClick: cycleBack,
        }, '← Back'),
        el('button', {
          type: 'button',
          className: 'presenter__nav-btn presenter__nav-btn--primary',
          onClick: cycleForward,
        }, cyclePhase === 'term' ? 'Show definition →' : 'Next card →'),
      );

      container.append(
        bar,
        el('p', { className: 'presenter__label' }, cyclePhase === 'term' ? 'Term' : 'Definition'),
        el('div', { className: 'presenter__prompt' }, cyclePhase === 'term' ? cur.front : cur.back),
        el('p', { className: 'presenter__hint' }, 'Page Down = forward · Page Up = back'),
        nav,
      );
    }

    function goNextCard() {
      index++;
      cyclePhase = 'term';
      paint();
    }

    function goPrevCard() {
      index = Math.max(0, index - 1);
      cyclePhase = 'term';
      paint();
    }

    function cycleForward() {
      if (cyclePhase === 'term') { cyclePhase = 'def'; paint(); }
      else goNextCard();
    }

    function cycleBack() {
      if (cyclePhase === 'def') { cyclePhase = 'term'; paint(); }
      else if (index > 0) goPrevCard();
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        goToList();
        return;
      }
      const delta = pageDelta(e.key);
      if (delta === 0) return;
      e.preventDefault();
      if (delta === 1) cycleForward();
      else cycleBack();
    }

    window.addEventListener('keydown', onKey);
    requestFullscreen(container);
    paint();

    presenterCleanup = () => {
      window.removeEventListener('keydown', onKey);
      exitFullscreen();
    };
  }

  function renderPracticeQuiz() {
    root.innerHTML = '';

    if (cards.length < 4) {
      root.appendChild(pageHeader('Practice quiz'));
      root.appendChild(topNav('quiz'));
      root.appendChild(el('div', { className: 'panel' },
        el('p', null, 'Practice quiz needs at least 4 terms in this set.'),
        btn('Back to list', { onClick: goToList, style: { marginTop: '16px' } }),
      ));
      return;
    }

    const wrap = el('div', { className: 'quiz' });
    root.appendChild(wrap);

    let deck = shuffleCards(cards);
    let index = 0;
    let score = 0;
    let missed = [];
    let choices = [];
    let pickedId = null;
    let choiceIndex = 0;

    function current() { return deck[index]; }
    function done() { return index >= deck.length; }

    function refreshChoices() {
      if (current() && !done()) {
        choices = pickTermChoices(cards, current());
        pickedId = null;
        choiceIndex = 0;
      }
    }

    function submitChoice(ch) {
      if (!ch || pickedId) return;
      pickedId = ch.id;
      const cur = current();
      const correct = ch.id === cur.id;
      if (correct) score++;
      else missed.push(cur);
      paint();
      setTimeout(() => {
        index++;
        refreshChoices();
        paint();
      }, 900);
    }

    function paint() {
      wrap.innerHTML = '';

      if (done()) {
        const pct = Math.round((score / deck.length) * 100);
        const results = el('div', { className: 'quiz-results' },
          pageHeader('Quiz results'),
          topNav('quiz'),
          el('div', { className: 'panel quiz-results__panel' },
            el('p', { className: 'quiz-results__score' }, 'Score: ' + score + ' / ' + deck.length),
            el('p', { className: 'quiz-results__pct' }, pct + '% correct'),
          ),
        );

        if (missed.length) {
          results.appendChild(el('div', { className: 'panel quiz-missed' },
            el('h2', { className: 'quiz-missed__title' }, 'Terms to study'),
            el('p', { className: 'hint' }, 'Review these before your next attempt:'),
            el('ul', { className: 'vocab-list' },
              ...missed.map(c => el('li', { className: 'vocab-list__item' },
                el('div', { className: 'vocab-list__term' }, c.front),
                el('div', { className: 'vocab-list__def' }, c.back),
              )),
            ),
          ));
        } else {
          results.appendChild(el('div', { className: 'panel quiz-perfect' },
            el('p', null, 'Perfect score — nice work!'),
          ));
        }

        results.appendChild(el('div', { className: 'quiz-results__actions' },
          btn('Try again', {
            variant: 'primary',
            onClick: () => {
              deck = shuffleCards(cards);
              index = 0;
              score = 0;
              missed = [];
              refreshChoices();
              paint();
            },
          }),
          btn('Back to list', { onClick: goToList }),
        ));

        wrap.appendChild(results);
        return;
      }

      const cur = current();
      wrap.appendChild(pageHeader('Question ' + (index + 1) + ' of ' + deck.length));
      wrap.appendChild(topNav('quiz'));

      wrap.appendChild(el('p', { className: 'quiz__label' }, 'Definition'));
      wrap.appendChild(el('div', { className: 'quiz__prompt panel' }, cur.back));

      const choiceWrap = el('div', { className: 'quiz__choices' });
      choices.forEach((ch, i) => {
        const isCorrect = ch.id === cur.id;
        const isPicked = pickedId === ch.id;
        let cls = 'btn quiz__choice';
        if (pickedId) {
          if (isCorrect) cls += ' quiz__choice--correct';
          else if (isPicked) cls += ' quiz__choice--wrong';
        } else if (i === choiceIndex) {
          cls += ' quiz__choice--highlight';
        }
        choiceWrap.appendChild(el('button', {
          type: 'button',
          className: cls,
          disabled: !!pickedId || undefined,
          onClick: () => submitChoice(ch),
        }, el('strong', null, (i + 1) + '. '), ch.front));
      });

      wrap.appendChild(choiceWrap);
      wrap.appendChild(el('p', { className: 'hint hint--center' },
        pickedId ? 'Next question…' : 'Pick the term that matches the definition'));
      wrap.appendChild(btn('Exit quiz', { className: 'quiz__exit', onClick: goToList }));
    }

    function onKey(e) {
      if (done() || pickedId) return;
      const delta = pageDelta(e.key);
      if (delta !== 0) {
        e.preventDefault();
        const n = choices.length || 4;
        choiceIndex = delta === 1 ? (choiceIndex + 1) % n : (choiceIndex - 1 + n) % n;
        paint();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        submitChoice(choices[choiceIndex]);
      }
    }

    window.addEventListener('keydown', onKey);
    refreshChoices();
    paint();

    quizCleanup = () => window.removeEventListener('keydown', onKey);
  }

  function render() {
    if (presenterCleanup) {
      presenterCleanup();
      presenterCleanup = null;
    }
    if (quizCleanup) {
      quizCleanup();
      quizCleanup = null;
    }

    if (view === 'flashcards') renderFlashcards();
    else if (view === 'quiz') renderPracticeQuiz();
    else renderList();
  }

  applyTheme();
  document.title = title;
  render();
})();
