package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/waillet-app/backend-v2/internal/config"
)

func CORSMiddleware(cfg *config.CORSConfig) func(http.Handler) http.Handler {
	return cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   cfg.AllowedMethods,
		AllowedHeaders:   cfg.AllowedHeaders,
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false, // Must be false when using AllowedOrigins: ["*"]
		MaxAge:           300,
		// Allow all origins including moz-extension:// and chrome-extension://
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			return true
		},
	})
}

func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		defer func() {
			latency := time.Since(start)

			var logEvent *zerolog.Event
			status := ww.Status()
			if status >= 500 {
				logEvent = log.Error()
			} else if status >= 400 {
				logEvent = log.Warn()
			} else {
				logEvent = log.Info()
			}

			logEvent.
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Int("status", status).
				Dur("latency", latency).
				Int("bytes", ww.BytesWritten()).
				Str("remote_addr", r.RemoteAddr).
				Msg("request")
		}()

		next.ServeHTTP(ww, r)
	})
}

func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Error().
					Interface("error", err).
					Str("path", r.URL.Path).
					Msg("panic recovered")

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(`{"error":"internal server error"}`))
			}
		}()

		next.ServeHTTP(w, r)
	})
}

func RequestIDMiddleware(next http.Handler) http.Handler {
	return middleware.RequestID(next)
}
