const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const sum = (...values) => values.every(value => value !== null) ? count(values.reduce((a, b) => a + b, 0)) : null;
export function tokenUsage(provider, payload, legacyOpenAI = false) {
  const usage = provider === "gemini" ? payload?.usageMetadata : payload?.usage;
  if (!usage || typeof usage !== "object") return null;
  let input, output, total, cached, written, reasoning;
  if (provider === "openai") {
    input = count(legacyOpenAI ? usage.prompt_tokens : usage.input_tokens);
    output = count(legacyOpenAI ? usage.completion_tokens : usage.output_tokens);
    const inputDetails = legacyOpenAI ? usage.prompt_tokens_details : usage.input_tokens_details;
    const outputDetails = legacyOpenAI ? usage.completion_tokens_details : usage.output_tokens_details;
    cached = count(inputDetails?.cached_tokens); written = count(inputDetails?.cache_write_tokens); reasoning = count(outputDetails?.reasoning_tokens);
    total = usage.total_tokens === undefined ? sum(input, output) : count(usage.total_tokens);
  } else if (provider === "claude") {
    cached = count(usage.cache_read_input_tokens ?? 0); written = count(usage.cache_creation_input_tokens ?? 0);
    input = sum(count(usage.input_tokens), cached, written); output = count(usage.output_tokens);
    total = sum(input, output); reasoning = null;
  } else if (provider === "gemini") {
    input = count(usage.promptTokenCount); total = count(usage.totalTokenCount);
    reasoning = count(usage.thoughtsTokenCount); cached = count(usage.cachedContentTokenCount); written = null;
    output = total !== null && input !== null && total >= input ? total - input : sum(count(usage.candidatesTokenCount), reasoning);
    if (usage.totalTokenCount === undefined) total = sum(input, output);
  } else return null;
  if (input === null || output === null || total === null) return null;
  if (total < input + output || (cached !== null && written !== null && cached + written > input) || (cached !== null && cached > input) || (written !== null && written > input) || (reasoning !== null && reasoning > output)) return null;
  return { inputTokens: input, outputTokens: output, totalTokens: total, cachedInputTokens: cached, cacheWriteTokens: written, reasoningTokens: reasoning };
}
