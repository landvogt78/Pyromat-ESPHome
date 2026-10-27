# Pyromat → A6 Holzpuffertemperaturen

Auftrag: Die bereits im FoxAIR-PR1 vorbereitete direkte UDP-Schnittstelle jetzt auf der Pyromat-Seite ergänzen. MQTT/API und CAN-Decodierung bleiben erhalten.

Eine optionale Einstiegskonfiguration `pyromat-foxair.yaml` ergänzt `pyromat.yaml` um `packages/foxair_udp.yaml`. Drei interne Copy-Sensoren übernehmen ausschließlich veröffentlichte CAN-Messwerte von `puffer_oben`, `puffer_mitte`, `puffer_unten`; jeder besitzt einen eigenen 15-s-Timeout mit NaN. Unveränderte neu empfangene CAN-Werte erneuern die Frische; UDP-Wiederholungen nicht. Keine Delta-, Heartbeat- oder NaN-Unterdrückungsfilter. Bestehende Sensoren und 60-s-Anzeigetimeouts bleiben erhalten.

Port 18511; Broadcast-IDs `top_live`, `mid_live`, `bottom_live`; Versand alle 2 s, zusätzlich bei Änderungen, verschlüsselt mit `pyromat_a6_udp_key` und Rolling Code. Der A6 prüft bereits Ping-Pong; der Sender beantwortet dessen Challenges automatisch, ohne selbst einen Provider abonnieren zu müssen. ESPHome-Knotenname des Senders muss `pyromat` bleiben oder im A6-Provider passend geändert werden.

Ansätze: MQTT-Brücke verworfen, weil sie dem vorhandenen direkten Regelpfad nicht entspricht. Die ältere FoxAIR-Rohtelegrammvorlage würde CAN-Decodierung und MQTT-Challenge-Logik duplizieren. Copy-Sensoren mit eigenem Timeout nutzen die aktuellen, bereits ungefiltert bei jedem CAN-Update veröffentlichten Werte; dies ist die gewählte kleine Erweiterung.

Neue Setups erhalten einen separaten zufälligen Schlüssel durch das bestehende Setup-Werkzeug. Bestehende secrets.yaml wird niemals überschrieben; vorhandene A6-Schlüssel lokal übernehmen. Keine echten Schlüssel im Repository oder in Toolausgaben.

Grenzen: kein Compiler, keine C++-Erzeugung, kein Firmwarebuild, Flash, Gerätezugriff oder CI. Python/Node prüfen die Integration ohne Firmwarelauf; Laufzeitverhalten von Copy/Timeout/Packet Transport wird anhand offizieller ESPHome-Quellen geprüft, nicht als Gerätetest ausgegeben. Veröffentlichung als Draft-PR im eigenen Branch mit [skip ci], kein Merge.
