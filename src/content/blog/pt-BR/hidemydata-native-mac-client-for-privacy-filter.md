---
title: "HideMyData: cliente nativo de macOS feito sobre o mesmo modelo do Privacy Filter"
description: "O HideMyData, app de Mac criado pela comunidade, roda o modelo openai/privacy-filter direto no aparelho para esconder dados em PDFs e imagens — o mesmo modelo deste site, mas nativo via MLX e Apple Vision."
pubDate: 2026-04-29
author: "Privacy Filter Team"
tags: ["releases", "macos", "open-source"]
---

Sabe aquela hora em que você precisa mandar um print ou um PDF para alguém e passa dez minutos vasculhando o arquivo no Preview atrás de qualquer nome, e-mail ou número de conta que esqueceu de tampar? É exatamente esse fluxo que o [HideMyData](https://github.com/mkbula/HideMyData) está tentando apagar.

É um app nativo de macOS feito pelo [mkbula](https://github.com/mkbula), com a v0.1.0 publicada em 28 de abril. O que chamou nossa atenção: ele roda **o mesmo modelo `openai/privacy-filter`** que move este site — só que de forma nativa, via [MLX-Swift](https://github.com/ml-explore/mlx-swift), com o Apple Vision cuidando do OCR de PDFs e imagens. Mesmo cérebro, corpo diferente.

Então, se você usa o Privacy Filter Online e já desejou que ele desse conta de uma pilha de PDFs sem ter que copiar e colar página por página, agora tem um app de Mac que faz mais ou menos isso. Localmente. Open source. GPL-3.0. Não fomos nós que fizemos, mas a linhagem é interessante e o projeto é bem feito — vale o post.

## O que ele faz na prática

Você arrasta um PDF ou uma imagem. O HideMyData passa o arquivo por três camadas:

1. **Apple Vision OCR** extrai o texto — inclusive de PDFs digitalizados e daqueles PDFs problemáticos em que as fontes embutidas atrapalham a seleção (os piores).
2. **O modelo privacy-filter em MLX, quantizado em 8 bits**, faz a mesma inferência NER que rodamos aqui, só que no Apple Neural Engine via memória unificada. Ele identifica nomes, e-mails, telefones, endereços, datas e identificadores em contexto.
3. **Regex mantidas à mão** para o que contexto não resolve: IBAN, CPF, endereços MAC, IPv4/v6, JWT, chaves de API, endereços de carteiras cripto. A camada de regex cuida do que é determinístico para o modelo focar no que é nebuloso.

Você recebe um rascunho com retângulos de censura. Dá para ajustar — adicionar, apagar falsos positivos, mover bordas. Dois estilos de censura: preto sólido ou desfoque tipo vidro fosco. Sinceramente, o desfoque fica bem mais elegante em prints que você ainda quer manter com cara profissional.

Ao salvar, **a censura é gravada no arquivo**. As páginas são rasterizadas e reconstruídas — os glifos e o texto originais somem do arquivo, não ficam só por baixo. Isso pesa mais do que parece. O erro clássico de censurar PDF é desenhar um retângulo preto por cima e mandar embora: o texto continua ali, dá para copiar, e gente é demitida por isso. O HideMyData reconstrói a página de modo que não sobra nada para recuperar embaixo do retângulo.

## Como se compara ao Privacy Filter Online

A gente hospeda a versão de navegador. Mesmo modelo, mas rodando via Transformers.js e WebGPU/WASM dentro da aba. Encaixa muito bem quando você tem um trecho de texto ou uma imagem solta para passar no filtro e não quer instalar nada.

O HideMyData encaixa melhor quando:

- Você tem **PDFs**, principalmente de várias páginas. Navegadores até renderizam PDFs, mas não censuram com conforto.
- Você trabalha com **documentos digitalizados** em que a qualidade do OCR realmente importa — o Apple Vision é bem forte aqui.
- Você prefere **não baixar o modelo de novo no cache do navegador** toda vez que o Chrome resolve limpar tudo. O app nativo guarda o modelo em `~/Library/Application Support/HideMyData/`.
- Você precisa do comportamento de **rasterizar e reconstruir** ao salvar. A versão web te entrega trechos de texto para copiar; ela não reescreve um PDF para você.

Mesma ideia, só que nativa, com o acesso a disco e GPU que o navegador não consegue dar.

## O que tem de legal na construção

Algumas coisinhas que vale apontar para quem tem curiosidade na implementação:

- **MLX-Swift** para inferência. No Apple Silicon, o MLX da Apple é a escolha certa — memória unificada significa nada de cópia entre GPU e CPU, e o quant de 8 bits do `openai/privacy-filter` cabe folgado na memória de trabalho.
- **OpenMedKit** embrulha o carregamento do modelo. É a cola Swift que transforma os pesos do Hugging Face em algo que o MLX consegue consumir.
- **PDFKit + Vision + modelo** num único pipeline. Cada camada é nativa da Apple — sem sidecar de Python, sem Electron, sem ventilador girando feito louco. O cold start é rápido.

A construção também escapa da armadilha do "censor automático esperto em que você precisa confiar". Tem uma etapa manual de edição antes de salvar. Você vê o que o modelo propôs, aceita ou muda, e só então vira definitivo. Essa é a divisão de trabalho certa para algo que, ao errar, vaza dado.

## Os poréns

É a v0.1.0. Coisas para saber:

- **macOS 26 ou superior, somente Apple Silicon.** O backend MLX não roda em Mac com Intel.
- **Ainda não está assinado com certificado de desenvolvedor.** O Gatekeeper bloqueia a primeira execução. O README traz o atalho `xattr -rd com.apple.quarantine /Applications/HideMyData.app`.
- **O download inicial do modelo é de uns 1,5 GB.** Programe-se se estiver no Wi-Fi de hotel.
- É GPL-3.0, e isso pesa se você pensa em embutir em algo comercial.

Open source em fase inicial, basicamente. As peças estão todas ali, o vídeo de demo do repositório está limpo, mas espere arestas e fique de olho no rastreador de issues.

## Experimente

- Repositório: [github.com/mkbula/HideMyData](https://github.com/mkbula/HideMyData)
- Última release: [v0.1.0](https://github.com/mkbula/HideMyData/releases/tag/v0.1.0)
- O modelo que os dois projetos compartilham: [openai/privacy-filter](https://huggingface.co/openai/privacy-filter)

Se você construir algo com o mesmo modelo em outra plataforma, conta para a gente. A graça de um modelo aberto é justamente essa: a ferramenta web, o app de Mac e o que vier depois mirando o mesmo problema por ângulos diferentes.
