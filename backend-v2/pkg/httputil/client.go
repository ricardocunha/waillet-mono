package httputil

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	httpClient *http.Client
	baseURL    string
	headers    map[string]string
}

type ClientOption func(*Client)

func NewClient(opts ...ClientOption) *Client {
	c := &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		headers: make(map[string]string),
	}

	for _, opt := range opts {
		opt(c)
	}

	return c
}

func WithTimeout(timeout time.Duration) ClientOption {
	return func(c *Client) {
		c.httpClient.Timeout = timeout
	}
}

func WithBaseURL(url string) ClientOption {
	return func(c *Client) {
		c.baseURL = url
	}
}

func WithHeader(key, value string) ClientOption {
	return func(c *Client) {
		c.headers[key] = value
	}
}

func (c *Client) Do(ctx context.Context, method, url string, body interface{}, result interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	fullURL := url
	if c.baseURL != "" {
		fullURL = c.baseURL + url
	}

	req, err := http.NewRequestWithContext(ctx, method, fullURL, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	if result != nil {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("failed to unmarshal response: %w", err)
		}
	}

	return nil
}

func (c *Client) Get(ctx context.Context, url string, result interface{}) error {
	return c.Do(ctx, http.MethodGet, url, nil, result)
}

func (c *Client) Post(ctx context.Context, url string, body interface{}, result interface{}) error {
	return c.Do(ctx, http.MethodPost, url, body, result)
}

func (c *Client) Put(ctx context.Context, url string, body interface{}, result interface{}) error {
	return c.Do(ctx, http.MethodPut, url, body, result)
}

func (c *Client) Delete(ctx context.Context, url string, result interface{}) error {
	return c.Do(ctx, http.MethodDelete, url, nil, result)
}
