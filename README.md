# Storybook — cuentos ilustrados, narrados y ambientados, 100 % en local

Storybook convierte una **idea** y un **género** en un cuento de **exactamente cinco escenas** con texto, ilustración original,
narración con voz sintética y ambiente sonoro. Todo se genera en tu computadora con modelos abiertos de Hugging Face:
**sin APIs de pago, sin servicios remotos y sin internet** una vez descargados los modelos.

| Módulo | Modelo / técnica | Licencia |
|---|---|---|
| Texto | `Qwen2.5-1.5B-Instruct` (ligero) · `Qwen2.5-3B-Instruct` (equilibrado) · `Qwen2.5-7B-Instruct` 4 bits (calidad) | 1.5B y 7B: Apache 2.0 · 3B: Qwen Research (no comercial) |
| Imagen | `stabilityai/sd-turbo` (CPU) · `stabilityai/sdxl-turbo` (GPU) | Stability AI Community (no comercial) |
| Consistencia visual | Biblia del personaje + contexto narrativo + semillas distintas y reproducibles por escena + `h94/IP-Adapter` (perfil calidad) | Apache 2.0 |
| Métrica de consistencia | `openai/clip-vit-base-patch32` (solo mide, no genera) | MIT |
| Voz | `facebook/mms-tts-spa` (VITS) | CC BY-NC 4.0 |
| Ambiente | Síntesis procedural propia (NumPy/SciPy), 12 paisajes | Código propio |
| Base de datos | SQLite (incluida en Python, nada que instalar) | — |

## Funcionalidades
- Registro / acceso con correo y contraseña (bcrypt + JWT).
- Creación con idea + 6 géneros + opciones avanzadas (perfil, semilla, pasos de difusión, temperatura, consistencia ON/OFF).
- Generación en segundo plano con **avance real escena por escena** (texto → imagen → voz/ambiente) y cola persistente.
- Lector: navegación, miniaturas, teclado (← → espacio), voz con play/pausa/detener/progreso/volumen, ambiente con volumen,
  **reproducción automática**, taller de edición por escena con historial/restauración de versiones, re-narración del texto
  editado y reilustración.
- Biblioteca con búsqueda, filtro por género, **favoritos** y **borrado**.
- **PDF** ilustrado y **enlace público** desactivable.
- **Panel de experimentos**: tiempos por módulo, tokens/s, menciones del protagonista, **similitud CLIP entre escenas**, CSV y
  comparación controlada de consistencia ON/OFF con la misma idea, género, perfil y semilla.
- Script de **experimentos reproducibles** que genera las evidencias del informe (`backend/scripts/run_experiments.py`).

## Requisitos
| Perfil | Hardware | Tiempo aprox. por cuento* |
|---|---|---|
| `ligero` | CPU 4+ núcleos, 12 GB RAM, ~8 GB de disco | decenas de minutos |
| `equilibrado` | GPU NVIDIA 8 GB+ VRAM, 16 GB RAM, ~15 GB de disco | pocos minutos |
| `calidad` | GPU NVIDIA 12 GB+ VRAM, 16–32 GB RAM, ~30 GB de disco | pocos minutos |

\* Estimaciones. En el entorno de desarrollo (CPU de 2 núcleos, sin GPU, perfil ligero) un cuento tardó ≈ 28 minutos. **Mide los
tiempos en tu hardware** con `scripts/run_experiments.py` y regístralos en el informe.

Software: Python 3.11 o 3.12, Node.js 18+, Git. Para GPU: driver NVIDIA reciente (CUDA 12.1 lo trae PyTorch).

## Instalación paso a paso

### 1. Backend
```bash
git clone <tu-repo> storybook && cd storybook/backend
python -m venv .venv
source .venv/bin/activate            # Windows (PowerShell): .venv\Scripts\Activate.ps1

# PyTorch PRIMERO, según tu hardware:
pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cu121   # GPU NVIDIA
# pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu   # solo CPU

pip install -r requirements.txt
pip install bitsandbytes             # solo perfil "calidad" (Qwen 7B en 4 bits)

cp .env.example .env                 # Windows: copy .env.example .env
python scripts/hardware_report.py    # comprueba que ves tu GPU (CUDA) y las versiones
```

### 2. Descarga única de modelos (necesita internet)
```bash
python scripts/download_models.py --profile equilibrado    # ligero | equilibrado | calidad | all
```
Se guardan en la caché de Hugging Face (`~/.cache/huggingface`, o la carpeta de `HF_HOME`).

### 3. Modo sin conexión
Agrega `HF_HUB_OFFLINE=1` en `backend/.env`. Desde ahí la app **no hace ninguna conexión de red**.
```bash
uvicorn server:app --host 127.0.0.1 --port 8001
```

### 4. Frontend (otra terminal)
```bash
cd frontend
cp .env.example .env                 # REACT_APP_BACKEND_URL=http://localhost:8001
npm install
npm start                            # http://localhost:3000
```
Las tipografías están empaquetadas con la app (`@fontsource`): funciona sin internet.

## Ejemplo de uso
1. Crear cuenta → **Crear Cuento**.
2. Idea: *«una niña que colecciona sonidos del bosque»* · Género: Fantasía → **Tejer mi cuento**.
3. Ver el avance en vivo; al terminar, recorrer las 5 escenas, activar **Reproducción automática** y exportar el PDF.
4. Repetir con la misma semilla y la consistencia desactivada; comparar en **Experimentos**.

## Evidencias para el informe
```bash
python scripts/run_experiments.py --profile equilibrado                      # 3 combos × {off, on}
python scripts/run_experiments.py --profile calidad --strategies off on ip   # añade IP-Adapter
```
Crea `docs/evidencias/<fecha>/` con, por cada corrida: las 5 ilustraciones, audios, `story.json`, `contact_sheet.jpg`
(las cinco escenas en fila, para comparar el personaje) y al final `resultados.csv` / `resultados.md`.

## Pruebas automáticas
```bash
cd backend
pip install -r requirements-dev.txt
python -m unittest discover -s tests -t . -v        # no requiere descargar modelos
```

## Estructura
```
backend/
  server.py        # FastAPI + autenticación + arranque
  stories.py       # rutas de cuentos, compartir, PDF, experimentos, /system
  db.py            # SQLite (usuarios y cuentos)
  auth.py          # bcrypt + JWT
  jobs.py          # cola de un solo worker (un modelo grande a la vez)
  engine/          # IA local
    config.py      # géneros, perfiles de modelos, estilos
    text_gen.py    # Qwen2.5: plan + 5 escenas (parser tolerante, saneado, reintento)
    image_gen.py   # SD/SDXL-Turbo (+ IP-Adapter)
    tts_gen.py     # MMS-TTS
    ambient_gen.py # 12 ambientes procedurales
    consistency.py # métrica CLIP
    pipeline.py    # orquestación + métricas (independiente de la base de datos)
    pdf_export.py
  scripts/         # download_models, run_experiments, hardware_report
  tests/
frontend/          # React + Tailwind (diseño "Códice")
docs/INFORME_TECNICO.md
```

## Ética, licencias y límites
- Las licencias de SD/SDXL-Turbo, MMS-TTS y Qwen2.5-3B **no permiten uso comercial**. Para un producto habría que cambiar esos
  modelos (p. ej. FLUX.1-schnell para imagen, Piper para voz, Qwen2.5-7B para texto); solo se editan los perfiles en `engine/config.py`.
- Los textos pueden contener errores o sesgos del modelo; modelos pequeños (1.5B) a veces repiten frases o mezclan idiomas.
- La voz es sintética y no imita a ninguna persona real. Los cuentos y el PDF se marcan como generados por IA.
- El repositorio no incluye claves, datos personales ni pesos de modelos. `.env` y `backend/data/` están en `.gitignore`.
- Los enlaces para compartir solo funcionan mientras tu servidor esté encendido y accesible desde la red del lector.
