; Register Astra as a browser in Windows
!macro customInstall
  ; Register as a StartMenuInternet client (makes Windows recognize it as a browser)
  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra" "" "Astra"

  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\Capabilities" "ApplicationName" "Astra"
  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\Capabilities" "ApplicationDescription" "Astra - Privacy-focused browser"
  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\Capabilities" "ApplicationIcon" "$INSTDIR\Astra.exe,0"

  ; URL associations
  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\Capabilities\URLAssociations" "http" "AstraURL"
  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\Capabilities\URLAssociations" "https" "AstraURL"

  ; File associations
  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\Capabilities\FileAssociations" ".htm" "AstraHTML"
  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\Capabilities\FileAssociations" ".html" "AstraHTML"
  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\Capabilities\FileAssociations" ".xhtml" "AstraHTML"
  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\Capabilities\FileAssociations" ".shtml" "AstraHTML"

  ; Start menu internet entries
  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\Capabilities\StartMenu" "StartMenuInternet" "Astra"

  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\DefaultIcon" "" "$INSTDIR\Astra.exe,0"
  WriteRegStr HKLM "SOFTWARE\Clients\StartMenuInternet\Astra\shell\open\command" "" '"$INSTDIR\Astra.exe"'

  ; Register in RegisteredApplications (required for Default Programs in Settings)
  WriteRegStr HKLM "SOFTWARE\RegisteredApplications" "Astra" "SOFTWARE\Clients\StartMenuInternet\Astra\Capabilities"

  ; Register URL handler classes
  WriteRegStr HKCR "AstraURL" "" "Astra URL"
  WriteRegStr HKCR "AstraURL" "URL Protocol" ""
  WriteRegStr HKCR "AstraURL\DefaultIcon" "" "$INSTDIR\Astra.exe,0"
  WriteRegStr HKCR "AstraURL\shell\open\command" "" '"$INSTDIR\Astra.exe" "%1"'

  ; Register HTML file handler class
  WriteRegStr HKCR "AstraHTML" "" "Astra HTML Document"
  WriteRegStr HKCR "AstraHTML\DefaultIcon" "" "$INSTDIR\Astra.exe,0"
  WriteRegStr HKCR "AstraHTML\shell\open\command" "" '"$INSTDIR\Astra.exe" "%1"'
!macroend

!macro customUnInstall
  ; Clean up registry entries
  DeleteRegKey HKLM "SOFTWARE\Clients\StartMenuInternet\Astra"
  DeleteRegValue HKLM "SOFTWARE\RegisteredApplications" "Astra"
  DeleteRegKey HKCR "AstraURL"
  DeleteRegKey HKCR "AstraHTML"
!macroend
