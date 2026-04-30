---
title: "HideMyData: nativer macOS-Client auf Basis desselben Privacy-Filter-Modells"
description: "Die Community-App HideMyData führt das openai/privacy-filter-Modell direkt auf dem Mac aus, um PDFs und Bilder zu schwärzen — dasselbe Modell wie auf dieser Seite, nur nativ über MLX und Apple Vision."
pubDate: 2026-04-29
author: "Privacy Filter Team"
tags: ["releases", "macos", "open-source"]
---

Du kennst das: Du willst einen Screenshot oder ein PDF teilen und sitzt erst mal zehn Minuten in Vorschau und suchst nach jedem Namen, jeder E-Mail-Adresse oder Kontonummer, die du noch übermalen wolltest. Genau diesen Ablauf will [HideMyData](https://github.com/mkbula/HideMyData) abschaffen.

Es ist eine native macOS-App von [mkbula](https://github.com/mkbula), die am 28. April mit v0.1.0 erschienen ist. Was uns daran auffiel: Sie nutzt **dasselbe `openai/privacy-filter`-Modell**, das auch hinter dieser Website steckt — nur eben nativ, über [MLX-Swift](https://github.com/ml-explore/mlx-swift), und mit Apple Vision für das OCR von PDFs und Bildern. Gleiches Hirn, anderer Körper.

Wer also Privacy Filter Online nutzt und sich gewünscht hat, einen Stapel PDFs durchlaufen lassen zu können, ohne Seite für Seite zu kopieren, hat jetzt eine Mac-App, die genau das tut. Lokal. Open Source. GPL-3.0. Wir haben sie nicht gebaut, aber die gemeinsame Herkunft ist spannend und das Projekt ist gut gemacht — ein Beitrag lohnt sich.

## Was sie konkret macht

Du ziehst ein PDF oder ein Bild rein. HideMyData schickt es durch drei Schichten:

1. **Apple Vision OCR** zieht den Text heraus — auch aus gescannten PDFs und aus diesen kaputten PDFs, bei denen eingebettete Schriften das Markieren verhindern (die schlimmste Sorte).
2. **Das privacy-filter-Modell, als MLX 8-Bit-Quant**, läuft mit derselben NER-Inferenz wie hier auf der Seite, nur auf der Apple Neural Engine über Unified Memory. Es erkennt Namen, E-Mails, Telefonnummern, Adressen, Daten und IDs im Kontext.
3. **Handgepflegte Regex** für alles, wo Kontext nicht hilft: IBAN, Sozialversicherungsnummer, MAC-Adressen, IPv4/v6, JWT, API-Keys, Krypto-Wallet-Adressen. Die Regex-Schicht fängt das Deterministische ab, damit das Modell sich auf das Unscharfe konzentrieren kann.

Du bekommst einen Entwurf mit Schwärzungs-Rechtecken. Du kannst sie anpassen — neue hinzufügen, falsche Treffer löschen, Kanten verschieben. Zwei Stile: Vollschwarz oder Milchglas-Blur. Der Blur wirkt bei Screenshots, die professionell aussehen sollen, ehrlich gesagt deutlich angenehmer.

Beim Speichern werden **die Schwärzungen fest eingebrannt**. Die Seiten werden gerastert und neu aufgebaut — die ursprünglichen Glyphen und Texte verschwinden aus der Datei, sie werden nicht nur überdeckt. Das ist wichtiger, als es klingt. Der klassische PDF-Schwärzungs-Fehler: ein schwarzes Rechteck drüberzeichnen und das so verschicken — der Text darunter ist noch da, kopierbar, Leute werden gefeuert. HideMyData baut die Seite neu auf, sodass unter dem Rechteck nichts mehr zu rekonstruieren ist.

## Verglichen mit Privacy Filter Online

Wir hosten die Browser-Version. Gleiches Modell, aber über Transformers.js und WebGPU/WASM im Tab. Das passt super, wenn du nur ein Stück Text oder ein einzelnes Bild prüfen willst und nichts installieren möchtest.

HideMyData passt besser, wenn:

- Du **PDFs** hast, vor allem mehrseitige. Browser können PDFs anzeigen, aber nicht entspannt schwärzen.
- Du mit **Scans** arbeitest, bei denen die OCR-Qualität wirklich zählt — Apple Vision ist hier ehrlich stark.
- Du **das Modell nicht jedes Mal in den Browser-Cache neu laden** willst, wenn Chrome ihn löscht. Die native App legt das Modell unter `~/Library/Application Support/HideMyData/` ab.
- Du das **Rastern-und-Neuaufbauen** beim Speichern brauchst. Die Web-Version markiert Textbereiche zum Kopieren, sie schreibt dir kein PDF um.

Gleiche Idee, nur nativ — mit dem Festplatten- und GPU-Zugriff, den der Browser nicht hergibt.

## Was am Build interessant ist

Ein paar Punkte für alle, die sich für die Umsetzung interessieren:

- **MLX-Swift** für die Inferenz. Auf Apple Silicon ist Apples MLX die richtige Wahl — Unified Memory bedeutet kein Kopieren zwischen GPU und CPU, und der 8-Bit-Quant von `openai/privacy-filter` passt locker in den Arbeitsspeicher.
- **OpenMedKit** kapselt das Modell-Laden. Es ist der Swift-Klebstoff, der Hugging-Face-Gewichte in etwas verwandelt, das MLX verarbeiten kann.
- **PDFKit + Vision + Modell** in einer Pipeline. Jede Schicht ist Apple-nativ — kein Python-Sidecar, kein Electron, keine drehenden Lüfter. Der Kaltstart ist flott.

Der Build umgeht außerdem die Falle „smarter Auto-Schwärzer, dem du blind vertrauen musst". Vor dem Speichern gibt es einen manuellen Editier-Schritt. Du siehst, was das Modell vorschlägt, akzeptierst oder änderst es, und erst dann ist es endgültig. Das ist die richtige Aufteilung für etwas, das im Fehlerfall Daten leakt.

## Die Haken

Es ist v0.1.0. Was du wissen solltest:

- **macOS 26 oder neuer, nur Apple Silicon.** Das MLX-Backend läuft nicht auf Intel-Macs.
- **Noch nicht mit Entwicklerzertifikat signiert.** Der erste Start wird von Gatekeeper blockiert. Das README zeigt den Workaround `xattr -rd com.apple.quarantine /Applications/HideMyData.app`.
- **Modell-Download beim ersten Start ~1,5 GB.** Plane das ein, falls du im Hotel-WLAN hängst.
- Lizenz GPL-3.0, was zählt, wenn du es kommerziell einbetten willst.

Frühphasen-Open-Source eben. Die Bausteine sind alle da, das Demo-Video im Repo sieht sauber aus, aber rechne mit Ecken und Kanten und behalte den Issue-Tracker im Auge.

## Ausprobieren

- Repo: [github.com/mkbula/HideMyData](https://github.com/mkbula/HideMyData)
- Aktuelles Release: [v0.1.0](https://github.com/mkbula/HideMyData/releases/tag/v0.1.0)
- Das Modell, das beide Projekte teilen: [openai/privacy-filter](https://huggingface.co/openai/privacy-filter)

Wenn du etwas mit demselben Modell auf einer anderen Plattform baust, sag Bescheid. Der Sinn eines offenen Modells ist genau das: Browser-Tool, Mac-App und alles, was noch kommt, schauen aus verschiedenen Winkeln auf dasselbe Problem.
