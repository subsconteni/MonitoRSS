import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import dayjs from "dayjs";
import { Types } from "mongoose";
import { DiscordAPIService } from "../../services/apis/discord/discord-api.service";
import {
  DiscordServerProfile,
  DiscordServerProfileModel,
} from "../discord-servers/entities";
import {
  FailRecord,
  FailRecordModel,
} from "../feeds/entities/fail-record.entity";
import { DiscordChannelConnection } from "../feeds/entities/feed-connections";
import {
  FeedFilteredFormat,
  FeedFilteredFormatModel,
} from "../feeds/entities/feed-filtered-format.entity";
import {
  FeedSubscriber,
  FeedSubscriberModel,
} from "../feeds/entities/feed-subscriber.entity";
import { Feed, FeedModel } from "../feeds/entities/feed.entity";
import { UserFeed } from "../user-feeds/entities";
import { UserFeedHealthStatus } from "../user-feeds/types";

enum ExpressionType {
  Relational = "RELATIONAL",
  Logical = "LOGICAL",
}

enum LogicalExpressionOperator {
  And = "AND",
  Or = "OR",
  Not = "NOT",
}

enum RelationalExpressionOperator {
  Eq = "EQ",
  Contains = "CONTAINS",
  Matches = "MATCHES",
  NotEq = "NOT_EQ",
  NotContain = "NOT_CONTAIN",
}

enum RelationalExpressionLeft {
  Article = "ARTICLE",
}

enum RelationalExpressionRight {
  String = "STRING",
  RegExp = "REGEXP",
}

@Injectable()
export class LegacyFeedConversionService {
  constructor(
    @InjectModel(DiscordServerProfile.name)
    private readonly profileModel: DiscordServerProfileModel,
    @InjectModel(Feed.name)
    private readonly feedModel: FeedModel,
    @InjectModel(FeedSubscriber.name)
    private readonly feedSubscriberModel: FeedSubscriberModel,
    @InjectModel(FeedFilteredFormat.name)
    private readonly feedFilteredFormatModel: FeedFilteredFormatModel,
    @InjectModel(FailRecord.name)
    private readonly failRecordModel: FailRecordModel,
    private readonly discordApiService: DiscordAPIService
  ) {}

  async getUserFeedEquivalent(
    feed: Feed,
    data: {
      discordUserId: string;
    }
  ) {
    const guildId = feed.guild;
    const [profile, subscribers, filteredFormats, failRecord] =
      await Promise.all([
        this.profileModel.findById(guildId),
        this.feedSubscriberModel.find({
          feed: feed._id,
        }),
        this.feedFilteredFormatModel.find({
          feed: feed._id,
        }),
        this.failRecordModel.findOne({
          _id: feed.url,
        }),
      ]);

    const convertedFilters = feed.rfilters
      ? this.convertRegexFilters(feed.rfilters)
      : this.convertRegularFilters(feed.filters);
    const convertedEmbeds = this.convertEmbeds(feed.embeds);

    const converted: UserFeed = {
      _id: new Types.ObjectId(),
      legacyFeedId: feed._id,
      connections: {
        discordChannels: [],
        discordWebhooks: [],
      },
      createdAt: feed.createdAt || new Date(),
      updatedAt: feed.updatedAt || new Date(),
      healthStatus: this.getHealthStatus(failRecord),
      title: feed.title,
      url: feed.url,
      user: {
        discordUserId: data.discordUserId,
      },
      blockingComparisons: feed.ncomparisons,
      passingComparisons: feed.pcomparisons,
      formatOptions: {
        dateFormat: (profile ? profile.dateFormat : undefined) || undefined,
        dateTimezone: (profile ? profile.timezone : undefined) || undefined,
      },
    };

    if (!feed.webhook) {
      converted.connections.discordChannels.push({
        createdAt: feed.createdAt || new Date(),
        updatedAt: feed.updatedAt || new Date(),
        id: new Types.ObjectId(),
        name: feed.title,
        splitOptions: {
          isEnabled: feed.split?.enabled || false,
        },
        details: {
          channel: {
            id: feed.channel,
            guildId,
          },
          content: this.convertPlaceholders(feed.text),
          embeds: convertedEmbeds,
          formatter: {
            formatTables: feed.formatTables,
            stripImages: feed.imgLinksExistence,
          },
        },
        filters: convertedFilters,
      });
    } else {
      const webhook = await this.discordApiService.getWebhook(feed.webhook.id);

      converted.connections.discordWebhooks.push({
        createdAt: feed.createdAt || new Date(),
        updatedAt: feed.updatedAt || new Date(),
        id: new Types.ObjectId(),
        name: feed.title,
        splitOptions: {
          isEnabled: feed.split?.enabled || false,
        },
        details: {
          webhook: {
            id: feed.webhook.id,
            guildId,
            name: this.convertPlaceholders(feed.webhook.name),
            iconUrl: this.convertPlaceholders(feed.webhook.avatar),
            token: webhook.token,
          },
          content: this.convertPlaceholders(feed.text),
          embeds: convertedEmbeds,
          formatter: {
            formatTables: feed.formatTables,
            stripImages: feed.imgLinksExistence,
          },
        },
        filters: convertedFilters,
      });
    }

    return converted;
  }

  getHealthStatus(failRecord?: FailRecord | null) {
    const feedFailedMoreThanThreeDaysAgo = failRecord?.failedAt
      ? dayjs(failRecord.failedAt).isBefore(dayjs().subtract(3, "day"))
      : false;

    const feedIsCurrentlyFailing = failRecord?.failedAt
      ? dayjs(failRecord.failedAt).isAfter(dayjs().subtract(3, "day"))
      : false;

    if (feedIsCurrentlyFailing) {
      return UserFeedHealthStatus.Failing;
    }

    if (feedFailedMoreThanThreeDaysAgo) {
      return UserFeedHealthStatus.Failed;
    }

    return UserFeedHealthStatus.Ok;
  }

  convertPlaceholders<T extends string | undefined>(text: T): T {
    if (!text) {
      return undefined as T;
    }

    const regex = /\{([^\{\}]*)\}/g;

    return text.replace(regex, "{{$1}}") as T;
  }

  convertEmbeds(
    embeds: Feed["embeds"]
  ): DiscordChannelConnection["details"]["embeds"] {
    if (!embeds || embeds.length === 0) {
      return [];
    }

    return embeds.map((embed) => {
      return {
        title: this.convertPlaceholders(embed.title),
        authorIconURL: this.convertPlaceholders(embed.authorIconURL),
        authorName: this.convertPlaceholders(embed.authorName),
        authorURL: this.convertPlaceholders(embed.authorURL),
        color: this.convertPlaceholders(embed.color),
        description: this.convertPlaceholders(embed.description),
        footerIconURL: this.convertPlaceholders(embed.footerIconURL),
        footerText: this.convertPlaceholders(embed.footerText),
        imageURL: this.convertPlaceholders(embed.imageURL),
        thumbnailURL: this.convertPlaceholders(embed.thumbnailURL),
        timestamp: this.convertPlaceholders(embed.timestamp),
        url: this.convertPlaceholders(embed.url),
        fields: embed.fields?.map((field) => {
          return {
            name: this.convertPlaceholders(field.name) as string,
            value: this.convertPlaceholders(field.value) as string,
            inline: field.inline,
          };
        }),
      };
    });
  }

  convertRegexFilters(filters: Feed["rfilters"]) {
    if (!filters || Object.keys(filters).length === 0) {
      return;
    }

    const orExpression: Record<string, any> = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.Or,
      children: [],
    };

    Object.entries(filters).forEach(([category, filterVal]) => {
      const cleanedCategory = category.replace("raw:", "");

      orExpression.children.push({
        type: ExpressionType.Relational,
        op: RelationalExpressionOperator.Contains,
        left: {
          type: RelationalExpressionLeft.Article,
          value: cleanedCategory,
        },
        right: {
          type: RelationalExpressionRight.RegExp,
          value: filterVal,
        },
      });
    });

    return {
      expression: orExpression,
    };
  }

  convertRegularFilters(filters: Feed["filters"]) {
    if (!filters || Object.keys(filters).length === 0) {
      return;
    }

    const orExpression: Record<string, any> = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.Or,
      children: [],
    };

    const expression: Record<string, any> = {
      type: ExpressionType.Logical,
      op: LogicalExpressionOperator.And,
      children: [orExpression],
    };

    Object.entries(filters).forEach(([category, filterVals]) => {
      for (let i = 0; i < filterVals.length; ++i) {
        const filterVal = filterVals[i];

        const isBroad = filterVal.startsWith("~");
        const isBlocking = filterVal.startsWith("!");
        const isBlockingBroad =
          filterVal.startsWith("!~") || filterVal.startsWith("~!");

        const cleanedCategory = category.replace("raw:", "");

        if (isBlockingBroad) {
          expression.children.push({
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.NotContain,
            left: {
              type: RelationalExpressionLeft.Article,
              value: cleanedCategory,
            },
            right: {
              type: RelationalExpressionRight.String,
              value: filterVal.slice(2),
            },
          });
        } else if (isBlocking) {
          expression.children.push({
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.NotEq,
            left: {
              type: RelationalExpressionLeft.Article,
              value: cleanedCategory,
            },
            right: {
              type: RelationalExpressionRight.String,
              value: filterVal.slice(1),
            },
          });
        } else if (isBroad) {
          orExpression.children.push({
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Contains,
            left: {
              type: RelationalExpressionLeft.Article,
              value: cleanedCategory,
            },
            right: {
              type: RelationalExpressionRight.String,
              value: filterVal.slice(1),
            },
          });
        } else {
          orExpression.children.push({
            type: ExpressionType.Relational,
            op: RelationalExpressionOperator.Eq,
            left: {
              type: RelationalExpressionLeft.Article,
              value: cleanedCategory,
            },
            right: {
              type: RelationalExpressionRight.String,
              value: filterVal,
            },
          });
        }
      }
    });

    return { expression };
  }
}
