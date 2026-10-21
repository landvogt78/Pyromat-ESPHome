# Pyromat ESPHome

Lokaler Anlagenmonitor für den **Köb Pyromat Eco mit Ecotronic-Regelung**. Ein ESP32 mit MCP2515 empfängt CAN-Telegramme und stellt die ausgewerteten Werte im Browser, über die native ESPHome-API und optional per MQTT bereit.

[![Firmware und Tests](https://github.com/landvogt78/Pyromat-ESPHome/actions/workflows/validate.yml/badge.svg)](https://github.com/landvogt78/Pyromat-ESPHome/actions/workflows/validate.yml)

![Hydraulikschema mit beispielhaften Temperaturen](docs/hydraulik-vorschau.svg)

*Schematische Vorschau mit Beispieldaten, kein individueller Anlagenplan.*

[Einrichtung](#einrichtung) · [Hardware](#hardware) · [CAN-Detektiv](#can-detektiv) · [Anbindungen](#anbindungen) · [CAN-Protokoll](docs/protokoll.md) · [Entwicklung](#vorschau-und-entwicklung)

## Oberfläche und Funktionsumfang

Die deutschsprachige Oberfläche liegt einschließlich Grafik und Gestaltung im ESP32-Flash. Sie benötigt keine Cloud und lädt keine externen Schriften oder JavaScript-Bibliotheken nach. Hell- und Dunkelmodus sind verfügbar.

| Ansicht | Inhalt |
| --- | --- |
| **Übersicht** | Hydraulikschema, Kessel- und Abgastemperatur, Restsauerstoff, Lüfter, Luftklappen, Sollwerte und Kesseluhr |
| **Alle Werte** | Temperaturen von Kessel, Rücklauf, System, Heizkreis und Pufferspeicher sowie Verbrennungswerte und Kesseldatum/-zeit |
| **Diagnose** | CAN-Empfang, Datenalter, Telegrammzähler, WLAN-Verbindung, Signalstärke, ESP32-Betriebszeit, IP-Adresse und WLAN-Name |
| **CAN-Detektiv** | Live-Mitschnitt, Hex-Filter, Referenzvergleich, farbige Markierungen, Speicheranzeigen, CSV-Export und Kurzanleitung |

Ungeklärte Register und der nicht interpretierte Betriebsstatus erscheinen nicht in der Diagnoseansicht. Die vorhandenen Rohwertsensoren stehen weiterhin über ESPHome-API/MQTT zur Verfügung; ihre offenen Bedeutungen dokumentiert das [CAN-Protokoll](docs/protokoll.md).

Die Neustarttaste startet nach Bestätigung den **ESP32**, nicht den Heizkessel. Der CAN-Detektiv dient ausschließlich der Aufzeichnung. Es gibt keine Bedienoberfläche zum Zusammenstellen oder Senden von CAN-Schreibbefehlen.

Fehlende Messwerte erscheinen als `—`. Nach 30 Sekunden ohne passende CAN-Telegramme meldet die Anwendung fehlenden Empfang. Einzelne Messwerte werden nach 60 Sekunden ohne gültige Aktualisierung ungültig. Ein unterbrochener Browser-Datenstrom wird ebenfalls angezeigt. Die Kesseluhr zeigt die empfangene Regelungszeit und wird vom ESP32 nicht gestellt.

## Kompatibilität

Vorgesehen sind **ESP32 DevKit (`esp32dev`), MCP2515 und 125 kbit/s**. Die bekannten Messwertzuordnungen wurden mit Aufzeichnungen des Projektkessels abgeglichen. O₂-Sollwert und Kesseluhr wurden zusätzlich am Projektkessel bestätigt. Die Ecotronic-Regelungsversion ist nicht dokumentiert; Zuordnungen sind deshalb nicht pauschal auf andere Geräte übertragbar.

Der Messwertdecoder verarbeitet acht Datenbytes auf `0x23B`, `0x33B`, `0x43B` und `0x53B`. Ihr Aufbau ist `[Index LE16][W1 LE16][W2 LE16][W3 LE16]`. Entscheidend ist der vollständige 16-Bit-Index: `0x009C` und `0x039C` sind verschiedene Indizes. Der CAN-Detektiv erfasst zusätzlich andere Standard- und Extended-IDs als Rohdaten.

Für den **Vitoligno 300-C** und andere Regelungsvarianten sind diese Messwertzuordnungen nicht bestätigt. Details, belegte Felder und offene Fragen stehen in [docs/protokoll.md](docs/protokoll.md).

## Einrichtung

### 1. Repository und Werkzeuge

Das vollständige Repository einschließlich `packages/`, `include/` und `web/` verwenden. Benötigt werden Python 3.12+ und die in `requirements.txt` festgelegte ESPHome-Version **2026.9.1**. Eine virtuelle Python-Umgebung ist empfehlenswert.

```sh
git clone https://github.com/landvogt78/Pyromat-ESPHome.git
cd Pyromat-ESPHome
python -m pip install -r requirements.txt
python tools/setup_secrets.py
```

Das Hilfsprogramm erzeugt eine lokale, von Git ausgeschlossene `secrets.yaml` und überschreibt keine vorhandene Datei. Es erzeugt einen gültigen API-Schlüssel sowie getrennte Passwörter für Webzugang und Einrichtungs-WLAN. Die Web-Zugangsdaten sind vorbereitet, werden in der aktuellen Konfiguration aber nicht verwendet.

### 2. Lokale Zugangsdaten

In `secrets.yaml` das eigene WLAN und bei Bedarf MQTT eintragen:

| Schlüssel | Verwendung im aktuellen Stand |
| --- | --- |
| `my_wifi_ssid`, `my_wifi_password` | WLAN-Verbindung |
| `api_encryption_key` | Verschlüsselung der nativen ESPHome-API; Base64-kodierter 32-Byte-Schlüssel |
| `fallback_ap_password` | Passwort des Einrichtungs-WLANs |
| `mqtt_broker`, `mqtt_port` | Broker und Port für die MQTT-Variante |
| `mqtt_username`, `mqtt_password`, `mqtt_topic_prefix` | MQTT-Anmeldung und Themen-Präfix |
| `web_server_username`, `web_server_password` | Vorbereitete Angaben für eine optional aktivierte Webserver-Anmeldung |

[`secrets.example.yaml`](secrets.example.yaml) enthält nur Platzhalter. Echte Zugangsdaten und vollständige private CAN-Aufzeichnungen nicht veröffentlichen.

**Aktueller Konfigurationsstand:** Die native API ist verschlüsselt. Der HTTP-Webserver hat in `packages/bridge.yaml` derzeit **keine Anmeldung**. ESPHome-OTA ist aktiv, eine OTA-Verschlüsselung ist derzeit **nicht konfiguriert**. Webserver-OTA ist ausgeschaltet. Diese Einstellungen vor dem Einsatz im eigenen Netzwerk prüfen; der Webserver bietet kein HTTPS.

### 3. Variante wählen und installieren

| Hauptdatei | Enthalten |
| --- | --- |
| `pyromat.yaml` | Weboberfläche, native API und MQTT |
| `pyromat-api.yaml` | Weboberfläche und native API, ohne MQTT |

```sh
esphome config pyromat.yaml
esphome compile pyromat.yaml
esphome run pyromat.yaml --device COM5
```

`COM5` durch den tatsächlichen USB-Port ersetzen, unter Linux etwa `/dev/ttyUSB0`. Für die Variante ohne MQTT in allen Befehlen `pyromat-api.yaml` verwenden. Die Erstinstallation erfolgt über USB. Spätere Updates lassen sich über ESPHome an die Geräteadresse übertragen:

```sh
esphome run pyromat.yaml --device pyromat.local
```

Die gewählte Variante und die lokale `secrets.yaml` beibehalten. Das Projekt verwendet ESP-IDF. Ohne API-Client oder MQTT-Verbindung wird kein automatischer Verbindungsneustart ausgelöst.

### 4. Oberfläche öffnen

Im eigenen Netzwerk [http://pyromat.local](http://pyromat.local) aufrufen. Falls die Namensauflösung nicht funktioniert, die IP-Adresse aus dem Router verwenden. Bei fehlender WLAN-Verbindung steht das passwortgeschützte Einrichtungsnetz **„Pyromat Einrichtung“** mit Portal zur Verfügung.

## Hardware

Die Standardbelegung in [`packages/bridge.yaml`](packages/bridge.yaml) lautet:

| ESP32 | MCP2515 / Anschluss |
| --- | --- |
| GPIO18 | SCK |
| GPIO23 | SI / MOSI |
| GPIO19 | SO / MISO |
| GPIO5 | CS |
| GND | Gemeinsame Masse gemäß Anlagenbeschaltung |
| CAN-Seite des Transceivers | CAN-H und CAN-L der Regelung |

Ein MCP2515-Modul mit geeignetem CAN-Transceiver und standardmäßig **8-MHz-Quarz** verwenden. Der INT-Pin wird nicht verwendet. ESP32-GPIOs sind nicht 5-V-tolerant; Versorgung und Logikpegel des Moduls müssen passen. Eine 24-V-Anlagenversorgung benötigt einen geeigneten Spannungswandler. Der Bus wird nur an seinen beiden Enden terminiert. GPIO5 ist ein Strapping-Pin; die entsprechende ESPHome-Warnung ist bei dieser Belegung zu erwarten.

Abweichungen in der gewählten Hauptdatei vor `packages:` übersteuern, beispielsweise:

```yaml
substitutions:
  device_name: pyromat
  friendly_name: Pyromat Eco
  mcp2515_cs_pin: "5"
  mcp2515_clock: 8MHz
```

Die Quarzfrequenz muss dem Modul entsprechen. Standard ist `can_mode: NORMAL`: Die Anwendung sendet keine CAN-Steuertelegramme, der Controller bestätigt empfangene Frames jedoch auf Hardwareebene mit ACK. `LISTENONLY` setzt eine Busumgebung voraus, in der andere Teilnehmer die notwendigen Bestätigungen übernehmen.

## CAN-Detektiv

### Einen Mitschnitt untersuchen

1. Den Reiter **CAN-Detektiv** öffnen und **Aufzeichnen** wählen. Das beginnt eine neue Sitzung und ersetzt die bisherige Aufzeichnung. Benötigte Daten vorher exportieren.
2. Einige Telegramme abwarten und **Referenz setzen**. Der Browser merkt sich den zuletzt empfangenen Payload je CAN-ID und vollständigem Index. Später empfangene Abweichungen werden byteweise hervorgehoben.
3. Mit **Markierung** Abschnitte kennzeichnen, etwa vor und nach einer Bedienung am Originalbedienteil. Die Tabelle zeigt nummerierte farbige Trennlinien. Mehrere Markierungen an derselben Sequenz bleiben einzeln sichtbar. Vier Farben wechseln sich ab; die Nummer identifiziert die Markierung eindeutig.
4. Bei Bedarf nach **CAN-ID**, **16-Bit-Index** oder **Änderungen zur Referenz** filtern. Hexwerte wie `0x008D` sind mit und ohne `0x` zulässig. Markierungen bleiben auch zwischen herausgefilterten Telegrammen sichtbar. Neueste Einträge stehen oben.
5. **Stoppen**, den Abschluss des Abrufs abwarten und **CSV exportieren**. Der Export enthält die im Browser gespeicherten, zum Filter passenden Frames sowie alle Sitzungsmarkierungen. Für eine vollständige Analyse beide Hex-Filter leeren und **Nur Änderungen zur Referenz** ausschalten.

**Löschen** leert den Mitschnitt, die Browserreferenz und die Markierungen. Eine bereits laufende Aufnahme läuft weiter. Nach einem ESP32-Neustart ist die Aufnahme ausgeschaltet.

### Zeitangaben, Export und Speicher

- **Zeit seit ESP-Start / `Zeit_ms`:** ESP32-Laufzeit in Millisekunden, keine Uhrzeit und keine Zeit seit Aufnahmestart.
- **Markierungen:** Die Sequenz bezieht sich auf das zuletzt im Browser geladene Telegramm. Die angezeigte Zeit stammt vom Browser; im CSV steht sie als UTC-Zeit mit `Z`. Sie ist kein exakt synchronisierter CAN-Zeitstempel.
- **Tabelle:** Höchstens 150 gefilterte Telegramme plus die zugehörigen Markierungslinien. Der CSV-Export ist nicht auf diese 150 Frames beschränkt.
- **ESP32:** Ringpuffer für 2.048 Frames. Ein voller Puffer überschreibt die ältesten Einträge. Bereits vom Browser abgerufene Frames bleiben dort erhalten.
- **Browser:** Bis zu 30.000 Frames. Warnungen erscheinen ab 80 % und 95 % Belegung. Danach werden ältere Frames entfernt und gezählt. Neuladen oder Schließen verliert Browserverlauf, Referenz und Markierungen; der ESP-Puffer kann nur die noch enthaltenen Frames erneut liefern.

Die CSV verwendet Semikolon als Trennzeichen und enthält `Zeit_ms;Sequenz;CAN_ID;Format;RTR;Index;Daten_HEX`. Markierungen stehen am Ende als Kommentarzeilen, beispielsweise `# Markierung 1 bei Sequenz 588 (2026-10-21T07:07:39.217Z)`.

Der Browser fragt `GET /can/trace?after=<Sequenz>` nur bei sichtbarem CAN-Reiter und sichtbarer Seite ab, maximal 96 Frames je Antwort. Die Aufnahme im ESP32 läuft bis **Stoppen** weiter. Nicht rechtzeitig abgerufene Frames und Ringpuffer-Überschreibungen werden getrennt angezeigt. Hardwareseitige MCP2515-Verluste sind damit nicht messbar; auch lückenlose Sequenznummern beweisen keinen vollständigen Busmitschnitt.

Eine beobachtete Sollwertänderung im zyklischen Datenstrom identifiziert noch keinen Schreibbefehl. Es gibt keine CAN-Schreibfunktion und keine Rohdaten-Veröffentlichung über MQTT. Weitere Grenzen und Registerbeispiele stehen im [CAN-Protokoll](docs/protokoll.md).

## Anbindungen

**Home Assistant:** Die ESPHome-Integration mit `pyromat.local` bzw. Geräte-IP und `api_encryption_key` verbinden. Standardport ist `6053`. Bei gleichzeitigem MQTT-Empfang können doppelte Entitäten entstehen; eine Anbindung wählen.

**ioBroker / MQTT:** `pyromat.yaml` verwenden und die Brokerdaten in `secrets.yaml` setzen. Discovery ist aktiviert, das Themen-Präfix ist standardmäßig `pyromat`. Port `1883` verwendet eine unverschlüsselte MQTT-Verbindung.

**HTTP:** Die ESPHome-Webserver-Endpunkte bleiben verfügbar, im aktuellen Stand ohne Anmeldung, beispielsweise:

```sh
curl http://pyromat.local/sensor/Kesseltemperatur
```

Die ESP-Neustarttaste verwendet `POST /button/ESP%20neu%20starten/press`. Der Trace-Endpunkt übernimmt die Webserver-Zugriffsregeln; eine Anmeldung besteht nur, wenn sie in der eigenen Konfiguration aktiviert wurde.

## Aktualisieren

Vor einem Update die lokale Konfiguration und `secrets.yaml` sichern. Das gesamte Repository aktualisieren; eine einzelne YAML-Datei genügt nicht. API-Schlüssel und WLAN-Zugangsdaten bleiben lokal. Neue Angaben lassen sich bei Bedarf mit `python tools/setup_secrets.py --output secrets.generated.yaml` erzeugen und gezielt übernehmen.

Sichtbare Namen beeinflussen automatisch erzeugte Entitäten und MQTT-Themen. Insbesondere heißt der O₂-Sollwert **Restsauerstoff Soll**. Die Rohregister heißen **Register 0x007B W3 Rohwert** und **Register 0x007E W2 Rohwert**; ihre internen ESPHome-IDs tragen aus Kompatibilitätsgründen noch die früheren Ventilnamen. Bestehende Home-Assistant-/ioBroker-Zuordnungen bei einem Umstieg prüfen. Die aktuelle Diagnoseansicht zeigt diese ungeklärten Felder nicht mehr.

## Vorschau und Entwicklung

Ohne ESP32 die lokale Vorschau starten:

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory web
```

[http://127.0.0.1:8000/preview.html](http://127.0.0.1:8000/preview.html) kennzeichnet Beispieldaten ausdrücklich. Die Ansichten **Ohne Daten** und **Verbindungsausfall**, Hell-/Dunkelmodus, Markierungen und Filter lassen sich dort prüfen. Aufnahmebefehle sind deaktiviert; die Neustarttaste sendet in der Vorschau keinen Gerätebefehl.

Prüfungen mit Node.js 22+, Python und einem C++17-Compiler:

```sh
node --test tests/dashboard.test.cjs tests/can-detektiv.test.cjs
python -m unittest discover -s tests -p "test_*.py"
g++ -std=c++17 -Wall -Wextra -Werror tests/decoder_test.cpp -o /tmp/pyromat-decoder-test
/tmp/pyromat-decoder-test
g++ -std=c++17 -Wall -Wextra -Werror -pthread tests/can_trace_test.cpp -o /tmp/pyromat-can-trace-test
/tmp/pyromat-can-trace-test
esphome config pyromat.yaml
esphome config pyromat-api.yaml
esphome compile pyromat.yaml
esphome compile pyromat-api.yaml
```

Die `/tmp`-Ausgabepfade unter Windows anpassen. Für die ESPHome-Prüfung wird eine lokale `secrets.yaml` benötigt. Die [GitHub-Prüfung](.github/workflows/validate.yml) führt die Tests aus, prüft beide Konfigurationen und baut beide Firmwarevarianten. Ein erfolgreicher Build bestätigt keine neue CAN-Zuordnung.

Belegte Zuordnungen und Fehlerberichte sind willkommen; Hinweise unter [CONTRIBUTING.md](CONTRIBUTING.md). Das Projekt entstand aus dem Austausch im [Holzheizer-Forum](https://www.holzheizer-forum.de/forum/thread/55272-k%C3%B6b-pyromat-eco-4-visualisierung/) und berücksichtigt [Derbs CAN-Auswertung](https://github.com/redarflap/pyromat_to_lora/blob/main/main/twai_network_example_master_main.c) als Vergleich. Es ist ein Community-Projekt und keine offizielle Software von Köb oder Viessmann.
