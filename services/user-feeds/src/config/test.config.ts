import { Environment, EnvironmentVariables, validateConfig } from "./validate";

export function testConfig(): EnvironmentVariables {
  const vals: EnvironmentVariables = {
    NODE_ENV: Environment.Test,
    USER_FEEDS_DATADOG_API_KEY: "test",
    USER_FEEDS_POSTGRES_URI: "postgres://postgres:12345@localhost:5432/test",
    USER_FEEDS_API_KEY: "123456789",
    USER_FEEDS_API_PORT: "3000",
    USER_FEEDS_FEED_REQUESTS_API_URL: "feed-request-service",
    USER_FEEDS_FEED_REQUESTS_API_KEY: "feed-fetcher-api-key",
    USER_FEEDS_POSTGRES_DATABASE: "test",
    USER_FEEDS_DISCORD_CLIENT_ID: "discord-client-id",
    USER_FEEDS_DISCORD_RABBITMQ_URI: "amqp://localhost:5672",
    USER_FEEDS_RABBITMQ_BROKER_URL: "amqp://localhost:5672",
  };

  validateConfig(vals);

  return vals;
}
