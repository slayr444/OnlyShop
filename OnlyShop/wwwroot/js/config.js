window.App = window.App || {};

window.APP_CONFIG = {
    apiBase: 'https://onlyshop-rjf2.onrender.com',
    photoBase: '/media/',
    managerUsername: 'arabicaa666',
    botUsername: 'onlyshop00_bot',
    baseCurrency: 'RUB', 
    usdRate: 3.2,
    maxBonusSpendPercent: 30,
    mock: false,
    shopAddress: 'Пресненская наб., 2, Москва',
    deliveryMethods: [
        { id: 'Courier', label: 'Курьер', wait: '1–3 дня', needsAddress: true },
        { id: 'Pickup', label: 'Самовывоз', wait: 'по договорённости', needsAddress: false }
    ],
    paymentMethods: [
        { id: 'Cash', label: 'Наличными' },
        { id: 'CardTransfer', label: 'Переводом на карту' }
    ],
    deliveryInfo: [
        'Доставка по Беларуси — 1–3 дня после подтверждения заказа.',
        'Самовывоз из магазина: Пресненская наб., 2, Москва',
        'Менеджер свяжется с вами в Telegram после оформления.'
    ]
};