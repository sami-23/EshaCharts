@echo off
echo Starting EshaCharts Backend...
cd /d "%~dp0backend"
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)
python main.py
pause
