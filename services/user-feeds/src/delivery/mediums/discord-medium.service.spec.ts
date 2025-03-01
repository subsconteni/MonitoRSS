import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { ArticleFiltersService } from "../../article-filters/article-filters.service";
import { ArticleFormatterService } from "../../article-formatter/article-formatter.service";
import { Article, ArticleDeliveryContentType } from "../../shared";
import {
  ArticleDeliveryState,
  ArticleDeliveryStatus,
  DeliveryDetails,
  TestDiscordDeliveryDetails,
} from "../types";
import { DiscordMediumService } from "./discord-medium.service";

jest.mock("@synzen/discord-rest", () => ({
  RESTProducer: jest.fn(),
}));

const producer = {
  enqueue: jest.fn(),
  fetch: jest.fn(),
};

describe("DiscordMediumService", () => {
  let service: DiscordMediumService;
  const configService = {
    getOrThrow: jest.fn(),
  };
  const articleFormatterService = {
    formatArticleForDiscord: jest.fn(),
    applySplit: jest.fn(),
  };
  const articleFiltersService = {
    buildReferences: jest.fn(),
    getArticleFilterResults: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordMediumService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: ArticleFormatterService,
          useValue: articleFormatterService,
        },
        {
          provide: ArticleFiltersService,
          useValue: articleFiltersService,
        },
      ],
    }).compile();

    service = module.get<DiscordMediumService>(DiscordMediumService);
    service.producer = producer as never;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    articleFormatterService.applySplit.mockImplementation((content) => [
      content,
    ]);
  });

  describe("deliverTestArticle", () => {
    const article = {
      flattened: {
        id: "1",
      },
      raw: {} as never,
    };

    const deliveryDetails: TestDiscordDeliveryDetails = {
      mediumDetails: {
        channel: { id: "channel-1" },
        webhook: {
          id: "webhook-id-1",
          token: "webhook-token-1",
        },
        content: "content",
        formatter: {
          formatTables: false,
          stripImages: false,
        },
        splitOptions: {},
      },
    };

    describe("channel", () => {
      it("should call the producer for the channel", async () => {
        await service.deliverTestArticle(article, {
          ...deliveryDetails,
          mediumDetails: {
            ...deliveryDetails.mediumDetails,
            webhook: null,
          },
        });

        expect(producer.fetch).toHaveBeenCalledWith(
          `${DiscordMediumService.BASE_API_URL}/channels/channel-1/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content: "content",
              embeds: [],
            }),
          }
        );
      });

      it("sends messages with replaced template strings", async () => {
        const article = {
          flattened: {
            id: "1",
            title: "some-title-here",
          },
          raw: {} as never,
        };
        const details: TestDiscordDeliveryDetails = {
          ...deliveryDetails,
          mediumDetails: {
            ...deliveryDetails.mediumDetails,
            content: "content {{title}}",
            webhook: null,
          },
        };
        await service.deliverTestArticle(article, details);

        expect(producer.fetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: JSON.stringify({
              content: "content some-title-here",
              embeds: [],
            }),
          })
        );
      });
    });

    describe("webhook", () => {
      it("prioritizes webhook over channel, calls the producer for the webhook", async () => {
        await service.deliverTestArticle(article, deliveryDetails);

        const webhook1Id = deliveryDetails.mediumDetails.webhook?.id;
        const webhook1Token = deliveryDetails.mediumDetails.webhook?.token;
        deliveryDetails.mediumDetails.webhook?.token;
        expect(producer.fetch).toHaveBeenCalledWith(
          `${DiscordMediumService.BASE_API_URL}/webhooks/${webhook1Id}/${webhook1Token}`,
          {
            method: "POST",
            body: JSON.stringify({
              content: "content",
              embeds: [],
            }),
          }
        );
      });

      it("sends messages with replaced template strings", async () => {
        const article = {
          flattened: {
            id: "1",
            title: "some-title-here",
          },
          raw: {} as never,
        };
        const details: TestDiscordDeliveryDetails = {
          ...deliveryDetails,
          mediumDetails: {
            ...deliveryDetails.mediumDetails,
            content: "content {{title}}",
          },
        };
        await service.deliverTestArticle(article, details);

        expect(producer.fetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: JSON.stringify({
              content: "content some-title-here",
              embeds: [],
            }),
          })
        );
      });
    });
  });

  describe("deliverArticle", () => {
    const article = {
      flattened: {
        id: "1",
      },
      raw: {} as never,
    };

    const deliveryDetails: DeliveryDetails = {
      deliveryId: "delivery-id",
      mediumId: "medium-id",
      deliverySettings: {
        guildId: "guild-id",
        channel: { id: "channel-1" },
        webhook: {
          id: "webhook-id-1",
          token: "webhook-token-1",
        },
        content: "content",
        formatter: {
          formatTables: false,
          stripImages: false,
        },
        splitOptions: {},
      },
      feedDetails: {
        id: "feed-id",
        blockingComparisons: [],
        passingComparisons: [],
        url: "url",
      },
    };

    it("returns the status of the result", async () => {
      const result = await service.deliverArticle(article, deliveryDetails);
      expect(result).toEqual([
        {
          id: deliveryDetails.deliveryId,
          mediumId: deliveryDetails.mediumId,
          status: ArticleDeliveryStatus.PendingDelivery,
          contentType: ArticleDeliveryContentType.DiscordArticleMessage,
        },
      ]);
    });

    it("sends embeds", async () => {
      const detailsWithEmbeds: DeliveryDetails = {
        ...deliveryDetails,
        deliverySettings: {
          ...deliveryDetails.deliverySettings,
          embeds: [
            {
              author: {
                name: "author-name",
                iconUrl: "author-icon-url",
              },
              footer: {
                text: "footer-text",
                iconUrl: "footer-icon-url",
              },
              image: {
                url: "image-url",
              },
              thumbnail: {
                url: "thumbnail-url",
              },
              title: "title",
              description: "description",
              url: "url",
              color: 123,
              fields: [
                {
                  name: "name",
                  value: "value",
                  inline: true,
                },
              ],
            },
          ],
        },
      };

      await service.deliverArticle(article, detailsWithEmbeds);
      const callBody = JSON.parse(producer.enqueue.mock.calls[0][1].body);
      expect(callBody).toMatchObject({
        embeds: [
          {
            author: {
              name: "author-name",
              icon_url: "author-icon-url",
            },
            footer: {
              text: "footer-text",
              icon_url: "footer-icon-url",
            },
            image: {
              url: "image-url",
            },
            thumbnail: {
              url: "thumbnail-url",
            },
            title: "title",
            description: "description",
            url: "url",
            color: 123,
            fields: [
              {
                name: "name",
                value: "value",
                inline: true,
              },
            ],
          },
        ],
      });
    });

    describe("channel", () => {
      it("should call the producer for the channel", async () => {
        await service.deliverArticle(article, {
          ...deliveryDetails,
          deliverySettings: {
            ...deliveryDetails.deliverySettings,
            webhook: null,
          },
        });

        expect(producer.enqueue).toHaveBeenCalledWith(
          `${DiscordMediumService.BASE_API_URL}/channels/channel-1/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content: "content",
              embeds: [],
            }),
          },
          {
            id: deliveryDetails.deliveryId,
            articleID: "1",
            feedURL: deliveryDetails.feedDetails.url,
            channel: "channel-1",
            feedId: deliveryDetails.feedDetails.id,
            guildId: deliveryDetails.deliverySettings.guildId,
            emitDeliveryResult: true,
          }
        );
      });

      it("sends messages with replaced template strings", async () => {
        const article = {
          flattened: {
            id: "1",
            title: "some-title-here",
          },
          raw: {} as never,
        };
        const details: DeliveryDetails = {
          ...deliveryDetails,
          deliverySettings: {
            ...deliveryDetails.deliverySettings,
            content: "content {{title}}",
            webhook: null,
          },
        };
        await service.deliverArticle(article, details);

        expect(producer.enqueue).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: JSON.stringify({
              content: "content some-title-here",
              embeds: [],
            }),
          }),
          expect.anything()
        );
      });
    });

    describe("webhook", () => {
      it("prioritizes webhook over channel, calls the producer for the webhook", async () => {
        await service.deliverArticle(article, deliveryDetails);

        const webhook1Id = deliveryDetails.deliverySettings.webhook?.id;
        const webhook1Token = deliveryDetails.deliverySettings.webhook?.token;
        deliveryDetails.deliverySettings.webhook?.token;
        expect(producer.enqueue).toHaveBeenCalledWith(
          `${DiscordMediumService.BASE_API_URL}/webhooks/${webhook1Id}/${webhook1Token}`,
          {
            method: "POST",
            body: JSON.stringify({
              content: "content",
              embeds: [],
            }),
          },
          {
            id: deliveryDetails.deliveryId,
            articleID: "1",
            feedURL: deliveryDetails.feedDetails.url,
            webhookId: webhook1Id,
            feedId: deliveryDetails.feedDetails.id,
            guildId: deliveryDetails.deliverySettings.guildId,
            emitDeliveryResult: true,
          }
        );
      });

      it("sends messages with replaced template strings", async () => {
        const article = {
          flattened: {
            id: "1",
            title: "some-title-here",
          },
          raw: {} as never,
        };
        const details: DeliveryDetails = {
          ...deliveryDetails,
          deliverySettings: {
            ...deliveryDetails.deliverySettings,
            content: "content {{title}}",
          },
        };
        await service.deliverArticle(article, details);

        expect(producer.enqueue).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: JSON.stringify({
              content: "content some-title-here",
              embeds: [],
            }),
          }),
          expect.anything()
        );
      });

      it("returns the correct result for job response %o", () => {
        return expect(
          service.deliverArticle(article, deliveryDetails)
        ).resolves.toEqual([
          {
            id: deliveryDetails.deliveryId,
            status: ArticleDeliveryStatus.PendingDelivery,
            mediumId: deliveryDetails.mediumId,
            contentType: ArticleDeliveryContentType.DiscordArticleMessage,
          } as ArticleDeliveryState,
        ]);
      });
    });
  });

  describe("getForumTagsToSend", () => {
    it("returns tags without filters", async () => {
      const article = {} as Article;
      const inputTags = [
        {
          id: "1",
          filters: null,
        },
        {
          id: "2",
          filters: null,
        },
      ];

      const res = await service.getForumTagsToSend(article, inputTags);

      expect(res).toEqual(
        expect.arrayContaining(inputTags.map((tag) => tag.id))
      );
    });

    it("does not return tags of filters that do not match the article", async () => {
      const article = {
        raw: {
          title: "some-title",
        },
      } as Article;
      const inputTags = [
        {
          id: "1",
          filters: {},
        },
        {
          id: "2",
          filters: {},
        },
      ];

      articleFiltersService.getArticleFilterResults
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const res = await service.getForumTagsToSend(article, inputTags as never);

      expect(res).not.toEqual(expect.arrayContaining(["1"]));
    });

    it("returns tags of filters that match the article", async () => {
      const article = {
        raw: {
          title: "some-title",
        },
      } as Article;
      const inputTags = [
        {
          id: "1",
          filters: {},
        },
        {
          id: "2",
          filters: {},
        },
      ];

      articleFiltersService.getArticleFilterResults
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const res = await service.getForumTagsToSend(article, inputTags as never);

      expect(res).toEqual(expect.arrayContaining(["1"]));
    });
  });
});
