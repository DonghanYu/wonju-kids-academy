@echo off
chcp 65001 > nul
REM 내 PC에서 실데이터로 빌드하고 브라우저로 여는 스크립트 (Python 3.10+ 필요)
cd /d %~dp0
if "%NEIS_API_KEY%"=="" set /p NEIS_API_KEY=NEIS 인증키를 입력하세요: 
python -m pipeline.build || (echo 빌드 실패 & pause & exit /b 1)
start "" http://localhost:8000
python -m http.server 8000 --directory web
