# Build every project (library + games/*) with Node 22, then serve the
# assembled dist/ from a slim Python image. buildAll.py needs Python too.
# Base images come via mirror.gcr.io (Google's Docker Hub mirror): the Mac mini
# cannot pull from Docker Hub over SSH, and the mirror needs no login.
FROM mirror.gcr.io/library/node:22-bookworm AS build
WORKDIR /src
RUN command -v python3 || (apt-get update && apt-get install -y --no-install-recommends python3)
COPY . .
RUN python3 scripts/buildAll.py --install

FROM mirror.gcr.io/library/python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY --from=build /src/dist ./dist
ENV PORT=8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
