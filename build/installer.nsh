; ── Pre-install: close any running instance ──
!macro customInit
  ExecWait '"$SYSDIR\taskkill.exe" /F /IM "ID Aura.exe" /T' $0
  Sleep 500
!macroend

; ── Post-install: register .moodboard file association (per-user) ──
!macro customInstall
  WriteRegStr HKCU "Software\Classes\.moodboard" "" "IDAuraMoodboard"
  WriteRegStr HKCU "Software\Classes\IDAuraMoodboard" "" "ID Aura Moodboard"
  WriteRegStr HKCU "Software\Classes\IDAuraMoodboard\DefaultIcon" "" "$appExe,0"
  WriteRegStr HKCU "Software\Classes\IDAuraMoodboard\shell\open\command" "" '"$appExe" "%1"'
!macroend

; ── Uninstall: remove registration ──
!macro customUnInstall
  DeleteRegValue HKCU "Software\Classes\.moodboard" ""
  DeleteRegKey HKCU "Software\Classes\IDAuraMoodboard"
!macroend
