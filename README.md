# MinIO Navigator

O **MinIO Navigator** é uma aplicação leve e moderna desenvolvida em Node.js para auxiliar na navegação de diretórios e visualização de arquivos em um servidor local do MinIO (ou qualquer outro serviço compatível com a API S3). 

Ele oferece uma interface web premium, responsiva e com tema escuro (Dark Theme), focada na legibilidade e interatividade de documentos técnicos, contendo suporte nativo para Markdown e renderização de diagramas Mermaid interativos.

---

## Principais Recursos

- **Sidebar Treeview Dinâmico (Lazy-Loaded)**: Carrega pastas sob demanda conforme o usuário navega. Pastas são exibidas antes dos arquivos e tudo é ordenado alfabeticamente.
- **Divisor Flexível (Splitter)**: Permite ajustar a largura da barra lateral de navegação arrastando a borda com o mouse.
- **Visualizador de Arquivos Extensível**:
  - **Markdown (`.md`)**: Renderizado em HTML limpo e seguro (via `marked` e `DOMPurify`), com realce de sintaxe nos blocos de código via **Highlight.js**.
  - **Texto / Código (`.txt`, `.json`, `.yml`, etc.)**: Visualizador premium com linhas numeradas e realce de sintaxe via **CodeMirror 5** (modo somente leitura).
  - **Arquivos Não Suportados**: Exibição de mensagem informativa com link direto de download/visualização do conteúdo bruto.
- **Gerenciamento Seguro de Arquivos**:
  - **Edição em Popup**: Permite editar arquivos de texto/markdown diretamente em um popup/modal usando CodeMirror. Inclui dropdown com suporte a 5 temas de cores (*Dracula*, *Monokai*, *Material Darker*, *Nord*, *Eclipse*) persistidos no `localStorage`.
  - **Exclusão**: Permite excluir permanentemente arquivos ou pastas recursivamente direto no sidebar (com modal de confirmação para prevenir acidentes).
- **Diagramas Mermaid Interativos**:
  - Renderiza blocos de código ` ```mermaid ` diretamente como SVG no corpo do documento.
  - Ao clicar no diagrama, abre um **popup em tela cheia** com recursos avançados de **Pan (arrastar)** e **Zoom (roda do mouse)** utilizando a biblioteca `Panzoom`.

---

## Requisitos Próximos

- **Node.js** (versão 16 ou superior)
- Um servidor **MinIO** rodando localmente ou remotamente.

---

## Instalação

1. Clone ou extraia os arquivos do projeto para o seu diretório local.
2. Acesse a pasta do projeto no terminal e instale as dependências:
   ```bash
   npm install
   ```

---

## Configuração (`.env`)

Crie um arquivo chamado `.env` na raiz do projeto (use o `.env.example` como base). Ele deve conter as seguintes configurações:

```env
# Porta onde o servidor Node.js será executado
PORT=4000

# Dados de Conexão com o MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=seu_access_key
MINIO_SECRET_KEY=seu_secret_key

# Nome do Bucket padrão que deseja explorar
# (Caso seja deixado em branco, a raiz exibirá a lista de todos os buckets disponíveis)
MINIO_BUCKET=mdvis-docs
```

---

## Executando o Projeto

Para iniciar o servidor web:

### Em Produção
```bash
npm start
```

### Em Desenvolvimento (reinicia automaticamente ao alterar arquivos)
```bash
npm run dev
```

Após iniciar, acesse o painel pelo navegador:
👉 **[http://localhost:4000](http://localhost:4000)**

---

## Estrutura do Projeto

```
minIONavigator/
├── .env.example        # Modelo de configuração do ambiente
├── .env                # Suas configurações ativas (não comitado no Git)
├── package.json        # Arquivo de dependências do Node.js
├── server.js           # Servidor Express & Integração com o SDK do MinIO
└── public/             # Interface e recursos frontend
    ├── index.html      # Estrutura HTML com os scripts CDN
    ├── style.css       # Estilização visual (tema escuro e Markdown)
    └── app.js          # Lógica frontend (splitter, treeview, renderers e panzoom)
```

---

## Estendendo a Área de Visualização

A aplicação possui uma arquitetura simples e desacoplada para renderizadores de arquivos dentro do arquivo `public/app.js`. Se quiser adicionar novos suportes, como por exemplo renderizar PDFs ou imagens, basta cadastrar um novo objeto no array `viewers`:

```javascript
const viewers = [
  // Exemplo de novo visualizador de imagens
  {
    name: 'Images',
    test: (filename) => /\.(png|jpe?g|gif|svg|webp)$/i.test(filename),
    render: async (bucket, path, container) => {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <img src="/api/file?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}" 
               style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);" />
        </div>
      `;
    }
  },
  // Visualizadores padrão já inclusos ...
];
```
