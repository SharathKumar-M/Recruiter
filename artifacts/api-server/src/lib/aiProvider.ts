import { logger } from "./logger";

export type AIProviderName = "gemini" | "openai";

export interface AIProviderConfig {
  provider: AIProviderName;
  model: string;
  fallbackModel?: string;
  apiKey: string;
  baseURL?: string;
}

export class AIProviderError extends Error {
  statusCode: number;
  provider: AIProviderName;
  model: string;
  isTransient: boolean;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    options: {
      statusCode: number;
      provider: AIProviderName;
      model: string;
      isTransient?: boolean;
      retryAfterSeconds?: number;
    }
  ) {
    super(message);
    this.name = "AIProviderError";
    this.statusCode = options.statusCode;
    this.provider = options.provider;
    this.model = options.model;
    this.isTransient = options.isTransient ?? (options.statusCode === 503 || options.statusCode === 429);
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function getAIProviderConfig(): AIProviderConfig {
  const explicitProvider = (process.env.AI_PROVIDER || "").toLowerCase().trim();
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const geminiFallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash";
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const openaiBase = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
  const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (explicitProvider === "gemini") {
    if (!geminiKey) {
      throw new AIProviderError("AI_PROVIDER is set to 'gemini' but GEMINI_API_KEY is not configured in server environment.", {
        statusCode: 401,
        provider: "gemini",
        model: geminiModel,
        isTransient: false,
      });
    }
    return {
      provider: "gemini",
      model: geminiModel,
      fallbackModel: geminiFallbackModel,
      apiKey: geminiKey,
    };
  }

  if (explicitProvider === "openai") {
    if (!openaiKey) {
      throw new AIProviderError("AI_PROVIDER is set to 'openai' but OPENAI_API_KEY is not configured in server environment.", {
        statusCode: 401,
        provider: "openai",
        model: openaiModel,
        isTransient: false,
      });
    }
    return { provider: "openai", model: openaiModel, apiKey: openaiKey, baseURL: openaiBase };
  }

  // Auto-detection: prefer Gemini if key available, else OpenAI
  if (geminiKey) {
    return {
      provider: "gemini",
      model: geminiModel,
      fallbackModel: geminiFallbackModel,
      apiKey: geminiKey,
    };
  }

  if (openaiKey) {
    return { provider: "openai", model: openaiModel, apiKey: openaiKey, baseURL: openaiBase };
  }

  throw new AIProviderError("No AI provider API key configured. Please set GEMINI_API_KEY in server environment.", {
    statusCode: 401,
    provider: "gemini",
    model: geminiModel,
    isTransient: false,
  });
}

export interface AICompletionOptions<T> {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  validate?: (parsed: any) => T;
}

export interface AICompletionResponse<T> {
  data: T;
  provider: AIProviderName;
  model: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(headerValue?: string | null): number | undefined {
  if (!headerValue) return undefined;
  const seconds = parseInt(headerValue, 10);
  if (!isNaN(seconds) && seconds > 0) return seconds;
  const date = Date.parse(headerValue);
  if (!isNaN(date)) {
    const diffSeconds = Math.ceil((date - Date.now()) / 1000);
    return diffSeconds > 0 ? diffSeconds : undefined;
  }
  return undefined;
}

function calculateBackoffDelay(attempt: number, retryAfterSeconds?: number): number {
  if (typeof retryAfterSeconds === "number" && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 8000);
  }
  // Exponential backoff: attempt 0 -> 1s, attempt 1 -> 2s, attempt 2 -> 4s + jitter
  const base = 1000 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 400) + 100;
  return Math.min(base + jitter, 8000);
}

/**
 * Execute a single Gemini API request
 */
async function executeGeminiSingleAttempt<T>(
  model: string,
  apiKey: string,
  options: AICompletionOptions<T>
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const promptText = `${options.systemPrompt}\n\nIMPORTANT INSTRUCTIONS:\nYou must respond with valid JSON ONLY. Do not wrap in markdown or backticks.\n\n${options.userPrompt}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.3,
          maxOutputTokens: options.maxTokens ?? 3500,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      let errMsg = `Gemini API returned HTTP ${res.status}`;
      try {
        const errJson = (await res.json()) as any;
        if (errJson?.error?.message) {
          errMsg += `: ${errJson.error.message}`;
        }
      } catch {
        // ignore json parse error
      }

      const retryAfter = parseRetryAfter(res.headers.get("retry-after"));
      const isTransient = res.status === 503 || res.status === 429;

      throw new AIProviderError(errMsg, {
        statusCode: res.status,
        provider: "gemini",
        model,
        isTransient,
        retryAfterSeconds: retryAfter,
      });
    }

    const json = (await res.json()) as any;
    const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText || typeof rawText !== "string") {
      throw new AIProviderError("Gemini returned empty or malformed candidate content.", {
        statusCode: 502,
        provider: "gemini",
        model,
        isTransient: true,
      });
    }

    return parseAndValidateJson(rawText, options.validate);
  } catch (err: any) {
    clearTimeout(timeout);
    if (err instanceof AIProviderError) {
      throw err;
    }
    if (err.name === "AbortError") {
      throw new AIProviderError(`Gemini request timed out after ${timeoutMs / 1000} seconds.`, {
        statusCode: 504,
        provider: "gemini",
        model,
        isTransient: true,
      });
    }
    // Network errors (e.g. ECONNRESET, ENOTFOUND) are transient
    throw new AIProviderError(`Network error communicating with Gemini API: ${err.message || String(err)}`, {
      statusCode: 503,
      provider: "gemini",
      model,
      isTransient: true,
    });
  }
}

/**
 * Execute Gemini API with transient retry and automatic model fallback
 */
async function callGeminiAPI<T>(
  config: AIProviderConfig,
  options: AICompletionOptions<T>
): Promise<{ data: T; model: string }> {
  const maxPrimaryAttempts = 3;
  let lastError: AIProviderError | null = null;

  // 1. Try primary model up to 3 times for transient errors (503 / 429)
  for (let attempt = 0; attempt < maxPrimaryAttempts; attempt++) {
    try {
      const data = await executeGeminiSingleAttempt<T>(config.model, config.apiKey, options);
      return { data, model: config.model };
    } catch (err: any) {
      const providerError: AIProviderError =
        err instanceof AIProviderError
          ? err
          : new AIProviderError(err.message, {
              statusCode: 500,
              provider: "gemini",
              model: config.model,
            });

      lastError = providerError;

      // Do NOT retry non-transient errors (400 Bad Request, 401 Unauthorized, 403 Forbidden, etc.)
      // Note: If 404 (model not found), break early to fallback model without repeating invalid model
      if (providerError.statusCode === 404) {
        logger.warn({ model: config.model }, "Primary Gemini model returned 404 Not Found; will attempt fallback");
        break;
      }

      if (!providerError.isTransient) {
        logger.error(
          { model: config.model, statusCode: providerError.statusCode, error: providerError.message },
          "Gemini non-transient error; aborting retry"
        );
        throw providerError;
      }

      // If this was not the last attempt, wait with backoff + jitter
      if (attempt < maxPrimaryAttempts - 1) {
        const waitMs = calculateBackoffDelay(attempt, providerError.retryAfterSeconds);
        logger.warn(
          { model: config.model, attempt: attempt + 1, waitMs, statusCode: providerError.statusCode },
          "Gemini transient error (e.g. 503); scheduling retry with exponential backoff"
        );
        await delay(waitMs);
      }
    }
  }

  // 2. If primary model failed with 503/404/transient error, attempt fallback model
  const fallbackModel = config.fallbackModel;
  if (fallbackModel && fallbackModel !== config.model) {
    logger.warn(
      { primaryModel: config.model, fallbackModel, primaryError: lastError?.message },
      "Primary Gemini model unavailable; attempting fallback model"
    );

    const maxFallbackAttempts = 2;
    for (let fbAttempt = 0; fbAttempt < maxFallbackAttempts; fbAttempt++) {
      try {
        const data = await executeGeminiSingleAttempt<T>(fallbackModel, config.apiKey, options);
        logger.info({ fallbackModel }, "Fallback Gemini model succeeded");
        return { data, model: fallbackModel };
      } catch (fbErr: any) {
        const providerError: AIProviderError =
          fbErr instanceof AIProviderError
            ? fbErr
            : new AIProviderError(fbErr.message, {
                statusCode: 500,
                provider: "gemini",
                model: fallbackModel,
              });

        lastError = providerError;

        if (!providerError.isTransient) {
          throw providerError;
        }

        if (fbAttempt < maxFallbackAttempts - 1) {
          const waitMs = calculateBackoffDelay(fbAttempt, providerError.retryAfterSeconds);
          await delay(waitMs);
        }
      }
    }
  }

  // If both primary and fallback failed, throw the last error
  const finalError =
    lastError ||
    new AIProviderError("Gemini service unavailable after retries", {
      statusCode: 503,
      provider: "gemini",
      model: config.model,
      isTransient: true,
    });

  throw finalError;
}

/**
 * Execute OpenAI API call with safety and timeout
 */
async function callOpenAIAPI<T>(
  config: AIProviderConfig,
  options: AICompletionOptions<T>
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = 35000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const endpoint = `${(config.baseURL || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: `${options.systemPrompt}\nRespond in valid JSON only.` },
          { role: "user", content: options.userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 3500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      let errMsg = `OpenAI API returned HTTP ${res.status}`;
      try {
        const errJson = (await res.json()) as any;
        if (errJson?.error?.message) {
          errMsg += `: ${errJson.error.message}`;
        }
      } catch {
        // ignore
      }
      throw new AIProviderError(errMsg, {
        statusCode: res.status,
        provider: "openai",
        model: config.model,
        isTransient: res.status === 503 || res.status === 429,
      });
    }

    const json = (await res.json()) as any;
    const rawText = json?.choices?.[0]?.message?.content;

    if (!rawText || typeof rawText !== "string") {
      throw new AIProviderError("OpenAI returned empty message content.", {
        statusCode: 502,
        provider: "openai",
        model: config.model,
        isTransient: true,
      });
    }

    return parseAndValidateJson(rawText, options.validate);
  } catch (err: any) {
    clearTimeout(timeout);
    if (err instanceof AIProviderError) {
      throw err;
    }
    if (err.name === "AbortError") {
      throw new AIProviderError(`OpenAI request timed out after ${timeoutMs / 1000} seconds.`, {
        statusCode: 504,
        provider: "openai",
        model: config.model,
        isTransient: true,
      });
    }
    throw err;
  }
}

/**
 * Parse JSON safely and validate output
 */
function parseAndValidateJson<T>(rawText: string, validate?: (parsed: any) => T): T {
  let cleaned = rawText.trim();

  // Strip markdown code fence if model included it
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\r?\n/, "").replace(/\r?\n```$/, "").trim();
  }

  // Regex extract JSON if extraneous commentary exists
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (parseErr: any) {
    logger.error({ preview: cleaned.slice(0, 200) }, "Failed to parse AI JSON response");
    throw new AIProviderError(`Failed to parse AI model response as JSON: ${parseErr.message}`, {
      statusCode: 502,
      provider: "gemini",
      model: "json-parser",
      isTransient: true,
    });
  }

  if (validate) {
    return validate(parsed);
  }

  return parsed as T;
}

/**
 * Universal structured AI generation entry point
 */
export async function generateStructuredAICompletion<T>(
  options: AICompletionOptions<T>
): Promise<AICompletionResponse<T>> {
  const config = getAIProviderConfig();

  logger.info({ provider: config.provider, model: config.model }, "Invoking AI Provider");

  try {
    let data: T;
    let effectiveModel = config.model;

    if (config.provider === "gemini") {
      const result = await callGeminiAPI<T>(config, options);
      data = result.data;
      effectiveModel = result.model;
    } else {
      data = await callOpenAIAPI<T>(config, options);
    }

    return {
      data,
      provider: config.provider,
      model: effectiveModel,
    };
  } catch (err: any) {
    // Sanitize error message to prevent leaking any API key substrings
    let safeMessage = err.message || "AI completion failed";
    if (config.apiKey) {
      safeMessage = safeMessage.replace(new RegExp(config.apiKey, "g"), "[REDACTED_API_KEY]");
    }
    logger.error({ provider: config.provider, model: config.model, error: safeMessage }, "AI Generation Failed");

    if (err instanceof AIProviderError) {
      err.message = safeMessage;
      throw err;
    }

    throw new AIProviderError(safeMessage, {
      statusCode: err.statusCode || 500,
      provider: config.provider,
      model: config.model,
      isTransient: err.statusCode === 503 || err.statusCode === 429,
    });
  }
}
