Ein ESPHome-Projekt für einen Holzvergase Viessmann (ehemals Köb) Pyromat Eco. 
Dieser bietet eine CAN-Bus Schnittstelle, über die man mittel ESP32 und MCP2515-Modul aktuelle Zustandswerte auslesen kann.
Dieser YAML liefert verschiedene Werte/Entitäten, die für eine Nutzung zur Visualisierung oder Automatisierung sinnvoll sind.

Der ESP32 sowie das Modul können mittels StepDown-Converter direkt mit den internen 24V DC des Holzvergasers versorgt werden, so dass diese z.B. unsichtbar neben der Hauptlatine im Holzvergasers eingebaut werden können.

Hier auch noch die Verkabelung des MCP2515-Moduls mit dem ESP32

ESP32 5V → Modul VCC
ESP32 GND → Modul GND
ESP32 GPIO 23 (MOSI) → Modul SI (Slave In)
ESP32 GPIO 19 (MISO) → Modul SO (Slave Out)
ESP32 GPIO 18 (SCK)** → Modul **SCK` (Serial Clock)
ESP32 GPIO 5 (CS)** → Modul **CS` (Chip Select)
ESP32 GPIO 4 → Modul INT (Interrupt)
Modul H → CAN-High-Draht Pyromat
Modul L → CAN-Low-Draht Pyromat
Endwiderstand habe ich nicht gebraucht
