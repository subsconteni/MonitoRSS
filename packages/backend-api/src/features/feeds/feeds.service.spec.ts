import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { createTestFeed } from '../../test/data/feeds.test-data';
import {
  setupIntegrationTests,
  teardownIntegrationTests,
} from '../../utils/integration-tests';
import { MongooseTestModule } from '../../utils/mongoose-test.module';
import { Feed, FeedFeature, FeedModel } from './entities/feed.entity';
import { FeedsService } from './feeds.service';
import { Types } from 'mongoose';
import {
  FailRecord,
  FailRecordFeature,
  FailRecordModel,
} from './entities/fail-record.entity';
import { createTestFailRecord } from '../../test/data/failrecords.test-data';
import { FeedStatus } from './types/FeedStatus.type';
import { FeedSchedulingService } from './feed-scheduling.service';
import { FeedScheduleFeature } from './entities/feed-schedule.entity';
import { ConfigService } from '@nestjs/config';
import { DiscordAPIService } from '../../services/apis/discord/discord-api.service';
import {
  FeedSubscriber,
  FeedSubscriberFeature,
  FeedSubscriberModel,
} from './entities/feed-subscriber.entity';
import { createTestFeedSubscriber } from '../../test/data/subscriber.test-data';
import { CloneFeedInputProperties } from './dto/CloneFeedInput.dto';

describe('FeedsService', () => {
  let service: FeedsService;
  let feedModel: FeedModel;
  let failRecordModel: FailRecordModel;
  let feedSubscriberModel: FeedSubscriberModel;
  const feedSchedulingService: FeedSchedulingService = {
    getRefreshRatesOfFeeds: jest.fn(),
  } as never;

  beforeAll(async () => {
    const { uncompiledModule, init } = await setupIntegrationTests({
      providers: [
        FeedsService,
        FeedSchedulingService,
        ConfigService,
        DiscordAPIService,
      ],
      imports: [
        MongooseTestModule.forRoot(),
        MongooseModule.forFeature([
          FeedFeature,
          FailRecordFeature,
          FeedScheduleFeature,
          FeedSubscriberFeature,
        ]),
      ],
    });

    uncompiledModule
      .overrideProvider(FeedSchedulingService)
      .useValue(feedSchedulingService)
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn(),
      })
      .overrideProvider(DiscordAPIService)
      .useValue({ executeBotRequest: jest.fn() });

    const { module } = await init();

    service = module.get<FeedsService>(FeedsService);
    feedModel = module.get<FeedModel>(getModelToken(Feed.name));
    failRecordModel = module.get<FailRecordModel>(
      getModelToken(FailRecord.name),
    );
    feedSubscriberModel = module.get<FeedSubscriberModel>(
      getModelToken(FeedSubscriber.name),
    );
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .spyOn(feedSchedulingService, 'getRefreshRatesOfFeeds')
      .mockResolvedValue(new Array(500).fill(15));
  });

  afterEach(async () => {
    await feedModel.deleteMany({});
    await failRecordModel.deleteMany({});
  });

  afterAll(async () => {
    await teardownIntegrationTests();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getFeed', () => {
    it('returns null if no feed is found', async () => {
      const result = await service.getFeed('5e6b5f0f7b1c8a1f7b3a0a1b');

      expect(result).toBeNull();
    });

    it('returns the feed if it is found', async () => {
      const createdFeed = await feedModel.create(createTestFeed());

      const result = await service.getFeed(createdFeed._id.toString());

      expect(result).toEqual(
        expect.objectContaining({
          _id: createdFeed._id,
          refreshRateSeconds: expect.any(Number),
        }),
      );
    });
  });

  describe('getServerFeeds', () => {
    it('returns the sorted feeds, respecting limit and offset', async () => {
      const guild = 'server-1';
      const feedsToInsert = await Promise.all([
        createTestFeed({
          addedAt: new Date(2020),
          title: '2020',
          guild,
        }),
        createTestFeed({
          addedAt: new Date(2019),
          title: '2019',
          guild,
        }),
        createTestFeed({
          addedAt: new Date(2022),
          title: '2022',
          guild,
        }),
        createTestFeed({
          addedAt: new Date(2021),
          title: '2021',
          guild,
        }),
      ]);

      await feedModel.insertMany(feedsToInsert);

      const found = await service.getServerFeeds(guild, {
        limit: 2,
        offset: 1,
      });

      const foundTitles = found.map((feed) => feed.title);

      expect(foundTitles).toEqual(['2021', '2020']);
    });
  });

  describe('countServerFeeds', () => {
    it('returns the correct count', async () => {
      const guild = 'server-1';
      const feedsToInsert = await Promise.all([
        createTestFeed({
          title: '2020',
          guild,
        }),
        createTestFeed({
          title: '2019',
          guild,
        }),
      ]);

      await feedModel.insertMany(feedsToInsert);

      const count = await service.countServerFeeds(guild);

      expect(count).toEqual(2);
    });

    it('works with search', async () => {
      const guild = 'server-1';
      const feedsToInsert = await Promise.all([
        createTestFeed({
          title: 'google',
          guild,
        }),
        createTestFeed({
          title: 'yahoo',
          guild,
        }),
        createTestFeed({
          url: 'google.com',
          guild,
        }),
        createTestFeed({
          title: 'bing',
          guild,
        }),
      ]);

      await feedModel.insertMany(feedsToInsert);

      const count = await service.countServerFeeds(guild, {
        search: 'goo',
      });

      expect(count).toEqual(2);
    });
  });

  describe('updateOne', () => {
    describe('ncomparisons', () => {
      it('updates', async () => {
        const feed = await feedModel.create(
          createTestFeed({
            ncomparisons: ['description'],
          }),
        );
        const toUpdate = {
          ncomparisons: ['title'],
        };
        await service.updateOne(feed._id.toString(), toUpdate);

        const foundFeed = await feedModel.findById(feed._id);

        expect(foundFeed?.ncomparisons).toEqual(['title']);
      });

      it('does not update if it is undefined', async () => {
        const feed = await await feedModel.create(
          createTestFeed({
            ncomparisons: ['title'],
          }),
        );
        const toUpdate = {};
        await service.updateOne(feed._id.toString(), toUpdate);

        const foundFeed = await feedModel.findById(feed._id);

        expect(foundFeed?.ncomparisons).toEqual(['title']);
      });
    });

    describe('pcomparisons', () => {
      it('updates', async () => {
        const feed = await await feedModel.create(
          createTestFeed({
            pcomparisons: ['description'],
          }),
        );
        const toUpdate = {
          pcomparisons: ['title'],
        };
        await service.updateOne(feed._id.toString(), toUpdate);

        const foundFeed = await feedModel.findById(feed._id);

        expect(foundFeed?.pcomparisons).toEqual(['title']);
      });

      it('does not update if it is undefined', async () => {
        const feed = await await feedModel.create(
          createTestFeed({
            pcomparisons: ['title'],
          }),
        );
        const toUpdate = {};
        await service.updateOne(feed._id.toString(), toUpdate);

        const foundFeed = await feedModel.findById(feed._id);

        expect(foundFeed?.pcomparisons).toEqual(['title']);
      });
    });

    describe('webhooks', () => {
      it('updates webhook id when no webhook previously existed', async () => {
        const newWebhookId = 'my-new-webhook-id';
        const createdFeed = await feedModel.create(createTestFeed());

        await service.updateOne(createdFeed._id.toString(), {
          webhook: {
            id: newWebhookId,
          },
        });

        const updatedFeed = await feedModel.findById(createdFeed._id).lean();

        expect(updatedFeed?.webhook?.id).toEqual(newWebhookId);
      });

      it('returns the new webhook id after a webhook update', async () => {
        const newWebhookId = 'my-new-webhook-id';
        const createdFeed = await feedModel.create(createTestFeed());

        const result = await service.updateOne(createdFeed._id.toString(), {
          webhook: {
            id: newWebhookId,
          },
        });

        expect(result.webhook?.id).toEqual(newWebhookId);
      });

      it('does not persist any old webhook data if webhook is overwritten', async () => {
        const oldWebhookId = 'old-webhook-id';
        const newWebhookId = 'my-new-webhook-id';
        const createdFeed = await feedModel.create(
          createTestFeed({
            webhook: {
              id: oldWebhookId,
            },
          }),
        );

        await service.updateOne(createdFeed._id.toString(), {
          webhook: {
            id: newWebhookId,
          },
        });

        const updatedFeed = await feedModel.findById(createdFeed._id).lean();

        expect(updatedFeed?.webhook?.id).toEqual(newWebhookId);
      });

      it('removes the webhook object if webhook id is empty', async () => {
        const oldWebhookId = 'old-webhook-id';
        const createdFeed = await feedModel.create(
          createTestFeed({
            webhook: {
              id: oldWebhookId,
            },
          }),
        );

        await service.updateOne(createdFeed._id.toString(), {
          webhook: {
            id: '',
          },
        });

        const updatedFeed = await feedModel.findById(createdFeed._id).lean();

        expect(updatedFeed?.webhook).toBeUndefined();
      });
    });

    describe('filters', () => {
      it('overwrites the filters', async () => {
        const createdFeed = await feedModel.create(
          createTestFeed({
            filters: {
              title: ['a'],
            },
          }),
        );

        const newFilters = {
          title: ['title-1', 'title2'],
          description: ['a', 'b'],
        };

        await service.updateOne(createdFeed._id.toString(), {
          filters: newFilters,
        });

        const updatedFeed = await feedModel.findById(createdFeed._id).lean();

        expect(updatedFeed?.filters).toEqual(newFilters);
      });
    });

    describe('title', () => {
      it('updates the title if it exists', async () => {
        const newTitle = 'new-title';
        const createdFeed = await feedModel.create(createTestFeed());

        await service.updateOne(createdFeed._id.toString(), {
          title: newTitle,
        });

        const updatedFeed = await feedModel.findById(createdFeed._id).lean();

        expect(updatedFeed?.title).toEqual(newTitle);
      });

      it('does not update if the title is an empty string', async () => {
        const createdFeed = await feedModel.create(createTestFeed());

        await service.updateOne(createdFeed._id.toString(), {
          title: '',
        });

        const updatedFeed = await feedModel.findById(createdFeed._id).lean();

        expect(updatedFeed?.title).toEqual(createdFeed.title);
      });
    });

    describe.each([
      'checkTitles',
      'checkDates',
      'imgPreviews',
      'imgLinksExistence',
      'formatTables',
    ])('%s', (fieldKey) => {
      it('updates the value', async () => {
        const createdFeed = await feedModel.create(
          createTestFeed({
            [fieldKey]: false,
          }),
        );

        await service.updateOne(createdFeed._id.toString(), {
          [fieldKey]: true,
        });

        const updatedFeed = await feedModel.findById(createdFeed._id).lean();

        // @ts-ignore
        expect(updatedFeed?.[fieldKey]).toEqual(true);
      });

      it('does not update if no boolean was passed', async () => {
        const createdFeed = await feedModel.create(
          createTestFeed({
            [fieldKey]: true,
          }),
        );

        await service.updateOne(createdFeed._id.toString(), {});

        const updatedFeed = await feedModel.findById(createdFeed._id).lean();

        // @ts-ignore
        expect(updatedFeed?.[fieldKey]).toEqual(true);
      });
    });

    describe('splitMessage', () => {
      it('updates the value if the value already existed', async () => {
        const createdFeed = await feedModel.create(
          createTestFeed({
            split: {
              enabled: false,
            },
          }),
        );

        await service.updateOne(createdFeed._id.toString(), {
          splitMessage: true,
        });

        const updatedFeed = await feedModel.findById(createdFeed._id).lean();

        // @ts-ignore
        expect(updatedFeed?.split?.enabled).toEqual(true);
      });

      it('updates the value if the value did not already exist', async () => {
        const createdFeed = await feedModel.create(createTestFeed());

        await service.updateOne(createdFeed._id.toString(), {
          splitMessage: true,
        });

        const updatedFeed = await feedModel.findById(createdFeed._id).lean();

        // @ts-ignore
        expect(updatedFeed?.split?.enabled).toEqual(true);
      });

      it('does not update if no boolean was passed', async () => {
        const createdFeed = await feedModel.create(
          createTestFeed({
            split: {
              enabled: true,
            },
          }),
        );

        await service.updateOne(createdFeed._id.toString(), {});

        const updatedFeed = await feedModel.findById(createdFeed._id).lean();

        // @ts-ignore
        expect(updatedFeed?.split?.enabled).toEqual(true);
      });
    });

    it('returns undefined if no feed is found', async () => {
      await expect(
        service.updateOne(new Types.ObjectId(), {
          text: 'hello',
        }),
      ).resolves.toEqual(undefined);
    });

    it('updates the text', async () => {
      const newText = 'my-new-text';
      const createdFeed = await feedModel.create(
        createTestFeed({
          text: 'old-text',
        }),
      );

      await service.updateOne(createdFeed._id.toString(), {
        text: newText,
      });

      const updatedFeed = await feedModel.findById(createdFeed._id).lean();

      expect(updatedFeed).toEqual(expect.objectContaining({ text: newText }));
    });

    it('does not update the text if undefined is passed', async () => {
      const createdFeed = await feedModel.create(
        createTestFeed({
          text: 'old-text',
        }),
      );

      await service.updateOne(createdFeed._id.toString(), {
        text: undefined,
      });

      const updatedFeed = await feedModel.findById(createdFeed._id).lean();

      expect(updatedFeed).toEqual(
        expect.objectContaining({ text: createdFeed.text }),
      );
    });

    it('returns the updated feed', async () => {
      const newText = 'new-text';
      const createdFeed = await feedModel.create(
        createTestFeed({
          text: 'old-text',
        }),
      );

      const result = await service.updateOne(createdFeed._id.toString(), {
        text: newText,
      });

      expect(result).toEqual(
        expect.objectContaining({
          _id: createdFeed._id,
          text: newText,
        }),
      );
    });
  });

  describe('refresh', () => {
    it('throws if the feed does not exist', async () => {
      const id = new Types.ObjectId();
      await expect(service.refresh(id)).rejects.toThrowError();
    });

    it('deletes the fail record', async () => {
      const createdFeed = await feedModel.create(createTestFeed());
      const createdRecord = await failRecordModel.create({
        _id: createdFeed.url,
        reason: 'reason',
        alerted: true,
        failedAt: new Date(2020, 1, 1),
      });

      await service.refresh(createdFeed._id.toString());

      const updatedFeed = await failRecordModel
        .findById(createdRecord._id)
        .lean();

      expect(updatedFeed).toBeNull();
    });

    it('returns status ok', async () => {
      const createdFeed = await feedModel.create(createTestFeed());
      const result = await service.refresh(createdFeed._id.toString());

      expect(result.status).toEqual(FeedStatus.OK);
    });
  });

  describe('findFeeds', () => {
    const defaultOptions = {
      skip: 0,
      limit: 1000,
    };

    it('does not return feeds that do not match filters', async () => {
      const feedUrl = 'https://example.com/feed';
      const feeds = await feedModel.create([
        createTestFeed({
          url: feedUrl,
        }),
        createTestFeed({
          url: feedUrl + '1',
        }),
      ]);
      const result = await service.findFeeds(
        {
          url: feeds[0].url,
        },
        defaultOptions,
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toEqual(feeds[0].url);
    });

    it('works with search', async () => {
      const guild = 'guild-id';
      const feeds = await feedModel.create([
        createTestFeed({
          url: 'goog',
          guild,
        }),
        createTestFeed({
          title: 'google',
          guild,
        }),
        createTestFeed({
          title: 'GOO',
          guild,
        }),
        createTestFeed({
          url: 'GOo',
          guild,
        }),
      ]);
      const result = await service.findFeeds(
        {
          guild,
        },
        {
          ...defaultOptions,
          search: 'go',
        },
      );

      expect(result).toHaveLength(4);
      const ids = result.map((feed) => String(feed._id));
      expect(ids).toContain(String(feeds[0]._id));
      expect(ids).toContain(String(feeds[1]._id));
      expect(ids).toContain(String(feeds[2]._id));
      expect(ids).toContain(String(feeds[3]._id));
    });

    it('respects skip and limit', async () => {
      const feeds = await feedModel.create(
        createTestFeed({
          url: '2020',
          addedAt: new Date(2020, 1, 1),
        }),
        createTestFeed({
          url: '2019',
          addedAt: new Date(2019, 1, 1),
        }),
        createTestFeed({
          url: '2021',
          addedAt: new Date(2021, 1, 1),
        }),
      );
      const result = await service.findFeeds(
        {},
        {
          skip: 1,
          limit: 1,
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].url).toEqual(feeds[0].url);
    });

    it('returns feed status failed correctly', async () => {
      const createdFeed = await feedModel.create(createTestFeed());
      const failRecord = createTestFailRecord({
        _id: createdFeed.url,
        failedAt: new Date(1990, 1, 1),
        reason: 'test-fail-reason',
      });
      await failRecordModel.create(failRecord);
      const result = await service.findFeeds(
        {
          _id: createdFeed._id,
        },
        defaultOptions,
      );

      expect(result[0].status).toEqual(FeedStatus.FAILED);
      expect(result[0].failReason).toEqual(failRecord.reason);
    });
    it('returns feed status OK correctly', async () => {
      const createdFeed = await feedModel.create(createTestFeed());
      const result = await service.findFeeds(
        {
          _id: createdFeed._id,
        },
        defaultOptions,
      );

      expect(result[0]).toEqual(
        expect.objectContaining({
          status: FeedStatus.OK,
        }),
      );
    });

    it('returns refresh rates', async () => {
      const createdFeed = await feedModel.create(createTestFeed());
      const result = await service.findFeeds(
        {
          _id: createdFeed._id,
        },
        defaultOptions,
      );

      expect(result[0]).toEqual(
        expect.objectContaining({
          refreshRateSeconds: expect.any(Number),
        }),
      );
    });

    it('does not return failed status for fail records within the past 18 hours', async () => {
      const createdFeed = await feedModel.create(createTestFeed());

      const failRecordDate = new Date();
      failRecordDate.setHours(failRecordDate.getHours() - 2);
      const failRecordsToInsert = [
        createTestFailRecord({
          _id: createdFeed.url,
          failedAt: failRecordDate,
        }),
      ];
      await failRecordModel.insertMany(failRecordsToInsert);
      const result = await service.findFeeds(
        {
          _id: createdFeed._id,
        },
        defaultOptions,
      );

      expect(result[0].status).toEqual(FeedStatus.OK);
    });
  });

  describe('cloneFeed', () => {
    describe('subscribers', () => {
      it('clones correctly', async () => {
        const feedsToInsert = [
          createTestFeed({
            title: 'source-feed',
          }),
          createTestFeed({
            title: 'target-feed-1',
          }),
          createTestFeed({
            title: 'target-feed-2',
          }),
        ];
        const subscribersToInsert = [
          createTestFeedSubscriber({
            feed: feedsToInsert[0]._id,
            id: 'id-1',
          }),
          createTestFeedSubscriber({
            feed: feedsToInsert[0]._id,
            id: 'id-2',
          }),
        ];
        const [createdFeeds, createdSubscribers] = await Promise.all([
          feedModel.insertMany(feedsToInsert),
          feedSubscriberModel.insertMany(subscribersToInsert),
        ]);

        await service.cloneFeed(
          createdFeeds[0],
          [
            createdFeeds[1]._id.toHexString(),
            createdFeeds[2]._id.toHexString(),
          ],
          [CloneFeedInputProperties.SUBSCRIBERS],
        );

        const targetFeed1Subscribers = await feedSubscriberModel.find({
          feed: createdFeeds[1]._id,
        });

        const targetFeed1SubscriberIds = targetFeed1Subscribers.map(
          (subscriber) => subscriber.id,
        );
        expect(targetFeed1SubscriberIds).toEqual([
          createdSubscribers[0].id,
          createdSubscribers[1].id,
        ]);

        const targetFeed2Subscribers = await feedSubscriberModel.find({
          feed: createdFeeds[2]._id,
        });

        const targetFeed2SubscriberIds = targetFeed2Subscribers.map(
          (subscriber) => subscriber.id,
        );
        expect(targetFeed2SubscriberIds).toEqual([
          createdSubscribers[0].id,
          createdSubscribers[1].id,
        ]);
      });

      it('does not clone to unspecified feeds', async () => {
        const feedsToInsert = [
          createTestFeed({
            title: 'source-feed',
          }),
          createTestFeed({
            title: 'target-feed-1',
          }),
          createTestFeed({
            title: 'target-feed-2',
          }),
        ];
        const subscribersToInsert = [
          createTestFeedSubscriber({
            feed: feedsToInsert[0]._id,
            id: 'id-1',
          }),
        ];
        const [createdFeeds] = await Promise.all([
          feedModel.insertMany(feedsToInsert),
          feedSubscriberModel.insertMany(subscribersToInsert),
        ]);

        await service.cloneFeed(
          createdFeeds[0],
          [createdFeeds[1]._id.toHexString()],
          [CloneFeedInputProperties.SUBSCRIBERS],
        );

        const targetFeed2Subscribers = await feedSubscriberModel.find({
          feed: createdFeeds[2]._id,
        });

        expect(targetFeed2Subscribers).toHaveLength(0);
      });

      it('deletes existing subscribers of target feeds', async () => {
        const feedsToInsert = [
          createTestFeed({
            title: 'source-feed',
          }),
          createTestFeed({
            title: 'target-feed',
          }),
        ];
        const subscribersToInsert = [
          createTestFeedSubscriber({
            feed: feedsToInsert[1]._id,
            id: 'id-2',
          }),
        ];
        const [createdFeeds] = await Promise.all([
          feedModel.insertMany(feedsToInsert),
          feedSubscriberModel.insertMany(subscribersToInsert),
        ]);

        await service.cloneFeed(
          createdFeeds[0],
          [createdFeeds[1]._id.toHexString()],
          [CloneFeedInputProperties.SUBSCRIBERS],
        );

        const targetFeedSubscribers = await feedSubscriberModel.find({
          feed: createdFeeds[1]._id,
        });

        expect(targetFeedSubscribers).toHaveLength(0);
      });
    });
  });
});
