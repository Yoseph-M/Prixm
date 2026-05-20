"""Application settings loaded from environment / .env file."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Path to Firebase service account JSON (downloaded from Firebase Console).
    # Never commit this file — it is listed in .gitignore.
    GOOGLE_APPLICATION_CREDENTIALS: str = "service-account.json"

    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB: str = "submgr"
    # If REDIS_URL is empty, the app uses an in-memory fallback that mimics the
    # Redis commands we rely on (ZADD/ZRANGEBYSCORE/SET/GET). Handy for demos.
    REDIS_URL: str = ""
    BASE_CURRENCY: str = "USD"
    # Days before next_renewal at which to fire alerts. Default = 7 and 3.
    ALERT_WINDOWS: str = "7,3"

    @property
    def alert_windows(self) -> list[int]:
        return [int(x) for x in self.ALERT_WINDOWS.split(",") if x.strip()]


settings = Settings()
