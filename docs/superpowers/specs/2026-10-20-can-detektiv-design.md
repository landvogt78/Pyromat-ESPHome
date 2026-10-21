# CAN-Detektiv und Schreibtest-Vorschau (Design, 20.10.2026)

## Ausgangslage
Der Pyromat Eco mit Ecotronic, ESP32 und MCP2515 arbeitet derzeit als rein lesender Anlagenmonitor (125 kbit/s). Die bestehenden vier CAN-IDs `0x23B`, `0x33B`, `0x43B`, `0x53B` und der laufende Decoder bleiben erhalten. Die vom Eigentümer am 20.10.2026 bestätigten Zuordnungen sind Kesseluhr (Datum nur aus dem Dump plausibel) sowie O₂-Sollwert (Index `0x008D`, W2). Behauptete Rücklaufmischer-/Pufferventilwerte bei `0x007B`/W3 und `0x007E`/W2 sind **nicht plausibel bestätigt** und dürfen nicht als reale Stellwerte erscheinen.

## Ziele
- Vierter Reiter „CAN-Detektiv“ in der bestehenden lokalen ESPHome-Weboberfläche.
- Auf Knopfdruck vollständigen Standard-CAN-Empfang und ggf. Extended-CAN-Frames mitschneiden; Datum der Messung über Browser-Uhr, Zeitstempel vom ESP32 als `millis()`.
- Live-Tabelle mit Filtern für CAN-ID/16-bit-Index, Kennzeichnung geänderter Payloads, Setzen von Referenzwerten und CSV-Download.
- Kompakt gehaltenes Offline-„Schreibtest-Labor“ mit Plausibilitätsprüfung von Standard-IDs und Datenbytes und einer HEX-Vorschau; **keine Übertragung**. Darstellung dauerhaft als „Simulation“, keine aktive Sendeschaltfläche.
- Schutz der regulären Datenerfassung: Mitschnitt standardmäßig AUS, fester Ringpuffer, keine Flash-Schreibzugriffe, nachvollziehbare Überlauf- und Client-Verlustzähler.

## Technischer Ansatz
- Neue pure C++-Klasse `pyromat::CanTrace` in `include/pyromat_can_trace.h`: Ringpuffer mit fester Obergrenze, laufender Sequenznummer, alterssicherem ms-Zeitstempel, Standard/Extended-Kennung und RTR. `start()`, `stop()`, `clear()`, `capture(...)`, `pop_batch()`. Schreib-API ausdrücklich nicht enthalten.
- ESPHome-CAN-Trigger mit `can_id: 0`, `can_id_mask: 0` für Standard und Extended CAN. In Trigger-Lambdas stehen nach dokumentierter ESPHome-API `x`, `can_id` und `remote_transmission_request` zur Verfügung. Die vier bestehenden Decoder-Trigger bleiben unverändert.
- Datenübertragung über einen separat registrierten GET-only `AsyncWebHandler` auf `/can/trace`, dessen Digest-Zugang mit `web_server_base::add_handler()` aus dem bestehenden lokalen Webserver übernommen wird. Antwort nach Sequenz-Cursor, maximal 96 Frames pro Abruf. ESPHome-Buttons `CAN Aufzeichnung starten`, `stoppen`, `loeschen` steuern nur den RAM-Mitschnitt.
- Dashboard validiert JSON-Daten, führt ein begrenztes eigenes Client-Log, erkennt Sequenzlücken, filtert und exportiert CSV. Langsame Browser bzw. durch den Puffer überschriebenen Frames werden ausdrücklich angezeigt.
- Eine Schreibtest-Vorschau verarbeitet CAN-ID (nur 11 Bit in erster Version) und maximal acht HEX-Bytes lokal im Browser. Sie besitzt keinen `fetch`-, `canbus.send`-, API- oder MQTT-Sendepfad. Eine spätere echte Sendeimplementierung benötigt separat bestätigte CAN-Protokolle und Sicherheitsfreigaben.

## Risiken und Verifikation
- MCP2515 kann bei hoher Last Frames verlieren, bevor die Firmware sie erreicht; interne Überlaufzähler messen nur Applikationsverluste.
- Gekoppelte CSS/JS-Ressourcen liegen im ESP32-Flash. Keine neuen Web-Libraries, kein CDN, keine Netzwerkverbindungen außer ESPHome lokal.
- Unit-Tests für Ringpuffer-Overflow/Stop/Charge und Browser-Paketparser/Schreibtest-Trockenlauf; Preview ohne echte Kesselverbindung; vorhandene Decoder-Tests.
- Keine Hardwaretests am realen Pyromat, bevor Firmware und Verkabelung vor Ort separat kontrolliert sind. Der Empfang im Standardmodus `NORMAL` quittiert Frames weiterhin auf CAN-Hardwareebene (ACK).

## Abgrenzung
Keine Funktionsfreigabe der Verbrennung; keine Veränderung von Sicherheits-, Luftklappen-, Lüfter-, Pumpen- oder Kesselparametern. Kein CAN-Transmit-Code und keine automatische Steuerung durch das HEMS.
