(function () {
    const { useEffect } = React;
    const { html, AppProvider, useApp, Header, TabBar, Toast, CatalogPage, FavoritesPage, BasketPage, ProfilePage, ProductSheet, api } = window.App;
    const tg = api.tg;

    if (tg) {
        tg.ready();
        tg.expand();
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        try {
            tg.setHeaderColor('#fbf8f5');
            tg.setBackgroundColor('#fbf8f5');
            if (tg.setBottomBarColor) tg.setBottomBarColor('#fbf8f5');
        } catch (e) {
            console.warn(e);
        }
    }

    const ua = navigator.userAgent;
    if (/Chrome\//.test(ua) && !/iPhone|iPad|iPod/.test(ua)) document.documentElement.classList.add('refract');

    function Shell() {
        const { nav } = useApp();

        useEffect(() => {
            const baseUrl = window.APP_CONFIG.apiBase || "";
            fetch(`${baseUrl}/api/settings`)
                .then(r => r.json())
                .then(data => {
                    if (data.accentColor) {
                        document.documentElement.style.setProperty('--brand', data.accentColor);
                    }
                    if (data.brandName) {
                        setTimeout(() => {
                            const wordmark = document.querySelector('.wordmark');
                            if (wordmark) wordmark.innerText = data.brandName.toUpperCase();
                        }, 50);
                    }
                })
                .catch(e => console.log('Не удалось загрузить настройки', e));
        }, []);

        useEffect(() => {
            if (!tg || !tg.BackButton) return undefined;
            const handler = () => nav.closeProduct();
            if (nav.productId) {
                tg.BackButton.show();
                tg.BackButton.onClick(handler);
            } else {
                tg.BackButton.hide();
            }
            return () => tg.BackButton.offClick(handler);
        }, [nav.productId]);

        useEffect(() => {
            document.body.classList.toggle('no-scroll', Boolean(nav.productId));
        }, [nav.productId]);

        const page = (id, Component) => html`<div className="tab-page" hidden=${nav.tab !== id}><${Component} /></div>`;

        return html`
      <div className="app">
        <${Header} />
        <main>
          ${page('catalog', CatalogPage)}
          ${page('favorites', FavoritesPage)}
          ${page('basket', BasketPage)}
          ${page('profile', ProfilePage)}
        </main>
        <${TabBar} />
        ${nav.productId && html`<${ProductSheet} />`}
        <${Toast} />
      </div>
    `;
    }

    ReactDOM.createRoot(document.getElementById('root')).render(html`<${AppProvider}><${Shell} /><//>`);
})();