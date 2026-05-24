# Especificações do Projeto: MinIO Navigator

Este documento descreve o conceito, a arquitetura e os detalhes de implementação do **MinIO Navigator**, servindo de guia técnico para desenvolvedores e agentes autônomos que venham a manter ou estender esta aplicação.

---

## 1. Conceito Geral

O **MinIO Navigator** é um navegador e visualizador de arquivos leve para servidores MinIO locais (ou outros armazenamentos de objetos compatíveis com a API S3). 

A aplicação foi projetada para resolver a visualização rápida e interativa de documentações técnicas de projetos (arquivos Markdown com diagramas Mermaid inclusos, arquivos de configuração JSON, arquivos de log e textos diversos) sem a necessidade de baixar os arquivos manualmente.

---

## 2. Estrutura de Diretórios

O projeto segue uma estrutura minimalista sem frameworks SPA complexos (como React, Vue ou Angular), utilizando HTML/CSS/JS puros e pacotes padrão no backend.

```
minIONavigator/
├── .env.example                # Modelo de variáveis de ambiente
├── .env                        # Chaves ativas de conexão com o MinIO (Ignorado no Git)
├── package.json                # Gerenciamento de dependências
├── server.js                   # Backend da aplicação (Express + MinIO SDK)
├── specs/
│   └── 01-minIO Navigator.md   # Este arquivo de especificações
└── public/                     # Frontend estático
    ├── index.html              # Layout principal e chamadas CDN
    ├── style.css               # Tema escuro e estilização de Markdown/Mermaid
    └── app.js                  # Lógica do splitter, árvore e visualizadores
```

---

## 3. Configurações (`.env`)

A aplicação busca as variáveis de ambiente a partir do arquivo `.env`. As variáveis essenciais são:

- `PORT`: Porta utilizada pelo servidor backend (padrão: `4000`).
- `MINIO_ENDPOINT`: Host e porta do painel da API do MinIO (ex: `localhost:9000`).
- `MINIO_USE_SSL`: Define se a conexão usa HTTPS (`true` ou `false`).
- `MINIO_ACCESS_KEY` e `MINIO_SECRET_KEY`: Credenciais de acesso configuradas no MinIO.
- `MINIO_BUCKET`: Opcional. Nome do bucket padrão que será exibido como raiz da árvore. Se omitido, a aplicação iniciará exibindo a lista de todos os buckets visíveis na conta.

---

## 4. Arquitetura do Backend (`server.js`)

O backend é construído em Node.js com o framework **Express** e utiliza a biblioteca oficial `minio` para se comunicar com o servidor de armazenamento de objetos.

### Endpoints da API

#### 1. Listar Objetos: `GET /api/files`
- **Parâmetros de Consulta (Query)**:
  - `bucket` (opcional): O bucket onde pesquisar. Se não fornecido e `MINIO_BUCKET` do `.env` estiver vazio, retorna a lista de todos os buckets disponíveis.
  - `prefix` (opcional): O diretório virtual a ser listado (ex: `Docs/`).
- **Regras de Negócio**:
  - Faz a listagem não recursiva (`recursive: false`) sob o prefixo especificado.
  - Formata as saídas identificando diretórios virtuais (prefixes) e arquivos normais (objects).
  - **Ordenação**: Separa pastas e arquivos. Ordena as pastas alfabeticamente e os arquivos alfabeticamente. Em seguida, concatena e retorna a lista com as pastas aparecendo primeiro.
  
#### 2. Obter Arquivo Bruto: `GET /api/file`
- **Parâmetros de Consulta (Query)**:
  - `bucket` (obrigatório)
  - `path` (obrigatório): O caminho completo até o objeto desejado.
- **Regras de Negócio**:
  - Obtém o stream do objeto chamada `getObject(bucket, path)`.
  - Resolve a extensão do arquivo e atribui o cabeçalho `Content-Type` apropriado (ex: `text/markdown`, `application/json`, `text/plain`).
  - Encaminha o stream diretamente para a resposta da requisição (`stream.pipe(res)`).

---

## 5. Arquitetura do Frontend (`public/`)

A interface foi projetada com foco em experiência de usuário (UX) e visual premium utilizando temas escuros inspirados em IDEs modernos.

### 5.1 HTML (`index.html`)
O frontend utiliza bibliotecas importadas via CDN para evitar etapas de compilação complexas:
- **Lucide Icons**: Ícones minimalistas em formato vetorial SVG.
- **Marked.js**: Conversor rápido de Markdown para HTML.
- **DOMPurify**: Sanitizador de segurança que remove scripts maliciosos injetados em Markdown.
- **Mermaid.js**: Motor JavaScript de renderização de fluxogramas e diagramas baseados em texto.
- **Panzoom**: Biblioteca leve para realizar zoom e movimentações bidimensionais (pan) em elementos HTML/SVG.

### 5.2 Divisor de Tela (Splitter)
Implementado no script `app.js` escutando eventos de mouse do navegador:
- Altera a largura (`width`) do elemento `.sidebar` dinamicamente conforme o mouse arrasta a barra divisória.
- Define a variável CSS `--sidebar-width` globalmente para manter o layout consistente.
- Possui limites de largura mínima e máxima (`220px` a `600px`).

### 5.3 Navegador em Árvore (Treeview)
O componente de navegação funciona de forma preguiçosa (**lazy loading**):
1. No carregamento inicial, busca os elementos raiz da API (`/api/files`).
2. Constrói elementos DOM aninhados sob a classe `.tree-node-wrapper`.
3. **Expansão de Pastas**:
   - Ocorre via **duplo clique** na pasta ou por **clique simples** na setinha de expansão (`.node-arrow`).
   - Se os dados da pasta ainda não foram carregados, exibe um spinner e chama `/api/files?bucket=...&prefix=...` para injetar os filhos no DOM.
   - Rotaciona a setinha `.node-arrow` adicionando a classe `.expanded` (transformando a seta lateral em seta apontando para baixo).
4. **Seleção de Arquivos**:
   - Um clique simples no nó de um arquivo destaca-o visualmente (classe `.active`) e dispara a função `loadFile`.

### 5.4 Arquitetura Extensível do Visualizador
A renderização dos arquivos utiliza um padrão de registro extensível. No arquivo `app.js`, há um array de visualizadores registrados:

```javascript
const viewers = [
  {
    name: 'Markdown',
    test: (filename) => filename.endsWith('.md'),
    render: async (bucket, path, container) => { /* renderização markdown e mermaid */ }
  },
  {
    name: 'Text/JSON',
    test: (filename) => { /* teste para txt, json, logs */ },
    render: async (bucket, path, container) => { /* exibição de código ou texto */ }
  }
];
```

Se nenhum visualizador retornar `true` no teste de nome, o sistema utiliza o `fallbackViewer` padrão. Isso permite que novas extensões de arquivo (ex: `.pdf`, `.png`) sejam mapeadas futuramente de maneira limpa apenas inserindo novos elementos no array `viewers`.

### 5.5 Integração de Diagramas Mermaid
Quando um arquivo Markdown é renderizado:
1. O texto do markdown é parseado para HTML e sanitizado.
2. A aplicação faz uma busca no HTML gerado procurando blocos de código rotulados como `language-mermaid`.
3. Substitui os blocos `<pre><code>` por um contêiner `.mermaid-container` e salva o código mermaid original no atributo `data-diagram` do elemento.
4. Inicializa o Mermaid e aciona a renderização assíncrona (`mermaid.render`) convertendo o texto do diagrama em um SVG injetado na tela.
5. Adiciona um escutador de cliques no SVG. Ao clicar, a aplicação abre o painel modal interativo.

### 5.6 Modal Interativo (Zoom e Pan)
- O modal preenche a quase totalidade da viewport com um fundo translúcido desfocado (`backdrop-filter`).
- Recebe o código bruto do diagrama do elemento clicado e reconstrói o SVG no modal.
- Inicializa a biblioteca `Panzoom` no SVG gerado, vinculando a rolagem do mouse (`wheel`) ao controle de ampliação/redução e habilitando a navegação livre ao arrastar o mouse.
- Oferece controles manuais rápidos: Zoom In, Zoom Out, Restaurar Zoom/Posição e Fechar.
