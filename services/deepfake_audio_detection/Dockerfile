####################################################################
#   Stage 1 — Build Layer                                          #
#   - CUDA 11.2 + cuDNN 8 runtime base (TF 2.6.2 compatible)        #
#   - Installs Python 3.9                                           #
#   - Builds wheels for pinned requirements                         #
####################################################################
FROM nvidia/cuda:11.2.2-cudnn8-runtime-ubuntu20.04 AS build

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /build

# ------------------------------------------------------------------
# 1. System build dependencies (compilers + headers + common libs)
# ------------------------------------------------------------------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        software-properties-common \
        build-essential \
        git \
        curl \
        pkg-config \
        ca-certificates \
        libsndfile1 \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
        poppler-utils \
        libjpeg-turbo8 \
        zlib1g \
        libpng16-16 && \
    rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------
# 2. Install Python 3.9 (+ venv + distutils)
# ------------------------------------------------------------------
RUN add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        python3.9 \
        python3.9-venv \
        python3.9-distutils && \
    rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------
# 3. Install pip (pinned) + build wheels for reproducibility
#    (Pinning avoids modern pip/setuptools breaking old setup.py pkgs)
# ------------------------------------------------------------------
RUN curl -sS https://bootstrap.pypa.io/get-pip.py -o get-pip.py && \
    python3.9 get-pip.py "pip==23.2.1" "setuptools==65.7.0" "wheel==0.41.3" && \
    rm -f get-pip.py

COPY requirements.txt .

# Build wheels once (faster + cleaner final stage)
RUN python3.9 -m pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt


####################################################################
#   Stage 2 — Runtime Image                                        #
#   - CUDA 11.2 + cuDNN 8 runtime base                              #
#   - Installs Python 3.9                                           #
#   - Installs ONLY prebuilt wheels + runtime libs                  #
####################################################################
FROM nvidia/cuda:11.2.2-cudnn8-runtime-ubuntu20.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
WORKDIR /app

# ------------------------------------------------------------------
# 1. Runtime System Libraries
# ------------------------------------------------------------------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        software-properties-common \
        ca-certificates \
        curl \
        libsndfile1 \
        ffmpeg \
        poppler-utils \
        libgl1 \
        libglib2.0-0 \
        libjpeg-turbo8 \
        zlib1g \
        libpng16-16 && \
    rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------
# 2. Install Python 3.9 (+ venv + distutils)
# ------------------------------------------------------------------
RUN add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        python3.9 \
        python3.9-venv \
        python3.9-distutils && \
    rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------
# 3. Install pip toolchain (same pins as build stage)
# ------------------------------------------------------------------
RUN curl -sS https://bootstrap.pypa.io/get-pip.py -o get-pip.py && \
    python3.9 get-pip.py "pip==23.2.1" "setuptools==65.7.0" "wheel==0.41.3" && \
    rm -f get-pip.py

# ------------------------------------------------------------------
# 4. Install Python dependencies from wheels
# ------------------------------------------------------------------
COPY --from=build /wheels /wheels
RUN python3.9 -m pip install --no-cache-dir /wheels/* && \
    rm -rf /wheels

# ------------------------------------------------------------------
# 5. Application Source
# ------------------------------------------------------------------
COPY . .

# ------------------------------------------------------------------
# 6. Default launch command
# ------------------------------------------------------------------
CMD ["python3.9", "-m", "uvicorn", "entrypoint:app", "--host", "0.0.0.0", "--port", "8000"]
