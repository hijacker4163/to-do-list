#!/bin/bash
# 建立 macOS 桌面捷徑與 Windows URL 捷徑的腳本
DESKTOP_DIR="$HOME/Desktop"
CURRENT_DIR="$(cd "$(dirname "$0")" && pwd)"
INDEX_FILE="$CURRENT_DIR/index.html?script=AKfycbxnXN0LTz0rQmbCFgQRtpimNc59y1x2yklP1tohiuWuQy2mn1JDl7zYBBV2N4OfHrmS"

echo "正在建立待辦事項桌面捷徑..."

# 1. macOS 桌面捷徑 (.command)
COMMAND_FILE="$DESKTOP_DIR/雲端待辦清單.command"
cat << 'EOF' > "$COMMAND_FILE"
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
# 開啟預設瀏覽器瀏覽待辦事項
open "$DIR/../Documents/GitHub/to-do-list/index.html?script=AKfycbxnXN0LTz0rQmbCFgQRtpimNc59y1x2yklP1tohiuWuQy2mn1JDl7zYBBV2N4OfHrmS" 2>/dev/null || open "file://$(eval echo ~/Documents/GitHub/to-do-list/index.html?script=AKfycbxnXN0LTz0rQmbCFgQRtpimNc59y1x2yklP1tohiuWuQy2mn1JDl7zYBBV2N4OfHrmS)"
EOF
chmod +x "$COMMAND_FILE"

# 2. 建立 .webloc (macOS 原生網路書籤捷徑)
WEBLOC_FILE="$DESKTOP_DIR/雲端待辦清單.webloc"
cat << EOF > "$WEBLOC_FILE"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>URL</key>
    <string>file://$INDEX_FILE</string>
</dict>
</plist>
EOF

echo "✅ 成功在桌面上建立捷徑！"
echo "您現在可以直接從桌面點擊「雲端待辦清單.webloc」或「雲端待辦清單.command」開啟應用。"
