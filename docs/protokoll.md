# CAN-Protokoll und Zuordnungen

Diese Dokumentation trennt vorhandene Messwertzuordnungen, aus einer Aufzeichnung abgeleitete Ergänzungen und offene Rohwerte. Eine Plausibilität im Dump ist noch keine Bestätigung am Display einer anderen Regelung.

## Telegrammaufbau

Standard-CAN, 125 kbit/s, acht Datenbytes. Beobachtet wurden `0x23B`, `0x33B`, `0x43B`, `0x53B`. Der Decoder verwendet für alle vier IDs dieselbe beobachtete Struktur:

```
Byte:       0  1 | 2  3 | 4  5 | 6  7
Bedeutung: Index |  W1  |  W2  |  W3
```

Alle vier Felder sind 16-Bit-Werte in Little-Endian-Reihenfolge. `9C 00` ist Index `0x009C`; `9C 03` ist **ein anderer Index**. Gerade beim Vergleich mit Vitoligno-Aufzeichnungen darf das zweite Indexbyte nicht entfallen. Die drei Werte eines Telegramms sind nicht zwingend dieselbe Messgröße.

## Ausgewertete Felder

W1 sind Bytes 2–3, W2 Bytes 4–5, W3 Bytes 6–7; Bytezählung beginnt bei 0. Temperaturen sind Zehntelgrad, soweit unten angegeben.

| Index | Wort | Verwendung | Umrechnung | Einordnung |
| --- | --- | --- | --- | --- |
| `0x0012` | W1 | Betriebsstatus Rohwert | unverändert | Wert 6 beobachtet; Bedeutung offen |
| `0x001E` | W3 | Restsauerstoff | / 10 → % | bisherige Zuordnung, Dump plausibel |
| `0x0027` | W1 | Puffer unten | / 10 → °C | bisherige Zuordnung |
| `0x003F` | W1 / W2 / W3 | Jahr / Monat / Tag | unverändert | aus Dump abgeleitet |
| `0x0042` | W1 / W2 / W3 | Wochentag / Minute / Sekunde | unverändert | Wochentag 1=Montag angenommen; 3 passt zum Mittwoch im Dump |
| `0x0045` | W1 | Stunde | unverändert | Übergang 13→14 beobachtet |
| `0x0054` | W1 | Systemtemperatur | / 10 → °C | bisherige Zuordnung |
| `0x0066` | W1 / W3 | Abgastemperatur / Lüfterdrehzahl | / 10 → °C / unverändert → rpm | bisherige Zuordnung |
| `0x007B` | W3 | Rücklaufmischer Rohwert | unverändert | 62736 beobachtet; keine bestätigte Prozent-Skalierung |
| `0x007E` | W2 | Pufferventil Rohwert | unverändert | 2800 beobachtet; keine bestätigte Prozent-Skalierung |
| `0x0087` | W2 | Primärluftklappe | unverändert → % | bisherige Zuordnung; im Dump nur 0 |
| `0x008D` | W2 | Restsauerstoff Soll **Kandidat** | / 10 → % | Rohwert 70 → 7,0 %, am Display bestätigen |
| `0x008D` | W3 | Kesselrücklauf | / 10 → °C | bisherige Zuordnung |
| `0x0090` | W3 | Sekundärluftklappe | unverändert → % | bisherige Zuordnung; im Dump nur 0 |
| `0x0096` | W1 / W2 | Puffer Mitte / Puffer oben | / 10 → °C | bisherige Zuordnung |
| `0x009C` | W3 | Kesseltemperatur | / 10 → °C | bisherige Zuordnung |
| `0x009F` | W1 | Kesseltemperatur Soll | / 10 → °C | bisherige Zuordnung |
| `0x0117` | W1 / W2 | Register 0x0117 Wert 1 / Wert 2 | unverändert | Bedeutung offen |
| `0x0117` | W3 | Heizungsvorlauf | / 10 → °C | bisherige Zuordnung, Dump plausibel |

Die Bezeichnungen der bestehenden Messwerte stammen aus dem bisherigen Projekt. Die Aufzeichnung plausibilisiert deren Größenordnungen; sie enthält keine synchron fotografierten Kesselanzeigen für eine unabhängige Bestätigung sämtlicher Namen.

## Was die Aufzeichnung belegt

Die untersuchte private Aufzeichnung enthält 181.073 Telegramme über etwa 76 Minuten am 30.10.2024. Die vollständige Datei wird hier nicht veröffentlicht. Beispiele aus den acht Datenbytes:

```
9C 00 00 00 00 00 DE 01 → Kesseltemperatur 47,8 °C
8D 00 7F 00 46 00 CD 01 → Soll-O₂-Kandidat 7,0 %, Rücklauf 46,1 °C
3F 00 E8 07 0A 00 1E 00 → 30.10.2024
42 00 03 00 04 00 34 00 → Wochentag 3, Minute 4, Sekunde 52
45 00 0D 00 00 00 00 00 → Stunde 13
7B 00 00 00 87 00 10 F5 → Rücklaufmischer Rohwert 62736
```

Die Kesseluhr läuft in der Aufzeichnung ungefähr 44 Minuten 38 Sekunden hinter der Aufzeichnungszeit. Ihre Fortschreibung passt einschließlich Stundenwechsel zum Log. Angezeigt wird daher die **empfangene Kesselzeit**, keine vom ESP32 erzeugte oder korrigierte Uhr. Die Firmware setzt die Kesseluhr nicht.

Die zusätzlich untersuchten Dateien `can2.txt` und `can3.log` enthalten gefilterte Telegramme derselben Aufzeichnung (`0x0117` bzw. `0x0012`), keine unabhängige weitere Messung.

## Abweichungen zu Forenbeispielen

[Derbs Veröffentlichung](https://github.com/redarflap/pyromat_to_lora/blob/main/main/twai_network_example_master_main.c), verlinkt im [Forumsbeitrag](https://www.holzheizer-forum.de/forum/thread/55272-k%C3%B6b-pyromat-eco-4-visualisierung/), enthält weitere Zuordnungen und einen teils verschobenen Beginn der Dreiergruppen. Eine vermutete fortlaufende Registeradressierung motiviert den O₂-Sollwert-Kandidaten, ist aber kein allgemeiner Beweis für die Übertragbarkeit aller Felder.

Die dort interessanten Indizes `0x0044`, `0x008C` und `0x0092` fehlen in dieser Aufzeichnung. Alternative Pufferfelder bei `0x0171` und den entsprechenden Wörtern von `0x0174` bleiben null. Sie ersetzen deshalb nicht die hier vorhandenen Pufferwerte.

Im kurzen Vitoligno-300-C-Dump kommen z. B. `0x0398` und `0x07F8` vor. Daraus lässt sich keine belastbare gemeinsame Temperaturbelegung ableiten. Für weitere Modelle werden Aufzeichnungen zusammen mit bekannten Displaywerten und Regelungsversion benötigt.

## Plausibilität und Aktualität

Der Decoder akzeptiert nur acht Bytes auf den vier genannten IDs. Er prüft den vollständigen Index und begrenzt bekannte Messgrößen: Temperaturen 0–150 °C, Abgas 0–600 °C, O₂ 0–25 %, Luftklappen 0–100 %, Lüfter 0–20000 rpm. Diese großzügigen technischen Grenzen schützen vor offensichtlichen Fremd-/Fehlerwerten; sie sind keine Betriebsgrenzen der Heizung. Unbekannte Register liefern keine erfundenen Sensoren, zählen aber als empfangenes CAN-Telegramm.

Nach 30 Sekunden ohne passende CAN-ID meldet die Firmware fehlenden CAN-Empfang. Ein einzelner numerischer Messwert wird nach 60 Sekunden ohne erneute gültige Veröffentlichung ungültig, auch wenn andere Register weiter eintreffen. Jeder Bestandteil von Kesseldatum und -zeit besitzt seine eigene 60-Sekunden-Frist. Ein weiterhin gültiger Sekundenwert kann keine ausgefallene Stunde oder Minute aktuell halten. Text- und binäre Netzwerkangaben werden dagegen bei Änderungen veröffentlicht und benötigen keinen künstlichen Änderungsrhythmus.

Die Firmware interpretiert keine Statusnummer als Heizphase und sendet keine Anwendungs-Steuertelegramme. Im Standardmodus `NORMAL` bestätigt der CAN-Controller empfangene Frames auf dem Bus. Nur mit geeigneter Busumgebung auf `LISTENONLY` umstellen.
