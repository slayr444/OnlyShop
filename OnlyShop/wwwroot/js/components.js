(function () {
    const { useState, useEffect, useRef } = React;
    const { html, useApp, money } = window.App;

    const ICONS = {
        menu: 'M4 7h16M4 12h16M4 17h10',
        search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
        heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
        grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
        bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
        user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
        arrow: 'M5 12h14M13 6l6 6-6 6',
        close: 'M18 6 6 18M6 6l12 12',
        back: 'M15 18l-6-6 6-6',
        chat: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z',
        trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
        plus: 'M12 5v14M5 12h14',
        minus: 'M5 12h14',
        box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
        truck: 'M1 6h13v10H1zM14 10h4l3 3v3h-7zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
        gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
        check: 'M20 6 9 17l-5-5',
        pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
        edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'
    };

    function Icon({ name, size = 22, filled = false }) {
        return html`<svg
      width=${size}
      height=${size}
      viewBox="0 0 24 24"
      fill=${filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d=${ICONS[name]} />
    </svg>`;
    }

    function Header() {
        const { nav } = useApp();
        const [open, setOpen] = useState(false);
        return html`
      <header className="header">
        <button className="icon-btn" aria-label="Категории" onClick=${() => setOpen(true)}><${Icon} name="menu" size=${26} /></button>
        <div className="brand">
          <div className="wordmark">42,5</div>
        </div>
        <button className="icon-btn" aria-label="Поиск" onClick=${nav.focusSearch}><${Icon} name="search" size=${26} /></button>
      </header>
      ${open && html`<${CategorySheet} onClose=${() => setOpen(false)} />`}
    `;
    }

    function CategorySheet({ onClose }) {
        const { categories, categoryId, setCategoryId, nav } = useApp();
        const roots = categories.filter((c) => !c.parentId);
        const pick = (id) => {
            setCategoryId(id);
            nav.setTab('catalog');
            onClose();
        };
        return html`<${Sheet} title="Категории" onClose=${onClose}>
      <div className="menu-list">
        <button className=${'menu-row' + (categoryId === null ? ' is-active' : '')} onClick=${() => pick(null)}>Все товары<${Icon} name="arrow" size=${18} /></button>
        ${roots.map(
            (root) => html`
            <button key=${root.id} className=${'menu-row' + (categoryId === root.id ? ' is-active' : '')} onClick=${() => pick(root.id)}>
              ${root.name}<${Icon} name="arrow" size=${18} />
            </button>
            ${categories
                    .filter((c) => c.parentId === root.id)
                    .map(
                        (child) => html`<button key=${child.id} className=${'menu-row is-child' + (categoryId === child.id ? ' is-active' : '')} onClick=${() => pick(child.id)}>
                  ${child.name}<${Icon} name="arrow" size=${18} />
                </button>`
                    )}
          `
        )}
      </div>
    <//>`;
    }

    function CurrencySwitch() {
        const { currency, setCurrency } = useApp();
        const items = [
            ['BYN', 'Br'],
            ['USD', '$'],
            ['RUB', '₽']
        ];
        const index = items.findIndex(([id]) => id === currency);
        return html`<div className="segment glass" style=${{ '--i': index }} role="tablist">
      <span className="segment-thumb"></span>
      ${items.map(
            ([id, label]) => html`<button key=${id} className=${currency === id ? 'is-active' : ''} onClick=${() => setCurrency(id)}>${label}</button>`
        )}
    </div>`;
    }

    function Chips({ items, value, onChange, allLabel = 'Все' }) {
        return html`<div className="chips">
      <button className=${'chip glass' + (value === null ? ' is-active' : '')} onClick=${() => onChange(null)}>${allLabel}</button>
      ${items.map(
            (c) => html`<button key=${c.id} className=${'chip glass' + (value === c.id ? ' is-active' : '')} onClick=${() => onChange(c.id)}>${c.name}</button>`
        )}
    </div>`;
    }

    function HeartButton({ id, className = '' }) {
        const { favIds, toggleFavorite } = useApp();
        const active = favIds.includes(id);
        return html`<button
      className=${'heart glass ' + className + (active ? ' is-active' : '')}
      aria-label=${active ? 'Убрать из избранного' : 'В избранное'}
      onClick=${(e) => {
                e.stopPropagation();
                toggleFavorite(id);
            }}
    >
      <${Icon} name="heart" size=${20} filled=${active} />
    </button>`;
    }

    function ProductCard({ product }) {
        const { currency, nav } = useApp();
        const sizes = product.variants
            .filter((v) => product.isPresale || v.stock > 0)
            .map((v) => v.size)
            .join(', ');
        return html`<article className="card" onClick=${() => nav.openProduct(product.id)}>
      <div className="card-photo">
        ${product.photos[0] ? html`<img src=${product.photos[0]} alt=${product.name} loading="lazy" />` : html`<span className="no-photo">Нет фото</span>`}
        <${HeartButton} id=${product.id} className="card-heart" />
        ${product.isPresale && html`<span className="badge glass">Предзаказ</span>`}
        ${!product.canBeOrdered && html`<span className="sold-out">Нет в наличии</span>`}
      </div>
      <h3 className="card-name">${product.name}</h3>
      <div className="card-price">${money.format(money.price(product, currency), currency)}</div>
      ${sizes && html`<div className="card-sizes">${sizes}</div>`}
    </article>`;
    }

    function SkeletonGrid({ count = 6 }) {
        return html`<div className="grid">
      ${Array.from({ length: count }, (_, i) => html`<div key=${i} className="card skeleton"><div className="card-photo"></div><i></i><i></i></div>`)}
    </div>`;
    }

    function Empty({ icon, title, text, action }) {
        return html`<div className="empty">
      <div className="empty-icon glass"><${Icon} name=${icon} size=${30} /></div>
      <h3>${title}</h3>
      <p>${text}</p>
      ${action}
    </div>`;
    }

    function PageTitle({ eyebrow, title }) {
        return html`<div className="page-title">
      ${eyebrow && html`<span className="eyebrow">${eyebrow}</span>`}
      <h1>${title}</h1>
    </div>`;
    }

    function Stepper({ value, onChange }) {
        return html`<div className="stepper glass">
      <button aria-label="Меньше" onClick=${() => onChange(value - 1)}><${Icon} name="minus" size=${16} /></button>
      <span>${value}</span>
      <button aria-label="Больше" onClick=${() => onChange(value + 1)}><${Icon} name="plus" size=${16} /></button>
    </div>`;
    }

    function Sheet({ title, onClose, children }) {
        useEffect(() => {
            const onKey = (e) => e.key === 'Escape' && onClose();
            window.addEventListener('keydown', onKey);
            return () => window.removeEventListener('keydown', onKey);
        }, []);
        return html`<div className="modal" onClick=${onClose}>
      <div className="modal-panel glass-strong" onClick=${(e) => e.stopPropagation()}>
        <div className="modal-grip"></div>
        <div className="modal-head">
          <h2>${title}</h2>
          <button className="icon-btn small" aria-label="Закрыть" onClick=${onClose}><${Icon} name="close" size=${20} /></button>
        </div>
        <div className="modal-body">${children}</div>
      </div>
    </div>`;
    }

    function TabBar() {
        const { nav, basketCount, favIds } = useApp();
        const tabs = [
            { id: 'catalog', label: 'Каталог', icon: 'grid' },
            { id: 'favorites', label: 'Избранное', icon: 'heart', badge: favIds.length },
            { id: 'basket', label: 'Корзина', icon: 'bag', badge: basketCount },
            { id: 'profile', label: 'Профиль', icon: 'user' }
        ];
        const index = tabs.findIndex((t) => t.id === nav.tab);
        return html`<nav className="tabbar glass-strong" style=${{ '--i': index }} aria-label="Разделы">
      <span className="tab-thumb"></span>
      ${tabs.map(
            (t) => html`<button key=${t.id} className=${'tab' + (nav.tab === t.id ? ' is-active' : '')} onClick=${() => nav.setTab(t.id)}>
          <span className="tab-icon">
            <${Icon} name=${t.icon} size=${23} filled=${nav.tab === t.id && t.id === 'favorites'} />
            ${t.badge > 0 && t.id === 'basket' && html`<b className="tab-badge">${t.badge}</b>`}
          </span>
          <span className="tab-label">${t.label}</span>
        </button>`
        )}
    </nav>`;
    }

    function Toast() {
        const { toastMsg } = useApp();
        return html`<div className=${'toast glass-strong' + (toastMsg ? ' is-visible' : '')} role="status">${toastMsg}</div>`;
    }

    Object.assign(window.App, { Icon, Header, CurrencySwitch, Chips, HeartButton, ProductCard, SkeletonGrid, Empty, PageTitle, Stepper, Sheet, TabBar, Toast });
})();