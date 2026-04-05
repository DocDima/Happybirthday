#!/bin/bash

echo ""
echo "================================"
echo "  Обновление Cloudflare Tunnel"
echo "================================"
echo ""

read -p "Вставь новый URL туннеля: " URL

if [ -z "$URL" ]; then
    echo "Ошибка: URL не указан!"
    exit 1
fi

# Убираем / в конце если есть
URL="${URL%/}"

# Обновляем config.js
cat > config.js << EOF
(function () {
    var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    var isTunnel = location.hostname.includes('trycloudflare.com');

    if (isLocal) {
        window.APP_API_URL = location.protocol + '//' + location.hostname + ':3000';
    } else if (isTunnel) {
        window.APP_API_URL = location.origin;
    } else {
        window.APP_API_URL = '${URL}';
    }
})();
EOF

echo ""
echo "config.js обновлён: $URL"
echo ""

# Git push
git add config.js
git commit -m "Update tunnel URL"
git push origin main

echo ""
echo "✅ Готово! Vercel подхватит через ~30 ��ек."
