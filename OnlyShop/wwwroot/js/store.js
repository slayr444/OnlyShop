(function () {
    const { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } = React;
    const { api, money } = window.App;
    const cfg = window.APP_CONFIG;
    const tg = api.tg;

    window.App.html = htm.bind(React.createElement);
    const html = window.App.html;

    const Ctx = createContext(null);
    const useApp = () => useContext(Ctx);

    const haptic = (kind) => {
        if (!tg || !tg.HapticFeedback) return;
        if (kind === 'success' || kind === 'error') tg.HapticFeedback.notificationOccurred(kind);
        else tg.HapticFeedback.impactOccurred(kind || 'light');
    };

    function AppProvider({ children }) {
        const [currency, setCurrencyState] = useState(() => localStorage.getItem('currency') || 'BYN');
        const [user, setUser] = useState(null);
        const [categories, setCategories] = useState([]);
        const [categoryId, setCategoryId] = useState(null);
        const [favIds, setFavIds] = useState([]);
        const [basket, setBasket] = useState({ items: [], loading: true });
        const [orders, setOrders] = useState([]);
        const [toastMsg, setToastMsg] = useState(null);
        const [tab, setTabState] = useState('catalog');
        const [productId, setProductId] = useState(null);
        const [searchTick, setSearchTick] = useState(0);
        const cache = useRef(new Map());
        const scrolls = useRef({});
        const toastTimer = useRef(null);

        const toast = useCallback((message) => {
            setToastMsg(message);
            clearTimeout(toastTimer.current);
            toastTimer.current = setTimeout(() => setToastMsg(null), 2400);
        }, []);

        const setCurrency = useCallback((value) => {
            localStorage.setItem('currency', value);
            setCurrencyState(value);
            haptic('light');
        }, []);

        const remember = useCallback((list) => {
            list.forEach((p) => {
                const old = cache.current.get(p.id);
                if (!old || p.variants.length) cache.current.set(p.id, p);
            });
        }, []);

        const getProduct = useCallback(async (id, force) => {
            const cached = cache.current.get(id);
            if (!force && cached && cached.variants.length) return cached;
            const fresh = await api.getProduct(id);
            cache.current.set(id, fresh);
            return fresh;
        }, []);

        const loadBasket = useCallback(async () => {
            try {
                const raw = await api.basket();
                const items = (
                    await Promise.all(
                        raw.map(async (r) => {
                            try {
                                const product = await getProduct(r.productId, true);
                                const variant = product.variants.find((v) => v.id === r.variantId);
                                return variant ? { ...r, product, variant } : null;
                            } catch (e) {
                                return null;
                            }
                        })
                    )
                ).filter(Boolean);
                setBasket({ items, loading: false });
            } catch (e) {
                setBasket((b) => ({ ...b, loading: false }));
            }
        }, [getProduct]);

        const loadOrders = useCallback(async () => {
            try {
                setOrders(await api.orders());
            } catch (e) {
                setOrders([]);
            }
        }, []);

        const loadUser = useCallback(async () => {
            try {
                setUser(await api.me());
            } catch (e) {
                setUser(null);
            }
        }, []);

        useEffect(() => {
            loadUser();
            loadBasket();
            loadOrders();
            api.categories().then(setCategories).catch(() => setCategories([]));
            api.favorites.list().then(setFavIds);
        }, []);

        const toggleFavorite = useCallback(
            (id) => {
                haptic('light');
                if (favIds.includes(id)) {
                    setFavIds((ids) => ids.filter((x) => x !== id));
                    api.favorites.remove(id);
                } else {
                    setFavIds((ids) => [id, ...ids]);
                    api.favorites.add(id);
                }
            },
            [favIds]
        );

        const addToBasket = useCallback(
            async (product, variantId, quantity) => {
                try {
                    await api.addToBasket(product.id, variantId, quantity || 1);
                    await loadBasket();
                    haptic('success');
                    toast('Добавлено в корзину');
                } catch (e) {
                    haptic('error');
                    toast(e.message);
                }
            },
            [loadBasket, toast]
        );

        const removeFromBasket = useCallback(
            async (variantId) => {
                setBasket((b) => ({ ...b, items: b.items.filter((i) => i.variantId !== variantId) }));
                try {
                    await api.removeFromBasket(variantId);
                } catch (e) {
                    toast(e.message);
                    await loadBasket();
                }
            },
            [loadBasket, toast]
        );

        const changeQuantity = useCallback(
            async (variantId, quantity) => {
                if (quantity < 1) return removeFromBasket(variantId);
                haptic('light');
                setBasket((b) => ({ ...b, items: b.items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i)) }));
                try {
                    await api.setQuantity(variantId, quantity);
                } catch (e) {
                    toast(e.message);
                    await loadBasket();
                }
            },
            [loadBasket, removeFromBasket, toast]
        );

        const checkout = useCallback(
            async (form) => {
                const delivery = cfg.deliveryMethods.find((d) => d.id === form.delivery);

                const checkoutCurrency = currency === 'USD' ? (cfg.baseCurrency || 'RUB') : currency;

                const result = await api.checkout({
                    currency: checkoutCurrency === 'RUB' ? 'Rub' : 'Byn',
                    paymentMethod: form.payment,
                    deliveryMethod: form.delivery,
                    deliveryAddress: delivery.needsAddress ? form.address.trim() : null,
                    comment: form.comment.trim() || null,
                    customerName: form.name.trim(),
                    customerPhone: form.phone.trim(),
                    bonusesToSpend: form.bonuses
                });
                haptic('success');
                await Promise.all([loadBasket(), loadOrders(), loadUser()]);
                return result;
            },
            [currency, loadBasket, loadOrders, loadUser]
        );

        const saveProfile = useCallback(async (name, phone) => {
            const updated = await api.updateMe({ name, username: user ? user.username : null, phone });
            setUser(updated);
            return updated;
        }, [user]);

        const cancelOrder = useCallback(
            async (id) => {
                try {
                    await api.cancelOrder(id);
                    await Promise.all([loadOrders(), loadUser()]);
                    toast('Заказ отменён');
                } catch (e) {
                    toast(e.message);
                }
            },
            [loadOrders, loadUser, toast]
        );

        const setTab = useCallback(
            (next) => {
                scrolls.current[tab] = window.scrollY;
                setTabState(next);
                haptic('light');
                requestAnimationFrame(() => window.scrollTo(0, scrolls.current[next] || 0));
            },
            [tab]
        );

        const nav = useMemo(
            () => ({
                tab,
                setTab,
                productId,
                openProduct: (id) => setProductId(id),
                closeProduct: () => setProductId(null),
                searchTick,
                focusSearch: () => {
                    setTab('catalog');
                    setSearchTick((n) => n + 1);
                }
            }),
            [tab, setTab, productId, searchTick]
        );

        const basketCount = useMemo(() => basket.items.reduce((sum, i) => sum + i.quantity, 0), [basket.items]);

        const basketTotals = useMemo(() => {
            const byn = basket.items.reduce((sum, i) => sum + i.product.priceByn * i.quantity, 0);
            const rub = basket.items.reduce((sum, i) => sum + i.product.priceRub * i.quantity, 0);
            return { byn, rub, shown: money.convert(byn, rub, currency) };
        }, [basket.items, currency]);

        const value = useMemo(() => ({
            currency,
            setCurrency,
            user,
            categories,
            categoryId,
            setCategoryId,
            favIds,
            toggleFavorite,
            basket,
            basketCount,
            basketTotals,
            addToBasket,
            removeFromBasket,
            changeQuantity,
            checkout,
            orders,
            cancelOrder,
            saveProfile,
            remember,
            getProduct,
            toast,
            toastMsg,
            nav
        }), [
            currency, setCurrency, user, categories, categoryId, favIds,
            toggleFavorite, basket, basketCount, basketTotals,
            addToBasket, removeFromBasket, changeQuantity, checkout,
            orders, cancelOrder, saveProfile, remember, getProduct,
            toast, toastMsg, nav
        ]);

        return html`<${Ctx.Provider} value=${value}>${children}<//>`;
    }

    Object.assign(window.App, { AppProvider, useApp, haptic });
})();