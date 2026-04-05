(function () {
    var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    var isTunnel = location.hostname.includes('trycloudflare.com');

    if (isLocal) {
        window.APP_API_URL = location.protocol + '//' + location.hostname + ':3000';
    } else if (isTunnel) {
        // Доступ через туннель напрямую — API на том же домене
        window.APP_API_URL = location.origin;
    } else {
        // Доступ через Vercel — нужен URL туннеля
        window.APP_API_URL = 'https://warren-est-motors-theoretical.trycloudflare.com';
    }
})();
