# VibeGuard

<div align="center">

![VibeGuard](vibeguard_icon.jpeg)

**Prevención de filtración de claves API en tiempo real para entornos de Vibe Coding.**
Detecta secretos hardcodeados en el momento en que escribes y los corrige con un solo clic.

[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.90.0-blue?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=vibeguard.vibeguard)
[![Version](https://img.shields.io/badge/version-0.1.2-green)](https://github.com/vibeguard/vibeguard/releases)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

**[English](README.md) · [한국어](README.ko.md) · [中文](README.zh.md) · [日本語](README.ja.md)**

</div>

---

## ¿Por qué VibeGuard?

El auge de los asistentes de codificación con IA — ChatGPT, Claude, Cursor, Copilot — ha bajado drásticamente la barrera para publicar software. Un desarrollador con poca experiencia puede desplegar un servicio web en cuestión de horas.

Pero la velocidad sin medidas de seguridad crea una brecha estructural:

```
Asistente de codificación IA
  └─ Prioriza código funcional → inserta claves API directamente en el código fuente
        ↓
Desarrollador sin experiencia
  └─ "Si lo escribió la IA, debe ser seguro" — confianza ciega en el código generado
        ↓
Subida pública a GitHub
  └─ Clave API expuesta → pérdida económica / abuso del servicio / cuenta comprometida
```

Sitios como [apiradar.live](https://apiradar.live) agregan filtraciones de claves API de repositorios públicos **en tiempo real** — la gran mayoría procedentes de proyectos asistidos por IA. Esto ya no es un caso aislado.

**VibeGuard intercepta este problema a nivel de IDE.**
Antes de que el código llegue a Git, detecta los secretos expuestos y te guía para corregirlos automáticamente.

---

## Funcionalidades

### 1. Detección en Tiempo Real (9 Patrones de Servicio)

El escaneo se activa en menos de 500ms tras escribir, cubriendo los servicios más comunes en código generado por IA.

| Servicio | Patrón | Severidad |
|---|---|---|
| OpenAI | `sk-...`, `sk-proj-...` | Error |
| Anthropic | `sk-ant-...` | Error |
| AWS | `AKIA...` (16+ caracteres) | Error |
| Google Cloud | `AIza...` (35+ caracteres) | Error |
| GitHub | `ghp_...`, `github_pat_...` | Error |
| Stripe | `sk_live_...` | Error |
| Stripe (clave pública) | `pk_live_...` | Advertencia |
| Hugging Face | `hf_...` | Error |
| **Genérico** | Asignaciones como `api_key = "..."`, `secret = "..."` | Advertencia |

### 2. Corrección Automática con Un Clic (QuickFix)

Pulsa `Ctrl+.` (Mac: `Cmd+.`) sobre cualquier secreto detectado → selecciona **"VibeGuard: Move to .env"**

Qué se hace automáticamente:
- **Reemplazo preciso incluyendo comillas**: `"sk-abc..."` → `process.env.OPENAI_API_KEY`
- **Sintaxis apropiada por lenguaje** con imports automáticos:

  ```python
  # Python — `import os` insertado si falta
  import os                            # ← insertado automáticamente
  api_key = os.getenv("OPENAI_API_KEY")
  ```
  ```javascript
  // JavaScript / TypeScript
  const apiKey = process.env.OPENAI_API_KEY;
  ```
  ```go
  // Go
  apiKey := os.Getenv("OPENAI_API_KEY")
  ```

- **Escritura automática en `.env`** — crea el archivo si no existe
- **Actualización automática de `.gitignore`** — añade la entrada `.env` si no está

### 3. Inferencia Inteligente de Nombres de Variables

Analiza el contexto del código circundante para sugerir nombres de variable significativos.

```python
my_openai_key = "sk-proj-abc..."
# Sugerido: MY_OPENAI_KEY

client = OpenAI(api_key="sk-proj-abc...")
# Sugerido: API_KEY  (inferido desde `api_key`, no desde `client`)
```

### 4. Indicador de Seguridad en la Barra de Estado

Indicador de seguridad en vivo en la barra de estado de VS Code (parte inferior derecha):

```
$(shield) VibeGuard              ← Todo en orden
$(shield) VibeGuard: 3 issues   ← Advertencia (fondo ámbar)
```

Haz clic para lanzar un escaneo completo del workspace.

### 5. Escaneo Completo del Workspace

`Ctrl+Shift+P` → **"VibeGuard: Scan Workspace for Secrets"**

- Excluye automáticamente `node_modules`, `dist`, `build`, `.git` y archivos de bloqueo
- Indicador de progreso con soporte para cancelación
- Notificación de resumen al finalizar

### 6. Verificación de `.gitignore` al Iniciar

Al abrir el workspace, si existe un archivo `.env` pero no está en `.gitignore`, VibeGuard te advierte inmediatamente y ofrece añadirlo.

---

## Instalación

### Desde VS Code Marketplace

Busca **"VibeGuard"** en el panel de extensiones (`Ctrl+Shift+X`) y haz clic en **Instalar**.

### Instalación Manual (VSIX)

```bash
code --install-extension vibeguard-0.1.2.vsix
```

---

## Cómo Usar

1. Abre la carpeta del proyecto en VS Code.
2. Pega o escribe código generado por IA que contenga claves API.
3. Los secretos hardcodeados aparecen subrayados en rojo/amarillo en menos de 500ms.
4. Pulsa `Ctrl+.` → selecciona **"VibeGuard: Move to .env"**.
5. Confirma el nombre de variable sugerido → pulsa Enter.
6. Listo. La clave se escribe en `.env` y el código se actualiza con una referencia segura.

---

## Configuración

| Ajuste | Tipo | Valor por defecto | Descripción |
|---|---|---|---|
| `vibeguard.enable` | boolean | `true` | Activar o desactivar el escaneo de secretos |
| `vibeguard.confirmVariableName` | boolean | `true` | Mostrar cuadro de confirmación de nombre de variable antes de escribir |

---

## Principios de Diseño

**Sin llamadas a red.** Toda la detección se ejecuta localmente mediante expresiones regulares. Tu código nunca sale de tu máquina. Funciona sin conexión.

**Mínimos falsos positivos.** Las líneas que ya usan `process.env.KEY`, `os.getenv(...)`, `ENV[...]`, etc., se omiten. Las referencias seguras en *otras* líneas no suprimen la detección en la línea actual.

**Ediciones no destructivas.** Todos los cambios se realizan a través de la API `WorkspaceEdit` de VS Code — completamente reversibles con un único `Ctrl+Z`, incluyendo los imports insertados automáticamente.

---

## Hoja de Ruta

- Integración con Git pre-commit hook — bloquear commits que contengan secretos en bruto
- Auto-generación de `.env.example` para incorporación de equipos
- Detección basada en entropía — detectar cadenas de alta entropía más allá de los patrones conocidos
- Integración con CI/CD — aplicar las mismas reglas en pipelines de GitHub Actions
