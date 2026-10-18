# Mitmachen

Fehlerberichte und belegte Registerzuordnungen sind willkommen. Bitte ein GitHub-Issue oder einen Pull Request verwenden.

## Neue CAN-Zuordnung melden

Bitte Kesselmodell, Ecotronic-/Firmware-Version (soweit bekannt), Betriebszustand und den gleichzeitig abgelesenen Displaywert angeben. Dazu wenige passende Telegramme mit vollständiger CAN-ID und allen acht Datenbytes, möglichst für mehrere unterschiedliche Displaywerte. Index, Wortposition, Vorzeichen und Skalierung müssen nachvollziehbar sein. Eine gleich aussehende ID an einem anderen Modell genügt nicht.

Unbestätigte Vermutungen als Kandidat kennzeichnen. Ventilrohwerte ohne bestätigte Umrechnung erhalten keine Prozent-Einheit. Private vollständige Aufzeichnungen, Netzwerknamen, Passwörter und API-Schlüssel nicht öffentlich anhängen.

## Änderungen prüfen

Voraussetzungen: Python 3.12+, ESPHome aus `requirements.txt`, Node.js 22+ sowie ein C++17-Compiler.

```sh
python -m pip install -r requirements.txt
python tools/setup_secrets.py
node --test tests/dashboard.test.cjs
python -m unittest discover -s tests -p "test_*.py"
g++ -std=c++17 tests/decoder_test.cpp -o decoder-test
./decoder-test
esphome config pyromat.yaml
esphome config pyromat-api.yaml
esphome compile pyromat.yaml
esphome compile pyromat-api.yaml
```

Für Decoderänderungen kleine anonymisierte Acht-Byte-Beispiele mit erwarteten Ergebnissen ergänzen. Bei Oberflächenänderungen die Vorschau am Desktop und auf schmalem Bildschirm prüfen, einschließlich „Ohne Daten“, Verbindungsausfall und Neustartdialog. Die Vorschau darf keinen Gerätebefehl senden. API-/MQTT-Zugangsdaten und reale `secrets.yaml` bleiben lokal.

Firmware-Builds belegen die Übersetzbarkeit. Änderungen an den Zuordnungen müssen zusätzlich mit echten Displaywerten geprüft werden, bevor sie als für ein neues Modell bestätigt dokumentiert werden.
