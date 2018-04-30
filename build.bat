for /f "delims=" %%A in ('node compress.js %1') do set "ver=%%A"

IF %ERRORLEVEL% == 0 (
	DEL "Chrome Tools.zip"
	7z a "Chrome Tools.zip" minified -tzip -sdel
	echo "build %ver%"
	git reset
	git add manifest.json "Chrome Tools.zip"
	git commit -m "build %ver%"
	git tag "%ver%"
) ELSE (
	rd /s /q minified
)