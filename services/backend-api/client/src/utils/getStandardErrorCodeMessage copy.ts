import i18n from "./i18n";

const { t } = i18n;

enum ApiErrorCode {
  INTERNAL_ERROR = "INTERNAL_ERROR",
  FEED_INVALID = "FEED_INVALID",
  FEED_PARSE_FAILED = "FEED_PARSE_FAILED",
  FEED_PARSE_TIMEOUT = "FEED_PARSE_TIMEOUT",
  FEED_REQUEST_TIMEOUT = "FEED_REQUEST_TIMEOUT",
  FEED_REQUEST_FAILED = "FEED_REQUEST_FAILED",
  FEED_REQUEST_FORBIDDEN = "FEED_REQUEST_FORBIDDEN",
  FEED_REQUEST_INTERNAL_ERROR = "FEED_REQUEST_INTERNAL_ERROR",
  FEED_REQUEST_TOO_MANY_REQUESTS = "FEED_REQUEST_TOO_MANY_REQUESTS",
  FEED_REQUEST_UNAUTHORIZED = "FEED_REQUEST_UNAUTHORIZED",
  WEBHOOKS_MANAGE_MISSING_PERMISSIONS = "WEBHOOKS_MANAGE_MISSING_PERMISSIONS",
  WEBHOOK_INVALID = "WEBHOOK_INVALID",
  FEED_MISSING_CHANNEL_PERMISSION = "FEED_MISSING_CHANNEL_PERMISSION",
  FEED_MISSING_CHANNEL = "FEED_MISSING_CHANNEL",
  FEED_USER_MISSING_MANAGE_GUILD = "FEED_USER_MISSING_MANAGE_GUILD",
  FEED_LIMIT_REACHED = "FEED_LIMIT_REACHED",
  BANNED_FEED = "BANNED_FEED",
  FEED_NOT_FAILED = "FEED_NOT_FAILED",
  FEED_NOT_FOUND = "FEED_NOT_FOUND",
  FEED_INVALID_FILTER_EXPRESSION = "FEED_INVALID_FILTER_EXPRESSION",
  FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED = "FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED",
  FEED_ARTICLE_NOT_FOUND = "FEED_ARTICLE_NOT_FOUND",
  DISCORD_SERVER_NOT_FOUND = "DISCORD_SERVER_NOT_FOUND",
  DISCORD_CAHNNEL_INVALID = "DISCORD_CAHNNEL_INVALID",
}

const ERROR_CODE_MESSAGES: Record<ApiErrorCode, string> = {
  FEED_INVALID: t("common.apiErrors.feedInvalid"),
  FEED_PARSE_FAILED: t("common.apiErrors.feedParseFailed"),
  FEED_PARSE_TIMEOUT: t("common.apiErrors.feedParseTimeout"),
  FEED_REQUEST_TIMEOUT: t("common.apiErrors.feedRequestTimeout"),
  FEED_REQUEST_FAILED: t("common.apiErrors.feedRequestFailed"),
  FEED_REQUEST_FORBIDDEN: t("common.apiErrors.feedRequestForbidden"),
  FEED_REQUEST_INTERNAL_ERROR: t("common.apiErrors.feedRequestInternalError"),
  FEED_REQUEST_TOO_MANY_REQUESTS: t("common.apiErrors.feedRequestTooManyRequests"),
  FEED_REQUEST_UNAUTHORIZED: t("common.apiErrors.feedRequestUnauthorized"),
  WEBHOOKS_MANAGE_MISSING_PERMISSIONS: t("common.apiErrors.webhooksManageMissingPermissions"),
  WEBHOOK_INVALID: t("common.apiErrors.webhookInvalid"),
  BANNED_FEED: t("common.apiErrors.bannedFeed"),
  FEED_MISSING_CHANNEL_PERMISSION: t("common.apiErrors.feedMissingChannelPermission"),
  FEED_LIMIT_REACHED: t("common.apiErrors.feedLimitReached"),
  FEED_MISSING_CHANNEL: t("common.apiErrors.feedMissingChannel"),
  FEED_USER_MISSING_MANAGE_GUILD: t("common.apiErrors.feedUserMissingManageGuild"),
  INTERNAL_ERROR: t("common.errors.somethingWentWrong"),
  FEED_NOT_FAILED: t("common.apiErrors.feedNotFailed"),
  FEED_NOT_FOUND: t("common.apiErrors.feedNotFound"),
  FEED_INVALID_FILTER_EXPRESSION: t("common.apiErrors.feedFilterInvalidExpression"),
  FEED_CONNECTION_CANNOT_ENABLE_AUTO_DISABLED: t(
    "common.apiErrors.feedConnectionCannotEnableAutoDisabled"
  ),
  FEED_ARTICLE_NOT_FOUND: t("common.apiErrors.feedArticleNotFound"),
  DISCORD_SERVER_NOT_FOUND: t("common.apiErrors.discordServerNotFound"),
  DISCORD_CAHNNEL_INVALID: t("common.apiErrors.discordChannelInvalid"),
};

export const getStandardErrorCodeMessage = (code: ApiErrorCode) => {
  const mappedError = ERROR_CODE_MESSAGES[code];

  if (!mappedError) {
    return t("common.errors.somethingWentWrong");
  }

  return mappedError;
};
