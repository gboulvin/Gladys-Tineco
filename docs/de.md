# Tineco für Gladys Assistant

Verbindet die Nasssauger Ihres Tineco-Kontos (Floor One S3, S5, S7, S7
Flashdry, S7 Stretch, iFloor… — alle Modelle, die die **Tineco**-App anzeigt)
mit Gladys: Akku, Aktivität, Wassertanks, Sprachansagen und
Bürstenbeleuchtung, dazu Szenen-Auslöser, Szenen-Aktionen und
Dashboard-Widgets.

Die Integration läuft wie die App über die **Tineco-Cloud**: Das Gerät muss
in der Tineco-App eingerichtet und mit dem WLAN verbunden sein.

## Einrichtung

1. Installieren Sie in Gladys die Integration **Tineco** und öffnen Sie den
   Tab **Konfiguration**.
2. Geben Sie **E-Mail** und **Passwort** Ihres Tineco-Kontos sowie das bei
   der Kontoerstellung gewählte **Land** ein. Speichern.
3. Bei der ersten Verbindung behandelt Tineco Gladys wie ein neues Telefon
   und **sendet Ihnen einen Bestätigungscode per E-Mail**. Geben Sie ihn unter
   **Bestätigungscode** ein und speichern Sie erneut. Das passiert nur einmal.
   Keine E-Mail? Nutzen Sie **Neuen Bestätigungscode senden** (automatisch
   wird höchstens eine E-Mail pro Viertelstunde gesendet).
4. **Verbindung testen** listet die gefundenen Geräte auf.
5. Öffnen Sie den Tab **Erkennung** und legen Sie Ihre Geräte an.

| Einstellung              | Zweck                                                         |
| ------------------------ | ------------------------------------------------------------- |
| Land des Kontos          | Wählt die Tineco-Server Ihres Kontos.                         |
| Sprache der Gerätenamen  | Sprache der Geräte- und Funktionsnamen beim Anlegen.          |
| Aktualisierungsintervall | Sekunden zwischen zwei Abfragen jedes Geräts (mindestens 30). |

## Funktionen

| Funktion           | Werte                                                                              |
| ------------------ | ---------------------------------------------------------------------------------- |
| Zustand            | Standard-Saugerzustand: gestoppt, läuft, lädt, in der Station                      |
| Aktivität          | Reinigung, Selbstreinigung, Trocknung, lädt, Aktualisierung, Bereitschaft, offline |
| Akku               | 0–100 %                                                                            |
| Lädt               | Ja / nein                                                                          |
| Frischwassertank   | Normal / niedrig (leer)                                                            |
| Schmutzwassertank  | Normal / hoch (voll)                                                               |
| Sprachlautstärke   | 1 (leise) bis 3 (laut), steuerbar                                                  |
| Sprachansagen      | An / aus, steuerbar                                                                |
| Bürstenbeleuchtung | An / aus, steuerbar — nur bei Modellen mit Beleuchtung                             |

Antwortet ein Gerät nicht (ausgeschaltet, außerhalb der WLAN-Reichweite — ein
Handgerät verbindet sich nur während der Nutzung), wechselt sein Abzeichen auf
**nicht erreichbar**, seine Aktivität auf **offline**, und die letzten Werte
bleiben erhalten.

## Szenen

**Auslöser**

- **Reinigung gestartet** — Variable: Akku.
- **Reinigung beendet** — Variablen: Dauer (Minuten), Akku.
- **Selbstreinigung beendet** — der Moment, den Schmutzwassertank zu leeren.
- **Wassertank-Warnung** — Schmutzwassertank voll oder Frischwassertank leer;
  Filter auf die Warnung, Variable: Warnung.

Jeder Auslöser lässt sich auf ein Gerät filtern.

**Aktionen**

- **Tineco-Gerät auslesen** — liest es sofort aus; Ausgaben: online,
  Aktivität, Akku, Schmutzwassertank voll, Frischwassertank leer (für die
  Bedingungen der folgenden Aktionen).
- **Sprachlautstärke einstellen**, **Sprachansagen ein- oder ausschalten**,
  **Bürstenbeleuchtung ein- oder ausschalten** — Ausgabe: Befehl angenommen.

Ein Gerät, das offline ist, lässt nie eine Szene scheitern: Die Ausgaben
zeigen es an.

## Dashboard-Widgets

- **Tineco-Gerät** — Akkuanzeige, Aktivität, Wassertanks, Akkuverlauf über
  24 Std. und eine Schaltfläche **Aktualisieren**. Wählen Sie das Gerät in
  den Widget-Einstellungen (sonst das erste).
- **Tineco-Übersicht** — eine Zeile pro Gerät, orange, wenn ein Tank
  Aufmerksamkeit braucht.

## Einschränkungen

- Tineco veröffentlicht keine API: Die Integration nutzt das Protokoll der
  App, das Tineco ändern kann. Nicht jedes Modell meldet jeden Wert; die
  Bürstenbeleuchtung erscheint nur bei Modellen, die sie melden.
- Eine Reinigung aus der Ferne zu starten ist nicht möglich: Ein Nasssauger
  wird von Hand geschoben.
- Konten aus Festlandchina (SMS-Anmeldung) werden nicht unterstützt.

## Fehlerbehebung

- **„Tineco hat die Anmeldung abgelehnt“**: Prüfen Sie E-Mail, Passwort und
  vor allem das **Land** des Kontos.
- **„Tineco hat den Bestätigungscode abgelehnt“**: Codes laufen ab; nutzen
  Sie **Neuen Bestätigungscode senden** und geben Sie den neuen ein.
- **„Tineco listet kein Gerät“**: Die Liste kommt von den Tineco-Servern des
  gewählten Landes. Wählen Sie das Land, das die Tineco-App anzeigt (Profil >
  Einstellungen), speichern Sie und testen Sie erneut. Immer noch leer? Teilen
  Sie die Zeile „Answer shape“ der Logs (sie enthält keine persönlichen Daten)
  in einem Issue.
- Integrationsprotokolle: Gladys → Integrationen → Tineco → Logs. Passwörter
  und Token werden nie protokolliert.
