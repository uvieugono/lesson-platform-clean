# Windows Command Prompt version (run this in cmd.exe)

REM Create new directory structure
mkdir app\lesson 2>nul
mkdir components\ui 2>nul
mkdir lib 2>nul
mkdir styles 2>nul
mkdir public 2>nul

REM Remove unnecessary files
del App.jsx 2>nul
del vite.config.js 2>nul
del index.html 2>nul
del tsconfig.app.json 2>nul
rmdir /s /q -p 2>nul

REM Move and reorganize files
move RefocusedLessonPage.tsx app\lesson\page.tsx 2>nul
move src\components\*.* components\ 2>nul
move src\lib\*.* lib\ 2>nul
move src\styles\*.* styles\ 2>nul
move src\*.* app\ 2>nul

REM Clean up empty directories
rmdir /s /q src 2>nul

REM Move any UI components
move components\card.tsx components\ui\card.tsx 2>nul

REM Ensure styles/globals.css exists
if not exist styles\globals.css (
    echo @tailwind base; > styles\globals.css
    echo @tailwind components; >> styles\globals.css
    echo @tailwind utilities; >> styles\globals.css
)

REM Clean build artifacts
rmdir /s /q .next 2>nul
rmdir /s /q node_modules 2>nul

REM Reinstall dependencies
npm install

REM Clear npm cache
npm cache clean --force

REM Development build
npm run dev