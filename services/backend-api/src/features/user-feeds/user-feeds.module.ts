import { DynamicModule, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DiscordAuthModule } from "../discord-auth/discord-auth.module";
import { FeedFetcherModule } from "../../services/feed-fetcher/feed-fetcher.module";
import { SupportersModule } from "../supporters/supporters.module";
import { DiscordWebhooksModule } from "../discord-webhooks/discord-webhooks.module";
import { DiscordApiModule } from "../../services/apis/discord/discord-api.module";
import { UserFeedFeature } from "./entities";
import { UserFeedsService } from "./user-feeds.service";
import { FeedsModule } from "../feeds/feeds.module";
import { UserFeedsController } from "./user-feeds.controller";
import { FeedHandlerModule } from "../../services/feed-handler/feed-fetcher.module";
import { MessageBrokerModule } from "../message-broker/message-broker.module";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";

@Module({
  controllers: [UserFeedsController],
  providers: [UserFeedsService],
  imports: [
    DiscordAuthModule,
    MongooseModule.forFeature([UserFeedFeature]),
    FeedFetcherModule,
    SupportersModule,
    DiscordWebhooksModule,
    DiscordApiModule,
    FeedsModule,
    SupportersModule,
    FeedHandlerModule,
  ],
  exports: [UserFeedsService, MongooseModule.forFeature([UserFeedFeature])],
})
export class UserFeedsModule {
  static forRoot(): DynamicModule {
    return {
      module: UserFeedsModule,
      imports: [MessageBrokerModule.forRoot()],
    };
  }

  static forTest(): DynamicModule {
    return {
      module: UserFeedsModule,
      providers: [
        {
          provide: AmqpConnection,
          useValue: {
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            publish: async () => {},
          },
        },
      ],
    };
  }
}
