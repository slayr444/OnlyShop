(function () {
    const { useState, useEffect, useRef, useCallback, useMemo } = React;
    const { html, useApp, money, api, Icon, CurrencySwitch, Chips, HeartButton, ProductCard, SkeletonGrid, Empty, PageTitle, Stepper, Sheet } = window.App;
    const cfg = window.APP_CONFIG;
    const tg = api.tg;
    const PAGE_SIZE = 20;

    const TAB_ORDER = ['catalog', 'favorites', 'basket', 'profile'];

    function useTabSwipe() {
        const { nav } = useApp();
        const navRef = useRef(nav);
        useEffect(() => { navRef.current = nav; });

        useEffect(() => {
            const BLOCKERS = '.chips, .gallery, .segment, .options, .modal, .product-sheet, input, textarea, select, [data-no-swipe]';
            const isBlocked = (el) => !!el && !!el.closest && !!el.closest(BLOCKERS);

            let start = null;
            let lockUntil = 0;
            let lastTouchAt = 0;

            const onStart = (e, isTouch) => {
                const now = Date.now();
                if (isTouch) lastTouchAt = now;
                else if (now - lastTouchAt < 500) { start = null; return; }
                if (now < lockUntil) { start = null; return; }

                const n = navRef.current;
                if (!n || n.productId) { start = null; return; }
                if (isBlocked(e.target)) { start = null; return; }

                const pt = e.touches ? e.touches[0] : e;
                start = {
                    x: pt.clientX,
                    y: pt.clientY,
                    t: now,
                    isTouch,
                    tabAtStart: n.tab
                };
            };

            const onMove = (e) => {
                if (!start) return;
                const pt = e.touches ? e.touches[0] : e;
                const dx = pt.clientX - start.x;
                const dy = pt.clientY - start.y;
                if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx) * 1.2) start = null;
            };

            const onEnd = (e) => {
                const s = start;
                start = null;
                if (!s) return;

                const now = Date.now();
                if (now < lockUntil) return;
                if (!s.isTouch && now - lastTouchAt < 500) return;

                const n = navRef.current;
                if (!n || n.productId) return;
                if (n.tab !== s.tabAtStart) return;

                const pt = e.changedTouches ? e.changedTouches[0] : e;
                const dx = pt.clientX - s.x;
                const dy = pt.clientY - s.y;
                const dt = now - s.t;

                if (dt > 700) return;
                if (Math.abs(dx) < 70) return;
                if (Math.abs(dx) < Math.abs(dy) * 1.5) return;

                const idx = TAB_ORDER.indexOf(n.tab);
                if (idx < 0) return;

                let nextIdx = idx;
                if (dx < 0 && idx < TAB_ORDER.length - 1) nextIdx = idx + 1;
                else if (dx > 0 && idx > 0) nextIdx = idx - 1;
                if (nextIdx === idx) return;

                lockUntil = now + 400;
                n.setTab(TAB_ORDER[nextIdx]);
            };

            const onCancel = () => { start = null; };

            const ts = (e) => onStart(e, true);
            const tm = (e) => onMove(e);
            const te = (e) => onEnd(e);
            const tc = () => onCancel();

            const ms = (e) => onStart(e, false);
            const mm = (e) => onMove(e);
            const mu = (e) => onEnd(e);

            document.addEventListener('touchstart', ts, { passive: true });
            document.addEventListener('touchmove', tm, { passive: true });
            document.addEventListener('touchend', te, { passive: true });
            document.addEventListener('touchcancel', tc, { passive: true });
            document.addEventListener('mousedown', ms);
            document.addEventListener('mousemove', mm);
            document.addEventListener('mouseup', mu);

            return () => {
                document.removeEventListener('touchstart', ts);
                document.removeEventListener('touchmove', tm);
                document.removeEventListener('touchend', te);
                document.removeEventListener('touchcancel', tc);
                document.removeEventListener('mousedown', ms);
                document.removeEventListener('mousemove', mm);
                document.removeEventListener('mouseup', mu);
            };
        }, []);
    }

    const STATUS_LABELS = {
        Pending: 'Ожидает подтверждения',
        Confirmed: 'Принят',
        Paid: 'Оплачен',
        Delivering: 'В пути',
        Completed: 'Завершён',
        Canceled: 'Отменён'
    };

    const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

    const openManager = () => {
        const link = 'https://t.me/' + cfg.managerUsername;
        if (tg && tg.openTelegramLink) tg.openTelegramLink(link);
        else window.open(link, '_blank');
    };

    function CatalogPage() {
        useTabSwipe();
        const { categories, categoryId, setCategoryId, remember, nav } = useApp();

        const [showCatalog, setShowCatalog] = useState(false);

        const [query, setQuery] = useState('');
        const [debounced, setDebounced] = useState('');
        const [state, setState] = useState({ items: [], total: 0, page: 0, loading: true, error: null, done: false });
        const sentinel = useRef(null);
        const searchInput = useRef(null);
        const gridTop = useRef(null);
        const seq = useRef(0);

        useEffect(() => {
            const t = setTimeout(() => setDebounced(query.trim()), 300);
            return () => clearTimeout(t);
        }, [query]);

        useEffect(() => {
            if (nav.searchTick > 0 && searchInput.current) {
                searchInput.current.focus();
                searchInput.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }, [nav.searchTick]);

        const load = useCallback(
            async (page, replace) => {
                const id = ++seq.current;
                setState((s) => ({ ...s, loading: true, error: null }));
                try {
                    const r = await api.products({ search: debounced, categoryId, page, pageSize: PAGE_SIZE });
                    if (id !== seq.current) return;
                    remember(r.items);
                    setState((s) => ({
                        items: replace ? r.items : [...s.items, ...r.items],
                        total: r.total,
                        page,
                        loading: false,
                        error: null,
                        done: r.items.length < PAGE_SIZE
                    }));
                } catch (e) {
                    if (id !== seq.current) return;
                    setState((s) => ({ ...s, loading: false, error: e.message }));
                }
            },
            [debounced, categoryId]
        );

        useEffect(() => {
            load(1, true);
        }, [load]);

        const hasMore = !state.done && state.items.length < state.total;

        useEffect(() => {
            if (!sentinel.current) return undefined;
            const observer = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting && hasMore && !state.loading) load(state.page + 1, false);
                },
                { rootMargin: '500px' }
            );
            observer.observe(sentinel.current);
            return () => observer.disconnect();
        }, [hasMore, state.loading, state.page, load]);

        const roots = categories.filter((c) => !c.parentId);
        const activeCategory = categories.find((c) => c.id === categoryId);
        const rootId = activeCategory ? activeCategory.parentId || activeCategory.id : null;
        const children = rootId ? categories.filter((c) => c.parentId === rootId) : [];

        const heroProduct = state.items.find((p) => p.photos[0]);

        const onRoot = (id) => setCategoryId(id);
        const onChild = (id) => setCategoryId(id === null ? rootId : id);

        return html`<section className="page">
      
      <!-- ЭКРАН 1: ПРОМО-СТРАНИЦА -->
      ${!showCatalog && html`
        <div className="hero">
          <span className="eyebrow">THE BEST SHOP</span>
          <h1 className="hero-title"><b>Лучший</b> шоп</h1>
          
          ${heroProduct ? html`
            <div className="hero-photo">
                <img src=${heroProduct.photos[0]} alt=${heroProduct.name} onClick=${() => nav.openProduct(heroProduct.id)} />
            </div>
          ` : html`
            <div className="hero-photo skeleton"></div>
          `}

          <button className="btn-black glass-dark" onClick=${() => setShowCatalog(true)}>
            Перейти в каталог<${Icon} name="arrow" size=${22} />
          </button>
        </div>
      `}

      <!-- ЭКРАН 2: КАТАЛОГ -->
      ${showCatalog && html`
        <div ref=${gridTop} className="toolbar" style=${{ marginTop: '10px' }}>
          <${CurrencySwitch} />
          <${Chips} items=${roots} value=${rootId} onChange=${onRoot} />
        </div>
        ${children.length > 0 && html`<${Chips} items=${children} value=${categoryId === rootId ? null : categoryId} onChange=${onChild} allLabel="Всё" />`}
        
        <label className="search glass">
          <${Icon} name="search" size=${20} />
          <input ref=${searchInput} type="search" placeholder="Поиск по названию или бренду" value=${query} onInput=${(e) => setQuery(e.target.value)} />
        </label>

        ${state.items.length === 0 && state.loading && html`<${SkeletonGrid} />`}
        ${state.items.length === 0 && !state.loading && !state.error &&
                html`<${Empty} icon="search" title="Ничего не найдено" text="Попробуйте другое название или выберите другую категорию." />`}
        ${state.error && html`<${Empty} icon="close" title="Не удалось загрузить каталог" text=${state.error} action=${html`<button className="btn-outline" onClick=${() => load(1, true)}>Повторить</button>`} />`}
        
        ${state.items.length > 0 && html`<div className="grid">${state.items.map((p) => html`<${ProductCard} key=${p.id} product=${p} />`)}</div>`}
        
        ${state.loading && state.items.length > 0 && html`<div className="loader"></div>`}
        
        <div ref=${sentinel} className="sentinel"></div>
      `}
    </section>`;
    }

    function Gallery({ photos, name }) {
        const [index, setIndex] = useState(0);
        const ref = useRef(null);
        const onScroll = () => {
            const el = ref.current;
            if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
        };
        if (photos.length === 0) return html`<div className="gallery gallery-empty"><span className="no-photo">Нет фото</span></div>`;
        return html`<div className="gallery-wrap">
      <div className="gallery" ref=${ref} onScroll=${onScroll}>
        ${photos.map((src, i) => html`<img key=${i} src=${src} alt=${name} />`)}
      </div>
      ${photos.length > 1 && html`<div className="dots glass">${photos.map((_, i) => html`<i key=${i} className=${i === index ? 'is-active' : ''}></i>`)}</div>`}
    </div>`;
    }

    function ProductSheet() {
        const { nav, currency, getProduct, addToBasket, toast } = useApp();
        const [product, setProduct] = useState(null);
        const [variantId, setVariantId] = useState(null);
        const [error, setError] = useState(null);

        useEffect(() => {
            let alive = true;
            setProduct(null);
            setError(null);
            getProduct(nav.productId, true)
                .then((p) => {
                    if (!alive) return;
                    setProduct(p);
                    const first = p.variants.find((v) => v.stock > 0) || (p.isPresale ? p.variants[0] : null);
                    setVariantId(first ? first.id : null);
                })
                .catch((e) => alive && setError(e.message));
            return () => {
                alive = false;
            };
        }, [nav.productId]);

        const variant = product && product.variants.find((v) => v.id === variantId);
        const price = product ? money.format(money.price(product, currency), currency) : '';
        const canBuy = product && product.canBeOrdered && variant && (product.isPresale || variant.stock > 0);

        let stockText = '';
        if (product && variant) {
            if (product.isPresale) {
                stockText = 'Предзаказ до ' + formatDate(product.presaleClosesAt);
            } else if (variant.stock > 0) {
                stockText = 'В наличии: ' + variant.stock + ' шт.';
            } else {
                stockText = 'Нет в наличии';
            }
        }

        return html`<div className="product-sheet">
      <button className="back-btn glass" aria-label="Назад" onClick=${nav.closeProduct}><${Icon} name="back" size=${22} /></button>
      ${error && html`<${Empty} icon="close" title="Товар не найден" text=${error} />`}
      ${!product && !error && html`<div className="gallery gallery-empty"><div className="loader"></div></div>`}
      ${product &&
            html`
        <${Gallery} photos=${product.photos} name=${product.name} />
        <div className="product-body">
          <div className="product-head">
            <h2>${product.name}</h2>
            <div className="product-price">${price}</div>
          </div>
          ${product.brand && html`<div className="product-brand">${product.brand}</div>`}
          <div className="divider"></div>
          <h4 className="section-label">Размер</h4>
          <div className="sizes">
            ${product.variants.map(
                (v) => html`<button
                key=${v.id}
                className=${'size' + (v.id === variantId ? ' is-active' : '') + (!product.isPresale && v.stock === 0 ? ' is-out' : '')}
                onClick=${() => setVariantId(v.id)}
              >${v.size}</button>`
            )}
          </div>
          <div className=${'stock' + (canBuy ? '' : ' is-out')}>${stockText}</div>
          ${product.description && html`<h4 className="section-label">Описание</h4><p className="description">${product.description}</p>`}
          <${HeartWide} id=${product.id} />
          <button className="btn-outline" onClick=${openManager}><${Icon} name="chat" size=${20} />Связаться с менеджером</button>
        </div>
        <div className="cta-bar">
          <button
            className=${'cta glass-brand' + (canBuy ? '' : ' is-disabled')}
            disabled=${!canBuy}
            onClick=${async () => {
                    if (!canBuy) return toast('Выберите размер в наличии');
                    await addToBasket(product, variantId, 1);
                }}
          >
            ${canBuy ? html`<span>В корзину</span><i></i><span>${price}</span>` : html`<span>Нет в наличии</span>`}
          </button>
        </div>
      `}
    </div>`;
    }

    function HeartWide({ id }) {
        const { favIds, toggleFavorite } = useApp();
        const active = favIds.includes(id);
        return html`<button className=${'btn-outline' + (active ? ' is-liked' : '')} onClick=${() => toggleFavorite(id)}>
      <${Icon} name="heart" size=${20} filled=${active} />${active ? 'В избранном' : 'В избранное'}
    </button>`;
    }

    function FavoritesPage() {
        useTabSwipe();
        const { favIds, getProduct, nav } = useApp();
        const [items, setItems] = useState([]);
        const [loading, setLoading] = useState(true);
        const key = favIds.join(',');

        useEffect(() => {
            let alive = true;
            Promise.all(favIds.map((id) => getProduct(id).catch(() => null))).then((list) => {
                if (!alive) return;
                setItems(list.filter(Boolean));
                setLoading(false);
            });
            return () => {
                alive = false;
            };
        }, [key]);

        const visible = items.filter((p) => favIds.includes(p.id));

        return html`<section className="page">
      <${PageTitle} eyebrow="Wishlist" title="Избранное" />
      ${loading && favIds.length > 0 && html`<${SkeletonGrid} count=${4} />`}
      ${favIds.length === 0 &&
            html`<${Empty}
        icon="heart"
        title="Пока пусто"
        text="Нажмите на сердечко у товара, чтобы сохранить его здесь."
        action=${html`<button className="btn-outline" onClick=${() => nav.setTab('catalog')}>Перейти в каталог</button>`}
      />`}
      ${visible.length > 0 && html`<div className="grid">${visible.map((p) => html`<${ProductCard} key=${p.id} product=${p} />`)}</div>`}
    </section>`;
    }

    function BasketRow({ item }) {
        const { currency, changeQuantity, removeFromBasket, nav } = useApp();
        const { product, variant } = item;
        return html`<div className="basket-row">
      <div className="basket-photo" onClick=${() => nav.openProduct(product.id)}>
        ${product.photos[0] ? html`<img src=${product.photos[0]} alt=${product.name} />` : html`<span className="no-photo">Нет фото</span>`}
      </div>
      <div className="basket-info">
        <h3>${product.name}</h3>
        <div className="muted">Размер: ${variant.size}</div>
        <div className="basket-price">${money.format(money.price(product, currency) * item.quantity, currency)}</div>
        <div className="basket-actions">
          <${Stepper} value=${item.quantity} onChange=${(q) => changeQuantity(item.variantId, q)} />
          <button className="icon-btn small" aria-label="Удалить" onClick=${() => removeFromBasket(item.variantId)}><${Icon} name="trash" size=${20} /></button>
        </div>
      </div>
    </div>`;
    }

    function BasketPage() {
        useTabSwipe();
        const { basket, basketTotals, currency, user, checkout, nav, toast } = useApp();
        const [form, setForm] = useState({
            name: '',
            phone: '',
            delivery: cfg.deliveryMethods[0].id,
            address: '',
            payment: cfg.paymentMethods[0].id,
            comment: '',
            useBonuses: false
        });
        const [submitting, setSubmitting] = useState(false);
        const [done, setDone] = useState(null);

        useEffect(() => {
            if (user) setForm((f) => ({ ...f, name: f.name || user.name, phone: f.phone || user.phone }));
        }, [user]);

        const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
        const delivery = cfg.deliveryMethods.find((d) => d.id === form.delivery);

        const checkoutCurrency = currency === 'USD' ? (cfg.baseCurrency || 'RUB') : currency;

        const orderCurrency = checkoutCurrency;
        const orderTotal = orderCurrency === 'RUB' ? basketTotals.rub : basketTotals.byn;

        const maxAllowedBonuses = orderTotal * ((cfg.maxBonusSpendPercent || 30) / 100);
        const bonuses = form.useBonuses && user ? Math.min(user.bonusBalance, maxAllowedBonuses) : 0;
        const payable = orderTotal - bonuses;

        const submit = async () => {
            if (!form.name.trim()) return toast('Укажите имя');
            if (form.phone.replace(/\D/g, '').length < 7) return toast('Укажите телефон');
            if (delivery.needsAddress && !form.address.trim()) return toast('Укажите адрес доставки');
            setSubmitting(true);
            try {
                const result = await checkout({ ...form, bonuses });
                setDone(result || true);
            } catch (e) {
                toast(e.message);
            } finally {
                setSubmitting(false);
            }
        };

        if (done) {
            const isCardTransfer = form.payment === 'CardTransfer';
            const orderId = typeof done === 'object' ? done.id : null;
            const payLink = `https://t.me/${cfg.botUsername}?start=pay_${orderId}`;

            return html`<section className="page">
        <${Empty}
          icon="check"
          title="Заказ оформлен"
          text=${isCardTransfer
                    ? "Пожалуйста, переведите сумму на карту и отправьте скриншот чека нашему боту."
                    : "Менеджер получил заказ и скоро свяжется с вами в Telegram."}
          action=${isCardTransfer
                    ? html`<a href=${payLink} className="btn-outline" style=${{ textDecoration: 'none', marginTop: '16px', display: 'inline-flex' }}>📸 Отправить чек в бот</a>`
                    : html`<button className="btn-outline" onClick=${() => { setDone(null); nav.setTab('profile'); }}>Смотреть заказы</button>`}
        />
      </section>`;
        }

        return html`<section className="page">
      <${PageTitle} eyebrow="Cart" title="Корзина" />
      ${basket.loading && html`<div className="loader"></div>`}
      ${!basket.loading && basket.items.length === 0 &&
            html`<${Empty}
        icon="bag"
        title="Корзина пуста"
        text="Выберите размер в карточке товара и добавьте его сюда."
        action=${html`<button className="btn-outline" onClick=${() => nav.setTab('catalog')}>Перейти в каталог</button>`}
      />`}
      ${basket.items.length > 0 &&
            html`
        <div className="basket-list glass">${basket.items.map((i) => html`<${BasketRow} key=${i.variantId} item=${i} />`)}</div>
        <div className="form glass">
          <h3>Оформление</h3>
          <label className="field"><span>Имя</span><input value=${form.name} onInput=${set('name')} autoComplete="name" /></label>
          <label className="field"><span>Телефон</span><input value=${form.phone} onInput=${set('phone')} type="tel" inputMode="tel" autoComplete="tel" /></label>
          <div className="field"><span>Доставка</span>
            <div className="options">
              ${cfg.deliveryMethods.map((d) => html`<button key=${d.id} className=${'option' + (form.delivery === d.id ? ' is-active' : '')} onClick=${() => setForm((f) => ({ ...f, delivery: d.id }))}>${d.label}</button>`)}
            </div>
            <small className="muted">Время ожидания: ${delivery.wait}</small>
          </div>
          ${delivery.needsAddress && html`<label className="field"><span>Адрес</span><input value=${form.address} onInput=${set('address')} autoComplete="street-address" /></label>`}
          <div className="field"><span>Оплата</span>
            <div className="options">
              ${cfg.paymentMethods.map((p) => html`<button key=${p.id} className=${'option' + (form.payment === p.id ? ' is-active' : '')} onClick=${() => setForm((f) => ({ ...f, payment: p.id }))}>${p.label}</button>`)}
            </div>
          </div>
          <label className="field"><span>Комментарий</span><textarea rows="2" value=${form.comment} onInput=${set('comment')}></textarea></label>
          
          <!-- Показываем реальное количество бонусов, которое применится -->
          ${user && user.bonusBalance > 0 &&
                html`<label className="check">
            <input type="checkbox" checked=${form.useBonuses} onChange=${(e) => setForm((f) => ({ ...f, useBonuses: e.target.checked }))} />
            <span>Списать бонусы (доступно ${money.format(user.bonusBalance, orderCurrency).replace(/ (Br|₽)$/, '')}, применится ${money.format(bonuses, orderCurrency).replace(/ (Br|₽)$/, '')})</span>
          </label>`}
        </div>
        <div className="summary">
          <div className="summary-row"><span>Товары</span><span>${money.format(orderTotal, orderCurrency)}</span></div>
          ${bonuses > 0 && html`<div className="summary-row"><span>Бонусы</span><span>−${money.format(bonuses, orderCurrency)}</span></div>`}
          <div className="summary-row total"><span>Итого</span><span>${money.format(payable, orderCurrency)}</span></div>
          
          <!-- ИСПРАВЛЕНО: Понятное предупреждение о валюте оформления -->
          ${currency === 'USD' && html`<small className="muted">Заказ оформляется в ${orderCurrency}. В долларах цены показаны для ориентира.</small>`}
        </div>
        <button className=${'cta glass-brand static' + (submitting ? ' is-disabled' : '')} disabled=${submitting} onClick=${submit}>
          <span>${submitting ? 'Оформляем…' : 'Оформить заказ'}</span><i></i><span>${money.format(payable, orderCurrency)}</span>
        </button>
      `}
    </section>`;
    }

    function OrdersSheet({ onClose }) {
        const { orders, cancelOrder } = useApp();
        return html`<${Sheet} title="Мои заказы" onClose=${onClose}>
      ${orders.length === 0 && html`<p className="muted center">Заказов пока нет.</p>`}
      ${orders.map(
            (o) => html`<div key=${o.id} className="order">
          <div className="order-head">
            <b>${o.number ? 'Заказ №' + String(o.number).padStart(6, '0') : 'Заказ'}</b>
            <span className=${'status status-' + o.status}>${STATUS_LABELS[o.status] || o.status}</span>
          </div>
          <div className="muted">от ${formatDate(o.createdAt)}</div>
          ${o.items.map((i, idx) => html`<div key=${idx} className="order-item"><span>${i.productName} · ${i.size}</span><span>× ${i.quantity}</span></div>`)}
          <div className="order-total"><span>Сумма</span><b>${money.format(o.total, o.currency)}</b></div>
          ${o.status === 'Pending' && html`<button className="btn-outline danger" onClick=${() => cancelOrder(o.id)}>Отменить заказ</button>`}
        </div>`
        )}
    <//>`;
    }

    function ContactSheet({ onClose }) {
        const { user, saveProfile, toast } = useApp();
        const [name, setName] = useState(user ? user.name : '');
        const [phone, setPhone] = useState(user ? user.phone : '');
        const [saving, setSaving] = useState(false);
        const save = async () => {
            if (!name.trim()) return toast('Укажите имя');
            setSaving(true);
            try {
                await saveProfile(name.trim(), phone.trim() || null);
                toast('Сохранено');
                onClose();
            } catch (e) {
                toast(e.message);
            } finally {
                setSaving(false);
            }
        };
        return html`<${Sheet} title="Контактные данные" onClose=${onClose}>
      <label className="field"><span>Имя</span><input value=${name} onInput=${(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Телефон</span><input value=${phone} type="tel" inputMode="tel" onInput=${(e) => setPhone(e.target.value)} /></label>
      <button className=${'cta glass-brand static' + (saving ? ' is-disabled' : '')} disabled=${saving} onClick=${save}><span>Сохранить</span></button>
    <//>`;
    }

    function DeliverySheet({ onClose }) {
        return html`<${Sheet} title="Доставка" onClose=${onClose}>
      <ul className="info-list">${cfg.deliveryInfo.map((line, i) => html`<li key=${i}>${line}</li>`)}</ul>
    <//>`;
    }

    function MenuRow({ icon, label, hint, onClick }) {
        return html`<button className="row" onClick=${onClick}>
      <${Icon} name=${icon} size=${22} />
      <span className="row-label">${label}${hint && html`<small>${hint}</small>`}</span>
      <${Icon} name="arrow" size=${20} />
    </button>`;
    }

    function BonusCard() {
        const { user } = useApp();
        const balance = user ? user.bonusBalance : 0;
        const tail = user && user.telegramId ? String(user.telegramId).slice(-4) : '';
        return html`<div className="bonus">
      <span className="blob b1"></span><span className="blob b2"></span><span className="blob b3"></span>
      <div className="bonus-glass glass">
        <div className="bonus-top"><span>Бонусная карта</span><${Icon} name="gift" size=${24} /></div>
        <div className="bonus-balance">${new Intl.NumberFormat('ru-RU').format(Math.round(balance))}<small>бонусов</small></div>
        <div className="bonus-bottom"><span>${user ? user.name : ''}</span>${tail && html`<span>•••• ${tail}</span>`}</div>
      </div>
    </div>`;
    }

    function ProfilePage() {
        useTabSwipe();
        const { orders, nav, user, favIds } = useApp();
        const [sheet, setSheet] = useState(null);
        const last = orders[0];
        return html`<section className="page">
      <${PageTitle} eyebrow="Service" title="Профиль" />
      <${BonusCard} />
      <div className="panel glass">
        <button className="panel-head" onClick=${() => setSheet('orders')}>
          <h3>Мои заказы</h3><${Icon} name="arrow" size=${22} />
        </button>
        ${last
                ? html`<div className="last-order" onClick=${() => setSheet('orders')}>
              <div>
                <b>${last.items[0] ? last.items[0].productName : 'Заказ'}${last.items.length > 1 ? ' и ещё ' + (last.items.length - 1) : ''}</b>
                <div className="muted">${last.items[0] ? 'Размер: ' + last.items[0].size : ''}</div>
                <div className="muted">Заказ от ${formatDate(last.createdAt)}</div>
              </div>
              <span className=${'status status-' + last.status}>${STATUS_LABELS[last.status] || last.status}</span>
            </div>`
                : html`<p className="muted">Оформленные заказы появятся здесь.</p>`}
      </div>
      <div className="panel glass list">
        <${MenuRow} icon="chat" label="Связаться с менеджером" onClick=${openManager} />
        <${MenuRow} icon="heart" label="Избранное" hint=${favIds.length ? favIds.length + ' шт.' : ''} onClick=${() => nav.setTab('favorites')} />
        <${MenuRow} icon="truck" label="Доставка" onClick=${() => setSheet('delivery')} />
        <${MenuRow} icon="edit" label="Контактные данные" hint=${user && user.phone ? user.phone : 'Имя и телефон'} onClick=${() => setSheet('contacts')} />
        <${MenuRow} icon="pin" label="Магазин" hint=${cfg.shopAddress} onClick=${() => setSheet('delivery')} />
      </div>
      ${sheet === 'orders' && html`<${OrdersSheet} onClose=${() => setSheet(null)} />`}
      ${sheet === 'delivery' && html`<${DeliverySheet} onClose=${() => setSheet(null)} />`}
      ${sheet === 'contacts' && html`<${ContactSheet} onClose=${() => setSheet(null)} />`}
    </section>`;
    }

    Object.assign(window.App, { CatalogPage, FavoritesPage, BasketPage, ProfilePage, ProductSheet });
})();