####################################################################
#   Stage 1 — Build Layer                                          #
#   - Installs build-time system dependencies                      #
#   - Installs Python wheels/dependencies into /usr/local          #
#   - Keeps no extra files to reduce final image size              #
####################################################################
FROM python:3.12-slim AS build

ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /build

# ------------------------------------------------------------------
# 1. System build dependencies (GCC, etc. for compiling Python libs)
# ------------------------------------------------------------------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        git && \
    rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------
# 2. Python dependencies installation
# ------------------------------------------------------------------
COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

####################################################################
#   Stage 2 — Slim Runtime Image                                   #
#   - Copies only site-packages and binaries from Stage 1          #
#   - Installs runtime dependencies                                #
#   - Copies application source code                               #
####################################################################
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# ------------------------------------------------------------------
# 1. Runtime System Libraries
#    - poppler-utils: PDF utilities for pdf2image
#    - libgl1: OpenCV dependencies
# ------------------------------------------------------------------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        poppler-utils \
        libgl1 \
        libglib2.0-0 \
        curl && \
    rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------
# 2. Copy Python environment from Build Stage
# ------------------------------------------------------------------
# Copy pre-installed Python packages
COPY --from=build /usr/local/lib/python3.12/site-packages \
                  /usr/local/lib/python3.12/site-packages

# Copy Python executables (uvicorn, etc.)
COPY --from=build /usr/local/bin /usr/local/bin

# ------------------------------------------------------------------
# 3. Application Source
# ------------------------------------------------------------------
COPY . .

# ------------------------------------------------------------------
# 4. Default launch command
# ------------------------------------------------------------------
CMD ["uvicorn", "entrypoint:app", "--host", "0.0.0.0", "--port", "8000"]