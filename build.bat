node compress.js %1
IF %ERRORLEVEL% == 0 (
	DEL "Chrome Tools.zip"
	7z a "Chrome Tools.zip" minified -tzip -sdel
) ELSE (
	rd /s /q minified
)