/**
 * Student vocab viewer runtime.
 * Each HTML page sets window.VOCAB_SET before loading this script.
 *
 * Expected shape:
 *   window.VOCAB_SET = {
 *     title: 'Unit 1 Set 1 Historical Thinking',
 *     cards: [{ front: 'Term', back: 'Definition' }, ...]
 *   };
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
  let view = 'menu';
  let presenterCleanup = null;

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
    if (opts.variant === 'large') classes.push('btn--large');
    if (opts.className) classes.push(opts.className);
    return el('button', {
      type: 'button',
      className: classes.join(' '),
      onClick: opts.onClick,
      disabled: opts.disabled || undefined,
    }, label);
  }

  function goHome() {
    if (presenterCleanup) {
      presenterCleanup();
      presenterCleanup = null;
    }
    view = 'menu';
    render();
  }

  function renderMenu() {
    root.innerHTML = '';
    root.appendChild(el('header', { className: 'app-header' },
      el('h1', null, title),
      el('p', null, cards.length + ' vocabulary terms'),
    ));

    const panel = el('div', { className: 'panel menu-panel' },
      el('p', { className: 'menu-lead' }, 'Choose how you want to study:'),
      el('div', { className: 'menu-actions' },
        btn('Vocabulary list', {
          variant: 'large',
          onClick: () => { view = 'list'; render(); },
        }),
        btn('Flashcards', {
          variant: 'large primary',
          className: 'btn--primary btn--large',
          disabled: !cards.length,
          onClick: () => { view = 'flashcards'; render(); },
        }),
        btn('Practice quiz', {
          className: 'btn--primary btn--large',
          disabled: cards.length < 4,
          onClick: () => { view = 'quiz'; render(); },
        }),
      ),
    );

    if (cards.length < 4) {
      panel.appendChild(el('p', { className: 'hint' }, 'Practice quiz needs at least 4 terms.'));
    }

    root.appendChild(panel);
  }

  function renderList() {
    root.innerHTML = '';
    root.appendChild(el('button', { type: 'button', className: 'back-link', onClick: goHome }, '← Back'));

    root.appendChild(el('header', { className: 'app-header app-header--compact' },
      el('h1', null, title),
      el('p', null, 'Vocabulary list'),
    ));

    const list = el('ul', { className: 'vocab-list' });
    cards.forEach(c => {
      list.appendChild(el('li', { className: 'vocab-list__item' },
        el('div', { className: 'vocab-list__term' }, c.front),
        el('div', { className: 'vocab-list__def' }, c.back),
      ));
    });

    root.appendChild(el('div', { className: 'panel' }, list));
  }

  function renderPresenter(mode) {
    root.innerHTML = '';
    const container = el('div', { className: 'presenter' });
    root.appendChild(container);

    let deck = shuffleCards(cards);
    let index = 0;
    let cyclePhase = 'term';
    let revealed = false;
    let choiceList = [];

    function current() { return deck[index]; }
    function done() { return index >= deck.length; }

    function refreshChoices() {
      if (mode === 'quiz' && current() && !done()) {
        choiceList = pickTermChoices(deck, current());
        revealed = false;
      }
    }

    function paint() {
      container.innerHTML = '';
      const canGoBack = mode === 'cycle'
        ? (cyclePhase === 'def' || index > 0)
        : (revealed || index > 0);

      const bar = el('header', { className: 'presenter__bar' },
        el('span', null, title),
        el('span', null, done() ? '' : (index + 1) + ' / ' + deck.length),
        el('span', null, mode === 'cycle' ? 'Flashcards' : 'Quiz'),
        el('button', { type: 'button', className: 'presenter__exit', onClick: goHome }, 'Exit'),
      );

      if (!deck.length) {
        container.append(bar, el('p', { className: 'presenter__hint', style: { margin: 'auto' } }, 'No terms in this set.'));
        return;
      }

      if (mode === 'quiz' && deck.length < 4) {
        container.append(bar, el('p', { className: 'presenter__hint', style: { margin: 'auto' } }, 'Quiz needs at least 4 terms.'));
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
              onClick: () => {
                index = 0;
                cyclePhase = 'term';
                revealed = false;
                deck = shuffleCards(cards);
                refreshChoices();
                paint();
              },
            }),
            btn('Back to menu', { className: 'presenter__nav-btn', onClick: goHome }),
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
          onClick: () => (mode === 'cycle' ? cycleBack() : quizBack()),
        }, '← Back'),
        el('button', {
          type: 'button',
          className: 'presenter__nav-btn presenter__nav-btn--primary',
          onClick: () => (mode === 'cycle' ? cycleForward() : quizForward()),
        }, mode === 'cycle'
          ? (cyclePhase === 'term' ? 'Show definition →' : 'Next card →')
          : (revealed ? 'Next question →' : 'Show answer →')),
      );

      if (mode === 'cycle') {
        container.append(
          bar,
          el('p', { className: 'presenter__label' }, cyclePhase === 'term' ? 'Term' : 'Definition'),
          el('div', { className: 'presenter__prompt' }, cyclePhase === 'term' ? cur.front : cur.back),
          el('p', { className: 'presenter__hint' }, 'Page Down = forward · Page Up = back'),
          nav,
        );
        return;
      }

      const choicesEl = el('ul', { className: 'presenter__choices' });
      choiceList.forEach((ch, i) => {
        const isCorrect = ch.id === cur.id;
        let cls = 'presenter__choice';
        if (revealed && isCorrect) cls += ' presenter__choice--correct';
        choicesEl.appendChild(el('li', { className: cls },
          el('span', { className: 'presenter__choice-num' }, String(i + 1)),
          el('span', null, ch.front),
        ));
      });

      const parts = [
        bar,
        el('p', { className: 'presenter__label' }, 'Definition'),
        el('div', { className: 'presenter__prompt presenter__prompt--quiz' }, cur.back),
        choicesEl,
        el('p', { className: 'presenter__hint' }, !revealed
          ? 'Page Down → reveal correct answer'
          : 'Answer: ' + cur.front + ' · Page Down → next'),
      ];
      if (revealed) parts.push(el('p', { className: 'presenter__feedback' }, 'Correct: ' + cur.front));
      parts.push(nav);
      parts.forEach(p => container.appendChild(p));
    }

    function goNextCard() {
      index++;
      cyclePhase = 'term';
      revealed = false;
      refreshChoices();
      paint();
    }

    function goPrevCard() {
      index = Math.max(0, index - 1);
      cyclePhase = 'term';
      revealed = false;
      refreshChoices();
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

    function quizForward() {
      if (!revealed) { revealed = true; paint(); }
      else goNextCard();
    }

    function quizBack() {
      if (revealed) { revealed = false; paint(); }
      else if (index > 0) goPrevCard();
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        goHome();
        return;
      }
      const delta = pageDelta(e.key);
      if (delta === 0) return;
      e.preventDefault();
      if (mode === 'cycle') {
        if (delta === 1) cycleForward();
        else cycleBack();
      } else {
        if (delta === 1) quizForward();
        else quizBack();
      }
    }

    window.addEventListener('keydown', onKey);
    requestFullscreen(container);
    refreshChoices();
    paint();

    presenterCleanup = () => {
      window.removeEventListener('keydown', onKey);
      exitFullscreen();
    };
  }

  function render() {
    if (presenterCleanup) {
      presenterCleanup();
      presenterCleanup = null;
    }

    if (view === 'list') renderList();
    else if (view === 'flashcards') renderPresenter('cycle');
    else if (view === 'quiz') renderPresenter('quiz');
    else renderMenu();
  }

  document.title = title;
  render();
})();
