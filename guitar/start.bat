@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 拾光吉他 · 练琴助手
echo 电脑打开: http://127.0.0.1:8123/
echo 手机打开: http://192.168.1.3:8123/  (同一 WiFi)
echo 关闭这个窗口即停止服务
start "" http://127.0.0.1:8123/
python -m http.server 8123 --bind 0.0.0.0
pause
