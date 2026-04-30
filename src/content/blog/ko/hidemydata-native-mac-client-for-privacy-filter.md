---
title: "HideMyData: 같은 Privacy Filter 모델로 만든 macOS 네이티브 앱"
description: "커뮤니티가 만든 Mac 앱 HideMyData가 PDF·이미지의 개인정보를 기기에서 직접 가려줍니다. 이 사이트와 같은 openai/privacy-filter 모델을 MLX와 Apple Vision으로 네이티브 실행합니다."
pubDate: 2026-04-29
author: "Privacy Filter Team"
tags: ["releases", "macos", "open-source"]
---

스크린샷이나 PDF를 누군가에게 보내야 할 때, 미리보기에서 가린다고 가렸는데도 혹시 빠뜨린 이름·이메일·계좌번호가 있을까 봐 10분쯤 다시 훑어본 경험, 다들 있죠. [HideMyData](https://github.com/mkbula/HideMyData)는 바로 그 작업을 통째로 없애려는 앱입니다.

[mkbula](https://github.com/mkbula) 님이 만든 macOS 네이티브 앱으로, 4월 28일에 v0.1.0이 막 공개됐습니다. 우리가 주목한 부분은 이 앱이 이 사이트를 돌리는 **그 `openai/privacy-filter` 모델 그대로**를 쓴다는 점입니다. 다만 [MLX-Swift](https://github.com/ml-explore/mlx-swift)로 네이티브 실행하고, PDF·이미지 OCR은 Apple Vision이 담당하죠. 머리는 같고 몸이 다른 셈입니다.

그러니 Privacy Filter Online을 쓰면서 "PDF 더미를 페이지마다 복붙하지 않고 한 번에 처리하면 좋겠다"고 생각한 적이 있다면, 이제 거의 그걸 해주는 Mac 앱이 생긴 겁니다. 로컬에서 돌고, 오픈소스, 라이선스는 GPL-3.0. 우리가 만든 건 아니지만 같은 뿌리에서 나왔고 프로젝트도 잘 만들어져서 한 번 다뤄볼 만합니다.

## 실제로 무엇을 하나

PDF나 이미지를 끌어다 놓으면 HideMyData는 세 단계를 거칩니다.

1. **Apple Vision OCR**이 텍스트를 뽑아냅니다. 스캔된 PDF는 물론, 임베드 폰트 때문에 텍스트 선택이 안 되는 망가진 PDF(이게 제일 골치 아프죠)에서도 잘 동작합니다.
2. **MLX 8비트 양자화 버전의 privacy-filter 모델**이 우리가 여기서 돌리는 것과 같은 NER 추론을 수행합니다. 다만 통합 메모리를 통해 Apple Neural Engine 위에서 돌아가죠. 이름·이메일·전화번호·주소·날짜·식별번호를 문맥과 함께 인식합니다.
3. **수동으로 관리하는 정규식**이 문맥으로 잡기 어려운 것들을 처리합니다. IBAN, 주민등록번호, MAC 주소, IPv4/v6, JWT, API 키, 암호화폐 지갑 주소 같은 것들요. 결정적인(deterministic) 패턴은 정규식이 잡고, 모델은 모호한 영역에 집중하는 분업 구조입니다.

결과로 가림 사각형이 그려진 초안이 나옵니다. 이걸 자유롭게 손볼 수 있어요. 새로 추가하거나, 오탐을 지우거나, 모서리를 옮기거나. 가림 스타일은 두 가지(검정 단색, 간유리 같은 블러)인데, 솔직히 그래도 보기 좋게 남기고 싶은 스크린샷에는 블러가 훨씬 낫습니다.

저장하면 **가림 처리가 파일에 그대로 구워집니다.** 페이지를 래스터화한 뒤 다시 빌드하기 때문에, 원본 글리프와 텍스트가 파일에서 사라집니다. 단순히 위에 가려놓은 게 아니라요. 이게 생각보다 훨씬 중요합니다. 흔한 PDF 가림 처리 실수가 검정 사각형만 위에 그려놓고 보내는 건데, 아래 텍스트가 그대로 남아 있어서 복사도 되고, 그러다 사람이 회사에서 잘립니다. HideMyData는 페이지를 다시 만들기 때문에 사각형 아래에 복원할 게 아예 없습니다.

## Privacy Filter Online과 비교하면

브라우저 버전은 우리가 직접 호스팅합니다. 같은 모델이지만 Transformers.js와 WebGPU/WASM을 통해 탭 안에서 돕니다. 텍스트 한 토막이나 이미지 한 장 정도 빠르게 점검하고 아무것도 설치하기 싫을 때 잘 맞아요.

HideMyData가 더 잘 어울리는 경우는 이렇습니다.

- 처리할 게 **PDF**, 특히 다중 페이지일 때. 브라우저는 PDF를 띄워주긴 해도, 거기서 가림 처리하는 건 영 매끄럽지 않습니다.
- **스캔 문서** 작업이라 OCR 품질이 중요할 때. 이 영역에서 Apple Vision은 정말 강합니다.
- 크롬이 캐시를 비울 때마다 **모델을 다시 다운로드하기 싫다**면. 네이티브 앱은 모델을 `~/Library/Application Support/HideMyData/`에 보관합니다.
- 저장 시 **래스터화 + 재빌드** 동작이 필요할 때. 웹 버전은 복사하기 좋게 텍스트 범위를 표시해줄 뿐, PDF 자체를 다시 써주지는 않습니다.

같은 발상을 네이티브로 가져왔고, 브라우저가 줄 수 없는 디스크·GPU 접근이 추가된 형태입니다.

## 빌드에서 흥미로운 점

구현이 궁금하다면 짚어볼 만한 포인트들입니다.

- **MLX-Swift**로 추론. Apple Silicon에서는 MLX가 정답이죠. 통합 메모리라 GPU/CPU 복사가 없고, `openai/privacy-filter`의 8비트 양자화는 작업 메모리에 여유롭게 들어갑니다.
- **OpenMedKit**이 모델 로딩을 감싸줍니다. Hugging Face 가중치를 MLX가 먹을 수 있는 형태로 바꿔주는 Swift용 접착제 역할이죠.
- **PDFKit + Vision + 모델**이 한 파이프라인으로 묶여 있습니다. 모든 레이어가 Apple 네이티브라 Python 사이드카도, Electron도, 팬이 미친 듯이 도는 일도 없습니다. 콜드 스타트가 빠릅니다.

또 "알아서 다 가려주니 믿고 맡기세요" 식의 함정도 피했습니다. 저장 전에 수동 편집 단계가 끼어 있어요. 모델이 제안한 결과를 보고, 받아들이거나 고친 뒤에야 영구 반영됩니다. 잘못되면 데이터가 새는 도구라면 이런 분업이 맞습니다.

## 한계

v0.1.0이라 알고 가야 할 것들이 있습니다.

- **macOS 26 이상, Apple Silicon 전용.** Intel Mac에서는 MLX 백엔드가 돌지 않습니다.
- **개발자 인증서 서명이 아직 없습니다.** 처음 실행할 때 Gatekeeper에 막힐 수 있어요. README에 우회용 명령 `xattr -rd com.apple.quarantine /Applications/HideMyData.app`이 적혀 있습니다.
- **첫 실행 시 모델 다운로드 약 1.5GB.** 호텔 와이파이라면 미리 감안하세요.
- 라이선스는 GPL-3.0. 상업 제품에 끼워 넣을 생각이라면 중요합니다.

요약하면 초기 단계의 오픈소스. 부품은 다 갖춰져 있고 저장소의 데모 영상도 깔끔하지만, 거친 부분이 있을 수 있으니 이슈 트래커를 같이 보는 게 좋습니다.

## 사용해보기

- 저장소: [github.com/mkbula/HideMyData](https://github.com/mkbula/HideMyData)
- 최신 릴리스: [v0.1.0](https://github.com/mkbula/HideMyData/releases/tag/v0.1.0)
- 두 프로젝트가 공유하는 모델: [openai/privacy-filter](https://huggingface.co/openai/privacy-filter)

같은 모델을 다른 플랫폼에서 만들어 보셨다면 알려주세요. 오픈 모델의 핵심은 결국 이거잖아요. 브라우저 도구, Mac 앱, 그 다음에 나올 무엇이 같은 문제를 서로 다른 각도에서 풀어가는 것 말이죠.
