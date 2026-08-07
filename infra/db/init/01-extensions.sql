-- Runs on first boot of the postgres container (docker-entrypoint-initdb.d).
CREATE EXTENSION IF NOT EXISTS vector;
