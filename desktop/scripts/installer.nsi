Unicode true
!include "MUI2.nsh"
Name "Davara PLD"
OutFile "${DEST}"
InstallDir "$LOCALAPPDATA\Programs\Davara PLD"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "Davara PLD"
VIAddVersionKey "CompanyName" "Davara Abogados S.C."
VIAddVersionKey "FileDescription" "Asistente de instalación de Davara PLD"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Davara Abogados S.C."
!define MUI_ABORTWARNING
!define MUI_ICON "${ICONFILE}"
!define MUI_UNICON "${ICONFILE}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\Davara PLD.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir Davara PLD e iniciar la configuración"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Spanish"
Section
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "${SOURCE}\*.*"
  WriteUninstaller "$INSTDIR\Desinstalar Davara PLD.exe"
  CreateShortcut "$SMPROGRAMS\Davara PLD.lnk" "$INSTDIR\Davara PLD.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DavaraPLD" "DisplayName" "Davara PLD"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DavaraPLD" "Publisher" "Davara Abogados S.C."
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DavaraPLD" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DavaraPLD" "UninstallString" '"$INSTDIR\Desinstalar Davara PLD.exe"'
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  !include "${FILELIST}"
  Delete "$INSTDIR\Desinstalar Davara PLD.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\Davara PLD.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DavaraPLD"
SectionEnd
