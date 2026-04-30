---
title: "HideMyData: cliente nativo de macOS construido sobre el mismo modelo de Privacy Filter"
description: "Una app de Mac creada por la comunidad, HideMyData, ejecuta el modelo openai/privacy-filter en el dispositivo para censurar PDFs e imágenes — el mismo modelo de este sitio, pero nativo con MLX y Apple Vision."
pubDate: 2026-04-29
author: "Privacy Filter Team"
tags: ["releases", "macos", "open-source"]
---

¿Conoces esa sensación cuando necesitas compartir una captura de pantalla o un PDF y te pasas diez minutos entornando los ojos para encontrar cualquier nombre, email o número de cuenta que se te olvidó tachar en Vista Previa? Ese es el flujo que [HideMyData](https://github.com/mkbula/HideMyData) intenta eliminar.

Es una app nativa de macOS de [mkbula](https://github.com/mkbula) que acaba de publicar la v0.1.0 el 28 de abril. Lo que nos llamó la atención: ejecuta **el mismo modelo `openai/privacy-filter`** que mueve este sitio — solo que de forma nativa, a través de [MLX-Swift](https://github.com/ml-explore/mlx-swift), con Apple Vision encargándose del OCR para PDFs e imágenes. Mismo cerebro, otro cuerpo.

Así que si has usado Privacy Filter Online y deseabas que pudiera digerir una pila de PDFs sin copiar y pegar página por página, ahora hay una app de Mac que hace algo parecido. En local. Open source. GPL-3.0. No la hicimos nosotros, pero el linaje es interesante y el proyecto está bien hecho, así que merece un repaso.

## Qué hace en realidad

Sueltas un PDF o una imagen. HideMyData lo pasa por tres capas:

1. **Apple Vision OCR** extrae el texto — incluso de PDFs escaneados y de esos PDFs rotos en los que las fuentes incrustadas impiden seleccionar el texto (los peores).
2. **El modelo privacy-filter, en MLX cuantizado a 8 bits**, ejecuta el mismo tipo de inferencia NER que usamos aquí, pero en el Apple Neural Engine vía memoria unificada. Detecta nombres, emails, teléfonos, direcciones, fechas e identificadores en contexto.
3. **Regex mantenidas a mano** para lo que el contexto no resuelve: IBAN, NIF/DNI, direcciones MAC, IPv4/v6, JWT, claves de API, direcciones de monederos cripto. La capa de regex captura lo determinista para que el modelo se centre en lo borroso.

Obtienes un borrador con rectángulos de censura. Puedes ajustarlos — añadir nuevos, borrar falsos positivos, mover bordes. Dos estilos de censura: negro sólido o desenfoque tipo cristal esmerilado. El desenfoque queda francamente mejor en capturas que aún quieres que se vean profesionales.

Al guardar, **las censuras quedan grabadas**. Las páginas se rasterizan y se reconstruyen — los glifos y el texto originales desaparecen del archivo, no solo se cubren. Esto importa más de lo que parece. El error clásico al censurar un PDF es dibujar un rectángulo negro encima y enviarlo: el texto debajo sigue ahí, copiable, y la gente acaba despedida. HideMyData reconstruye la página para que no quede nada bajo el rectángulo que se pueda recuperar.

## Cómo se compara con Privacy Filter Online

Nosotros alojamos la versión web. Mismo modelo, pero corriendo a través de Transformers.js y WebGPU/WASM en tu pestaña. Va genial cuando tienes un fragmento de texto o una sola imagen y no quieres instalar nada.

HideMyData encaja mejor cuando:

- Tienes **PDFs**, sobre todo de varias páginas. Los navegadores saben renderizar PDFs, pero no censurarlos cómodamente.
- Trabajas con **documentos escaneados** donde la calidad del OCR importa de verdad — Apple Vision es realmente potente aquí.
- Prefieres **no volver a descargar un modelo en la caché del navegador** cada vez que a Chrome le da por borrarla. La app nativa guarda el modelo en `~/Library/Application Support/HideMyData/`.
- Necesitas el comportamiento de **rasterizar y reconstruir** al guardar. La versión web te marca tramos de texto para copiar; no reescribe el PDF por ti.

Es la misma idea, llevada a nativo, con el acceso a disco y GPU que el navegador no puede dar.

## Lo interesante de la implementación

Algunas cosas a destacar si te interesa cómo está hecho:

- **MLX-Swift** para la inferencia. El MLX de Apple es la elección correcta en Apple Silicon — la memoria unificada evita copias entre GPU y CPU, y la cuantización 8-bit de `openai/privacy-filter` cabe holgadamente en memoria de trabajo.
- **OpenMedKit** envuelve la carga del modelo. Es el pegamento Swift que convierte los pesos de Hugging Face en algo que MLX pueda consumir.
- **PDFKit + Vision + el modelo** en una sola tubería. Cada capa es nativa de Apple — sin sidecar de Python, sin Electron, sin ventiladores girando. El arranque en frío es rápido.

La construcción también esquiva la trampa de "censor automático inteligente en el que tienes que confiar". Hay un paso de edición manual antes de guardar. Ves lo que el modelo propuso, lo aceptas o lo cambias, y entonces queda permanente. Es la división del trabajo correcta para algo que, si la pifia, filtra datos.

## Las pegas

Es la v0.1.0. Cosas a tener en cuenta:

- **macOS 26 o superior, solo Apple Silicon.** El backend de MLX no funciona en Macs Intel.
- **Sin firmar con certificado de desarrollador** todavía. El primer arranque lo bloqueará Gatekeeper. El README incluye el truco `xattr -rd com.apple.quarantine /Applications/HideMyData.app`.
- **La descarga inicial del modelo ronda 1,5 GB.** Tenlo en cuenta si estás en la red de un hotel.
- Es GPL-3.0, lo que importa si piensas integrarla en algo comercial.

Open source en fase temprana, vamos. Las piezas están todas, el vídeo del repo se ve limpio, pero espera asperezas y vigila el tracker de issues.

## Pruébala

- El repo: [github.com/mkbula/HideMyData](https://github.com/mkbula/HideMyData)
- Última release: [v0.1.0](https://github.com/mkbula/HideMyData/releases/tag/v0.1.0)
- El modelo que ambos proyectos comparten: [openai/privacy-filter](https://huggingface.co/openai/privacy-filter)

Si construyes algo con el mismo modelo en otra plataforma, cuéntanoslo. El sentido de un modelo abierto es justo eso: que la herramienta web, la app de Mac y lo que venga después apunten al mismo problema desde ángulos distintos.
