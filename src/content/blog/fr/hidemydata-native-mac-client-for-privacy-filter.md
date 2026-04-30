---
title: "HideMyData : un client macOS natif basé sur le même modèle Privacy Filter"
description: "HideMyData, une app Mac issue de la communauté, exécute le modèle openai/privacy-filter en local pour caviarder PDF et images — le même modèle que ce site, mais en natif via MLX et Apple Vision."
pubDate: 2026-04-29
author: "Privacy Filter Team"
tags: ["releases", "macos", "open-source"]
---

Vous voyez ce moment où il faut envoyer une capture ou un PDF à quelqu'un, et où vous passez dix minutes à scruter le document dans Aperçu pour repérer le moindre nom, e-mail ou numéro de compte que vous aviez oublié de masquer ? C'est précisément ce flux que [HideMyData](https://github.com/mkbula/HideMyData) cherche à éliminer.

C'est une app macOS native signée [mkbula](https://github.com/mkbula), qui vient de sortir en v0.1.0 le 28 avril. Ce qui a attiré notre attention : elle fait tourner **le même modèle `openai/privacy-filter`** que celui qui anime ce site — mais en natif, via [MLX-Swift](https://github.com/ml-explore/mlx-swift), avec Apple Vision pour l'OCR des PDF et des images. Même cerveau, autre corps.

Donc si vous utilisez Privacy Filter Online et que vous avez déjà rêvé de pouvoir digérer une pile de PDF sans copier-coller page par page, il existe désormais une app Mac qui fait à peu près ça. En local. Open source. GPL-3.0. Ce n'est pas nous qui l'avons construite, mais la filiation est intéressante et le projet est solide — il méritait un article.

## Ce qu'elle fait concrètement

Vous déposez un PDF ou une image. HideMyData la fait passer dans trois couches :

1. **Apple Vision OCR** extrait le texte — y compris des PDF scannés et de ces PDF cassés où les polices intégrées empêchent toute sélection (les pires).
2. **Le modèle privacy-filter, en MLX quantifié 8 bits**, exécute le même type d'inférence NER qu'ici, mais sur l'Apple Neural Engine via la mémoire unifiée. Il repère noms, e-mails, téléphones, adresses, dates et identifiants en contexte.
3. **Des regex maintenues à la main** pour ce que le contexte ne sait pas couvrir : IBAN, numéro de sécurité sociale, adresses MAC, IPv4/v6, JWT, clés d'API, adresses de portefeuilles crypto. La couche regex attrape le déterministe pour que le modèle se concentre sur le flou.

Vous obtenez un brouillon de rectangles de masquage. Vous pouvez les ajuster — en ajouter, supprimer les faux positifs, déplacer les bords. Deux styles : noir plein ou flou type verre dépoli. Honnêtement, le flou rend bien mieux pour les captures que vous voulez garder un peu présentables.

À l'enregistrement, **le caviardage est gravé dans le fichier**. Les pages sont rastérisées puis reconstruites — les glyphes et le texte d'origine disparaissent du fichier, ils ne sont pas juste recouverts. C'est plus important qu'il n'y paraît. L'erreur classique du caviardage PDF : poser un rectangle noir par-dessus et envoyer le tout — le texte en dessous est toujours là, copiable, et des gens se font virer. HideMyData reconstruit la page : il ne reste rien à récupérer sous le rectangle.

## Comparaison avec Privacy Filter Online

Nous hébergeons la version navigateur. Même modèle, mais qui tourne via Transformers.js et WebGPU/WASM dans votre onglet. C'est très adapté quand vous avez un bout de texte ou une seule image à scanner et que vous ne voulez rien installer.

HideMyData est plus pertinent quand :

- Vous avez des **PDF**, surtout multipages. Les navigateurs savent les afficher, pas les caviarder confortablement.
- Vous travaillez sur des **documents scannés** où la qualité de l'OCR compte vraiment — Apple Vision est franchement bon là-dessus.
- Vous préférez **ne pas re-télécharger un modèle dans le cache** chaque fois que Chrome décide de le vider. L'app native garde le modèle dans `~/Library/Application Support/HideMyData/`.
- Vous avez besoin du comportement **rastériser-et-reconstruire** à l'enregistrement. La version web vous balise des plages de texte à copier ; elle ne réécrit pas le PDF à votre place.

Même idée, en natif, avec l'accès au disque et au GPU que le navigateur ne peut pas offrir.

## Ce qui est intéressant côté implémentation

Quelques points à pointer si la mise en œuvre vous intéresse :

- **MLX-Swift** pour l'inférence. Sur Apple Silicon, MLX est le bon choix — la mémoire unifiée évite toute copie GPU/CPU, et la quantification 8 bits de `openai/privacy-filter` tient largement en mémoire de travail.
- **OpenMedKit** encapsule le chargement du modèle. C'est la colle Swift qui transforme les poids Hugging Face en quelque chose que MLX peut consommer.
- **PDFKit + Vision + le modèle** dans un seul pipeline. Chaque couche est Apple-native — pas de sidecar Python, pas d'Electron, pas de ventilateurs qui s'emballent. Le démarrage à froid est rapide.

L'app évite aussi le piège du « caviardeur automatique malin auquel il faut faire confiance ». Il y a une étape d'édition manuelle avant l'enregistrement. Vous voyez ce que le modèle propose, vous validez ou vous corrigez, et ensuite c'est définitif. C'est la bonne répartition des rôles pour un outil qui, s'il se trompe, fait fuiter des données.

## Les bémols

C'est la v0.1.0. À savoir :

- **macOS 26 ou plus, Apple Silicon uniquement.** Le backend MLX ne tournera pas sur les Mac Intel.
- **Pas encore signée avec un certificat développeur.** Au premier lancement, Gatekeeper la bloque. Le README donne la commande `xattr -rd com.apple.quarantine /Applications/HideMyData.app` pour contourner.
- **Le téléchargement initial du modèle pèse environ 1,5 Go.** À prévoir si vous êtes sur le Wi-Fi d'un hôtel.
- C'est en GPL-3.0, ce qui compte si vous comptez l'embarquer dans un produit commercial.

Bref, de l'open source en phase précoce. Les briques sont toutes là, la vidéo de démo du dépôt est propre, mais attendez-vous à des aspérités et gardez un œil sur le tracker d'issues.

## Essayez

- Le dépôt : [github.com/mkbula/HideMyData](https://github.com/mkbula/HideMyData)
- Dernière release : [v0.1.0](https://github.com/mkbula/HideMyData/releases/tag/v0.1.0)
- Le modèle partagé par les deux projets : [openai/privacy-filter](https://huggingface.co/openai/privacy-filter)

Si vous construisez quelque chose avec le même modèle sur une autre plateforme, dites-le-nous. Tout l'intérêt d'un modèle ouvert, c'est exactement ça : que l'outil web, l'app Mac et la suite visent le même problème sous des angles différents.
