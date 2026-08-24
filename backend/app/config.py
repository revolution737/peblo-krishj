from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://peblo:peblo_dev_password@localhost:5432/peblo_tv"
    jwt_secret_key: str = "local-dev-secret-key-do-not-use-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60
    
    storage_backend: str = "local"
    storage_local_path: str = "/app/storage"
    
    seed_on_startup: bool = True
    default_admin_email: str = "admin@peblo.tv"
    default_admin_password: str = "admin123"
    default_editor_email: str = "editor@peblo.tv"
    default_editor_password: str = "editor123"
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
