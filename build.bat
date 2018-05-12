setlocal EnableDelayedExpansion
set /p inc="Version increment (minor):"
for /f "delims=" %%A in ('node compress.js %inc%') do (
	IF !errorlevel! == 0 IF NOT "%%A" == "" (
		DEL "Chrome Tools.zip"
		7z a "Chrome Tools.zip" minified -tzip -sdel
		echo "build %%A"
		git reset
		git add manifest.json "Chrome Tools.zip"
		git commit -m "build %%A"
		git tag "%%A"
	) ELSE (
		rd /s /q minified
		git checkout manifest.json
	)
)