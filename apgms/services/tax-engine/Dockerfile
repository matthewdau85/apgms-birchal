# syntax=docker/dockerfile:1.7

FROM python:3.10-slim AS builder
WORKDIR /opt/app
RUN pip install --no-cache-dir poetry

COPY services/tax-engine/pyproject.toml ./
RUN poetry export --without-hashes -f requirements.txt -o requirements.txt
RUN pip install --no-cache-dir --prefix /install -r requirements.txt

FROM python:3.10-slim AS runner
WORKDIR /app
ENV PYTHONUNBUFFERED=1

COPY --from=builder /install /usr/local
COPY services/tax-engine/app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
