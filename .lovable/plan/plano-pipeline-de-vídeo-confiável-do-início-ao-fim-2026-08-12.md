# Plano: pipeline de vídeo confiável do início ao fim

## Objetivo

Fazer uploads e links públicos/autorizados do YouTube seguirem um fluxo previsível, com fallback automático, progresso real, retomada após falhas e render final sem depender exclusivamente da memória do navegador.

> Limite inevitável: nenhuma integração pode garantir 100% dos links do YouTube. Vídeos privados, removidos, ao vivo, com restrição regional/idade ou bloqueados pelo próprio YouTube podem não ser baixáveis. O objetivo é funcionar de forma confiável para conteúdo público autorizado e sempre terminar em sucesso ou em uma alternativa clara — nunca travado.

## 1. Importação híbrida do YouTube

- Manter o Cobalt como primeira tentativa de baixo custo.
- Criar uma interface de provedores de importação e adicionar um provedor HTTP gerenciado como fallback quando o Cobalt retornar bloqueio de login, bot, captcha, rate limit ou indisponibilidade.
- Tratar separadamente vídeo, áudio, bloqueio definitivo e erro transitório; não repetir modos equivalentes.
- Validar o arquivo retornado por assinatura, tipo MIME, tamanho e presença de faixa de vídeo antes de avançar.
- Transferir o arquivo para o Storage por streaming/chunks, evitando carregar o vídeo inteiro na memória da função.
- Preservar o consentimento autoral e associá-lo ao vídeo criado.

## 2. Importação assíncrona e recuperável

- Criar o registro do vídeo e o job `download` imediatamente, retornando a tela ao usuário sem aguardar minutos.
- Executar resolução, download e armazenamento como etapas retomáveis, registrando provedor, modo, tentativa, progresso e erro normalizado.
- Aplicar timeout por tentativa, backoff e limite de tentativas; erros permanentes não entram em loop.
- Permitir retomar um job interrompido sem duplicar vídeo, consentimento, transcrição ou clipes.
- Se todos os modos de vídeo falharem, apresentar duas ações reais: **continuar somente com áudio** ou **enviar o arquivo de vídeo**.

## 3. Corrigir a semântica do pipeline

- Não marcar `subtitle_render` e `video_render` como concluídos antes de o arquivo final existir; hoje essas etapas são marcadas como sucesso apenas por serem executadas no cliente.
- Separar claramente: download → transcrição → análise → criação de momentos → render → exportação.
- Tornar cada etapa idempotente, para que retry continue do último resultado válido.
- Iniciar o processamento após a importação, sem depender de o usuário abrir a página de detalhes.
- Exibir progresso e mensagem específica por etapa, incluindo qual provedor foi usado e se houve fallback.

## 4. Renderização robusta

- Manter o FFmpeg no navegador como opção gratuita para arquivos menores e dispositivos compatíveis.
- Ligar o contrato de renderização externa já existente como fallback para falta de memória, aba fechada, timeout ou dispositivo móvel limitado.
- Fazer render e exportação atualizarem jobs reais, salvarem o MP4 no Storage e só então marcarem sucesso.
- Preservar o fallback 720p, execução serial e liberação da instância FFmpeg entre clipes.
- Adicionar cancelamento, retry e recuperação de upload do export sem repetir toda a renderização.

## 5. Interface e diagnóstico

- Trocar a espera longa do modal por um item de importação com estados: preparando, Cobalt, fallback gerenciado, baixando, armazenando e processando.
- Mostrar ações contextuais em vez de mensagens genéricas: tentar novamente, continuar com áudio ou enviar vídeo.
- Informar explicitamente que importações apenas de áudio permitem transcrição/análise, mas não render 9:16.
- Manter um erro técnico normalizado no job e uma mensagem simples para o usuário.

## 6. Segurança e configuração

- Manter chaves apenas no backend.
- Validar propriedade do vídeo em todas as ações e manter as políticas de acesso por usuário.
- Adicionar secrets para o provedor gerenciado escolhido e, se necessário, para o render externo; o app continuará operando com Cobalt + render local quando os fallbacks não estiverem configurados.
- Não usar `yt-dlp` dentro da função serverless; ele exige um ambiente de processamento externo com sistema operacional completo.
- Não usar a API oficial do YouTube para download: ela fornece metadados, não o arquivo de mídia.

## 7. Testes de aceitação

- Upload MP4 curto e longo: importar, transcrever, analisar, criar clipes, renderizar e baixar.
- YouTube público aceito pelo Cobalt: caminho primário completo.
- YouTube bloqueado no Cobalt: fallback gerenciado completo.
- Vídeo disponível apenas em áudio: escolha do usuário e pipeline parcial correto.
- Falhas simuladas de timeout, rate limit, memória e aba fechada: retry sem duplicações.
- Conferir desktop e mobile, jobs no banco, arquivos no Storage e ausência de erros no console/rede.

## Detalhes técnicos

- Novos módulos serão separados em contratos/adaptadores, orquestração e wrappers finos de server functions.
- O job `download` existente será usado como fonte de verdade; resultados intermediários ficarão em `payload/result` e metadados do vídeo.
- Uma pequena migração poderá adicionar índices/estados auxiliares necessários, mantendo grants e políticas de acesso.
- A integração gerenciada será feita via HTTP compatível com ambiente serverless; serviços que exigem binários Node ou processos locais serão descartados.