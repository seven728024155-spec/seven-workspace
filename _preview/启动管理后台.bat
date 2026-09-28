@echo off
chcp 65001 >nul
title seven 的工作空间 · 本地管理后台

echo ========================================================
echo           seven 的工作空间 · 本地管理后台
echo ========================================================
echo.
echo 正在启动本地管理后台服务...
echo 启动后将在默认浏览器中自动打开后台管理界面。
echo.

cd /d "%~dp0"
python admin_server.py

if errorlevel 1 (
    echo.
    echo [提示] 运行出错，请确保电脑已安装 Python 3 环境。
    echo 也可以直接使用在线后台：https://seven728024155-spec.github.io/seven-workspace/admin/
    echo.
    pause
)
