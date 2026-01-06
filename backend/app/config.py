from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://waillet_user:waillet_pass@localhost:3306/waillet"
    OPENAI_API_KEY: str = ""
    ALCHEMY_API_KEY: str = ""
    INFURA_API_KEY: str = ""
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    CORS_ORIGINS: str = '["*"]'

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            origins = json.loads(self.CORS_ORIGINS)
            if "*" in origins:
                return ["*"]
            return origins
        except:
            return ["*"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

