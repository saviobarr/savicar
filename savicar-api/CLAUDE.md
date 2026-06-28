# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the server (port 8080)
go run main.go

# Build binary
go build -o badencar-api

# Regenerate Swagger docs (requires swag CLI)
swag init

# Add/update dependencies
go mod tidy
```

No test suite exists in this project.

## Architecture

Three-layer clean architecture, replicated across 18 domain modules:

```
Domain layer:    internal/domain/<module>/          — entity structs + repository interfaces
Application layer: internal/application/<module>/   — service structs wrapping repositories
Infrastructure:  internal/infrastructure/
                   http/handler/<module>/            — Gin HTTP handlers with Swagger annotations
                   persistence/<module>/             — MySQL SQL repository implementations
                   storage/local.go                  — local filesystem file storage
```

**Wiring** is done in [main.go](main.go): `repo → service → handler → router registration`. All 18 modules follow the same constructor pattern.

## Adding a New Module

Follow the pattern of any existing module (e.g., `country` is the simplest):
1. `internal/domain/<module>/` — entity struct + `Repository` interface
2. `internal/application/<module>/` — `Service` struct with constructor
3. `internal/infrastructure/persistence/<module>/` — `MySQLRepository` implementing the interface
4. `internal/infrastructure/http/handler/<module>/` — Gin handler with Swagger annotations
5. Wire it in `main.go` and run `swag init` to regenerate docs

## Key Configuration (Hardcoded)

- **Database:** MySQL at `Note-Savio:3306`, db=`badencar`, user=`badencar`, password=`badencar` — see [db/db.go](db/db.go)
- **File uploads:** base path `/home/savio/badencar-img` — see [main.go](main.go)
- **Server port:** `:8080`
- **Swagger UI:** `http://localhost:8080/swagger/index.html`

## Notable Patterns

- All SQL queries use `?` placeholders (MySQL syntax) with parameterized args
- CORS allows all origins; methods: GET, POST, PUT, DELETE, OPTIONS
- File/image uploads use multipart form; stored on local filesystem via `LocalFileStorage`
- Service order images support ZIP export with a `manifest.json` inside
- Logging uses the standard `log/slog` package
- Database schema lives outside this repo; table names are UPPER_SNAKE_CASE
