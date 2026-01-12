from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import favorites, policies, ai, rpc, simulation

app = FastAPI(
    title="wAIllet Backend API",
    description="AI-powered wallet backend with favorites and security policies",
    version="0.1.0",
    debug=settings.DEBUG
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(favorites.router, prefix="/api")
app.include_router(policies.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(rpc.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")


@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "wAIllet Backend API",
        "version": "0.1.0"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "api": "ready"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )

