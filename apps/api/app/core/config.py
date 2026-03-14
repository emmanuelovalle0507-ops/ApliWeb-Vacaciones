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
    expense_upload_dir: str = "./uploads/expenses"
    expense_max_file_mb: int = 10
    expense_allowed_mime: str = "image/jpeg,image/png,application/pdf,text/xml,application/xml"
    expense_ocr_enabled: bool = False
    expense_ocr_provider: str = "openai"
    expense_ocr_model: str = "gpt-4o-mini"
    expense_auto_analyze: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
