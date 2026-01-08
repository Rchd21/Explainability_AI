## Run the project with Docker Compose

Environment variables are loaded from:

```bash
./config/global.env
```

---

### Base stack

**Build and start containers**

```bash
docker-compose --env-file ./config/global.env -f docker-compose.yml up --build
```

**Start without rebuilding**

```bash
docker-compose --env-file ./config/global.env -f docker-compose.yml up
```

---

### Development stack

Uses `docker-compose.dev.yml` on top of the base stack.

**Build and start**

```bash
docker-compose --env-file ./config/global.env -f docker-compose.yml -f docker-compose.dev.yml up --build
```

**Start without rebuilding**

```bash
docker-compose --env-file ./config/global.env -f docker-compose.yml -f docker-compose.dev.yml up
```

---

### Run in background

Add `-d` to any command:

```bash
docker-compose ... up -d
```


