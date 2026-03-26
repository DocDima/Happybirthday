(function () {
    var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

    // ─────────────────────────────────────────────────────────
    // НАСТРОЙКА: укажи URL своего сервера для production
    // Получи бесплатный туннель: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    // Команда: cloudflared tunnel --url http://localhost:3000
    // ─────────────────────────────────────────────────────────
    var PRODUCTION_API = 'https://ЗАМЕНИ-НА-URL-СВОЕГО-СЕРВЕРА';

    window.APP_API_URL = isLocal
        ? location.protocol + '//' + location.hostname + ':3000'
        : PRODUCTION_API;
})();
