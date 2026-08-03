# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O Projeto

ERP automotivo self-hosted para oficinas mecânicas. Monorepo com backend Go e frontend React.

```
savicar/
├── savicar-api/     # Backend Go (porta 8080)
├── savicar-web/     # Frontend React/Vite (porta 5173)
├── build.ps1        # Script oficial de build de produção — ver seção "Build de produção"
└── CLAUDE.md
```

Build de produção: **sempre use `.\build.ps1`** (na raiz do repo), nunca `go build` manual. Veja a seção "Build de produção" abaixo.

---

## savicar-api

### Comandos

```bash
cd savicar-api
go run main.go     # Sobe a API na porta 8080 (dev)
go mod tidy         # Atualizar dependências
swag init           # Regenerar docs Swagger (requer swag CLI)
```

Para gerar o executável de produção, **não rode `go build` manualmente aqui** — use `.\build.ps1` na raiz do repo (seção "Build de produção").

Não há suite de testes.

### Arquitetura

Três camadas replicadas em ~20 módulos de domínio. O `main.go` está na raiz do projeto (não em `cmd/`):

```
internal/domain/<módulo>/              — entity structs + interfaces de repositório (ports)
internal/application/<módulo>/         — services (casos de uso), dependem só de interfaces
internal/infrastructure/
  http/handler/<módulo>/               — handlers Gin
  persistence/<módulo>/                — MySQL repositories (driven adapters)
  storage/local.go                     — armazenamento de arquivos no filesystem
db/db.go                               — conexão MySQL via variáveis de ambiente
main.go                                — wiring: repo → service → handler → rota
```

**Regra rígida:** `domain` não importa nada externo. `application` só importa `domain`. Handlers chamam `application`, nunca `persistence` diretamente.

### Adicionar um novo módulo

Siga o padrão do módulo `country` (mais simples):
1. `internal/domain/<módulo>/` — entidade + interface `Repository`
2. `internal/application/<módulo>/` — `Service` com construtor
3. `internal/infrastructure/persistence/<módulo>/` — `MySQLRepository`
4. `internal/infrastructure/http/handler/<módulo>/` — handler Gin com anotações Swagger
5. Wire em `main.go` e rode `swag init`

### Configurações importantes

- **DB:** lido do `.env` via `godotenv` — variáveis `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. O `.env` fica na raiz de `savicar-api/`.
- **Upload de imagens:** `uploadBasePath = "/home/savio/savicar-img"` hardcoded em `main.go` — caminho Linux, precisa ser ajustado para deploy Windows.
- **Porta:** `:8080`
- **CORS:** permite todas as origens
- **Tabelas MySQL:** nomes em `UPPER_SNAKE_CASE`
- **Swagger UI:** `http://localhost:8080/swagger/index.html`

---

## savicar-web

### Comandos

```bash
cd savicar-web
npm install       # Instalar dependências
npm run dev       # Dev server porta 5173
npm run build     # Build de produção → dist/ (uso local/preview)
```

`npm run build` sozinho **não** é o processo de deploy — o `dist/` gerado não é copiado/embutido automaticamente. Para gerar o executável final, use `.\build.ps1` na raiz do repo (seção "Build de produção"), que builda o frontend e já embute no binário Go.

### Stack real

- React + Vite (sem TypeScript)
- **Sem** ORM de estado (sem Zustand), **sem** React Hook Form, **sem** Zod, **sem** Axios
- HTTP: `fetch` nativo, funções centralizadas em `src/api.js`
- Componentes `.jsx` em PascalCase

### Como as chamadas de API funcionam

`src/api.js` usa `BASE = import.meta.env.VITE_API_URL ?? ''`. Sem a variável de ambiente, todas as chamadas são relativas (`/service-orders`, etc.) e o proxy do Vite (`vite.config.js`) as encaminha para `http://localhost:8080`. **Nunca use `http://localhost:8080` como fallback hardcoded** — quebra acesso externo via Cloudflare Tunnel.

O proxy do Vite cobre todos os prefixos de rota da API, incluindo `tenant-config` e `whatsapp`.

### Estrutura do frontend

- `src/api.js` — todas as chamadas HTTP
- `src/App.jsx` — roteamento, sidebar, logo (carregada de `/tenant-config/logo`)
- `src/pages/ServiceOrderPage.jsx` — página principal (~2300 linhas); contém `NewCarModal`, `WppSendModal`, `printServiceOrder`, `ServiceOrderDetailFull`
- `src/components/CrudPage.jsx` + `CrudFormPage.jsx` — base reutilizável para páginas CRUD

---

## Build de produção

```powershell
cd C:\work\badencar\savicar
.\build.ps1
```

O `main.go` do `savicar-api` embute o frontend via `//go:embed dist` (pasta `savicar-api/dist`) — o binário é self-contained, não serve arquivos de `savicar-web/dist` do disco. Por isso o build de produção **precisa** passar pelo `build.ps1`, que:

1. Builda `savicar-web` (`npm run build`) **e** o frontend do projeto irmão `badencar`, em `C:\work\badencar\badencar\badencar-web` (repo separado, fora de `savicar/`).
2. Copia cada `dist/` gerado para dentro de `savicar-api\dist\` antes de compilar (por isso a ordem importa — nunca rode `go build` manual em `savicar-api` sem antes colocar o `dist` certo lá).
3. Gera ícone (`.ico`/`.syso` via `rsrc`, instalado automaticamente se faltar) e compila com `-H windowsgui -s -w` (sem janela de console).
4. Ao final, restaura `savicar-api\dist\index.html` para um placeholder (`build placeholder`) — esse é o estado normal do arquivo no git; se você ver o `dist/` real ali fora de um build em andamento, foi rodado `go build` manual por engano.

Saída:
- `dist\savicar\savicar.exe` (branding Savicar)
- `dist\badencar\badencar.exe` (mesmo backend, branding/frontend Badencar)

---

## Credenciais de desenvolvimento

- **Login local (dev):** `admin` / `admin`

---

## Infraestrutura

- **Self-hosted** em máquina Windows local
- **Exposição externa:** Cloudflare Tunnel → `www.savicar.com.br`
- **Tunnel ID:** `e1a2800d-cfbf-46f8-b136-b9328101fd2f`
- **Config do tunnel:** `C:\Users\proje\.cloudflared\config.yml`

```cmd
cloudflared tunnel run savicar   # Subir tunnel manualmente
```

---

## Domínios de negócio

| Módulo | Descrição |
|--------|-----------|
| `serviceorder` | Ordens de Serviço — fluxo principal |
| `customer` / `customermodel` | Clientes e veículos do cliente |
| `inventory` / `serviceorderproducts` | Estoque e produtos usados na OS |
| `services` | Serviços executados na OS |
| `payment` / `paymentmethod` | Pagamentos da OS |
| `technician` | Técnicos da oficina |
| `serviceappointment` | Agenda de serviços |
| `tenantconfig` | Configurações da oficina (logo, WhatsApp) |
| `operationalcosts` / `costcategory` | Custos operacionais |
| `financialreport` | Relatórios financeiros |

---

## O que NÃO fazer

- Não usar ORM — apenas `database/sql` com placeholders `?`
- Não importar pacotes externos em `internal/domain/`
- Não chamar `persistence` diretamente nos handlers
- Não colocar lógica de negócio nos handlers Gin
- Não hardcodar `http://localhost:8080` no frontend — usar URL relativa
- Não rodar `go build` manual para gerar o executável de produção — usar `.\build.ps1` (ver "Build de produção")
