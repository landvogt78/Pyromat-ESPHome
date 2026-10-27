# FoxAIR UDP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Drei aktuelle Holzpuffertemperaturen vom bestehenden Pyromat zum A6 senden.
**Architecture:** Optionale Root-Konfiguration plus UDP-Paket; drei interne Copy-Sensoren mit eigenem Timeout. Bestehender CAN-Decoder bleibt die einzige Datenquelle.
**Tech Stack:** ESPHome YAML, Python unittest/PyYAML, bestehende Node-Tests.
**Spec:** docs/superpowers/specs/2026-10-27-foxair-udp-design.md

## Global Constraints

Keine Kompilierung, C++-Erzeugung, Firmwarebuilds, Flash, Gerätezugriff oder CI. Keine realen Secrets speichern/ausgeben. Main und bisherige Einstiegskonfigurationen erhalten. Port 18511, Sendername pyromat, drei feste Broadcast-IDs, 15-s-Timeout, 2-s-Versand.

## Review Focus

Start ohne CAN-Werte; Ausfall nur eines Fühlers; konstante erneuerte CAN-Werte; laufender UDP-Sender bei ausgefallenem CAN; abweichender Sendername/Schlüssel oder getrennte WLAN-Segmente.

### Task 1: Sender und Inbetriebnahme

Files: create pyromat-foxair.yaml, packages/foxair_udp.yaml, tests/test_foxair_udp.py; modify secrets.example.yaml, tools/setup_secrets.py, tests/test_setup.py, README.md.

Consumes: puffer_oben/puffer_mitte/puffer_unten aus packages/entities.yaml, jeweils ohne Delta-Filter und nur ereignisgesteuert publiziert. Produces: top_live/mid_live/bottom_live via encrypted UDP18511, eigener Timeout15s, Intervall2s.

- [x] Test first: optionale Einstiegskonfiguration, passende IDs/Quellen, jeweils eigener NaN-Timeout, keine periodische Neuabtastung alter Werte, verschlüsselter Versand und separate gültige Zufallsschlüssel; vorhandene Einstiegskonfigurationen benötigen den neuen Schlüssel nicht.
- [x] Run Python tests; expected failure because sender/key support is absent.
- [x] Add minimal YAML plus secret generation and operator instructions. Confirm upstream CopySensor only republishes source callbacks and TimeoutFilter defaults to NaN.
- [x] Run python3 -m unittest discover -s tests -p 'test_*.py' and node --test tests/*.test.cjs; expect all pass. git diff --check must pass. No C++/ESPHome build.
- [ ] One independent read-only review, fix material findings, then commit and publish draft PR with [skip ci], retaining main.

## Ergebnis 27.10.2026

Vier neue Vertrags-/Schlüsseltests zuerst erwartungsgemäß fehlgeschlagen, danach grün; insgesamt 6 Python- und 20 Node-Prüfungen bestanden. Diff-Prüfung grün. Unabhängiger Quellenreview ohne kritische, wichtige oder kleinere Befunde. Copy-/Timeout-Laufzeit anhand offizieller Quellen gelesen, nicht ausgeführt. Keine ESPHome-Validierung, C++-Erzeugung, Compiler, Firmware, Gerätezugriffe oder CI. Main bleibt unverändert; Draft-PR-Veröffentlichung ist der abschließende Schritt.
