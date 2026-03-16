from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Vacation Control API"
    app_env: str = "dev"
    app_debug: bool = True
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://vacation_user:vacation_pass@localhost:5432/vacation_db"
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    llm_enabled: bool = False
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_timeout_seconds: int = 20
    smtp_enabled: bool = False
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from_name: str = "SEEKOP Vacaciones"
    smtp_from_email: str | None = None
    app_frontend_url: str = "http://localhost:3000"
    # Expenses / Storage
    storage_backend: str = "local"  # "local" or "s3"
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 10
    allowed_upload_types: str = "image/jpeg,image/png,image/webp,application/pdf"
    openai_vision_model: str = "gpt-4o"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
