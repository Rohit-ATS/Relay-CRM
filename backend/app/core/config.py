import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Relay CRM API"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "AI-native CRM backend for founder-led outbound workflows"
    
    HOST: str = "0.0.0.0"
    PORT: int = int(os.getenv("PORT", 8787))
    ENVIRONMENT: str = "development"
    MCP_AUTH_TOKEN: str | None = None
    OAUTH_SIGNING_SECRET: str | None = None
    
    # SQLite async by default; supports postgresql+asyncpg:// if provided
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./relay_crm.db")
    
    # CORS
    CORS_ORIGINS: str = "*"
    
    # AI Keys
    ANTHROPIC_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    DEFAULT_AI_MODEL: str = "claude-3-5-sonnet-20241022"

    @property
    def cors_origin_list(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # If DATABASE_URL starts with postgres:// (e.g. from Render), convert to async postgresql+asyncpg://
    @property
    def normalized_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
