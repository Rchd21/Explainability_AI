FROM python:3.9-slim AS build

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /build

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        git \
        curl \
        python3-dev \
        pkg-config && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt


FROM python:3.9-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libsndfile1 \
        ffmpeg \
        poppler-utils \
        curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/local /usr/local
COPY . .

CMD ["uvicorn", "entrypoint:app", "--host", "0.0.0.0", "--port", "8000"]
