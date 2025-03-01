import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import FeedParser from "feedparser";
import fetch from "node-fetch";
import { FeedData } from "./types/FeedData.type";
// @ts-ignore
import ArticleIDResolver from "./utils/ArticleIDResolver";
// @ts-ignore
import Article from "./utils/Article";
import {
  InvalidFeedException,
  FeedParseException,
  FeedParseTimeoutException,
  FeedRequestException,
  FeedTooManyRequestsException,
  FeedUnauthorizedException,
  FeedForbiddenException,
  FeedInternalErrorException,
  FeedNotFoundException,
  FeedFetchTimeoutException,
} from "./exceptions";
import { FeedFetcherApiService } from "./feed-fetcher-api.service";
import { Readable } from "stream";
import { FeedFetcherFetchStatus } from "./types/feed-fetcher-fetch-feed-response.type";

interface FetchFeedOptions {
  formatTables?: boolean;
  imgLinksExistence?: boolean;
  imgPreviews?: boolean;
  fetchOptions: {
    useServiceApi: boolean;
    useServiceApiCache: boolean;
  };
}

interface FeedFetchResult {
  articles: Article[];
  idType?: string;
}

@Injectable()
export class FeedFetcherService {
  constructor(
    private readonly configService: ConfigService,
    private feedFetcherApiService: FeedFetcherApiService
  ) {}

  async fetchFeed(
    url: string,
    options: FetchFeedOptions
  ): Promise<FeedFetchResult> {
    let inputStream: NodeJS.ReadableStream;

    if (!options.fetchOptions.useServiceApi) {
      inputStream = await this.fetchFeedStream(url);
    } else {
      inputStream = await this.fetchFeedStreamFromApiService(url, {
        getCachedResponse: options.fetchOptions.useServiceApiCache,
      });
    }

    const { articleList, idType } = await this.parseFeed(inputStream);

    const articles = this.convertRawObjectsToArticles(articleList, options);

    return {
      articles,
      idType,
    };
  }

  async fetchFeedStream(url: string): Promise<NodeJS.ReadableStream> {
    const userAgent = this.configService.get<string>(
      "BACKEND_API_FEED_USER_AGENT"
    );

    const res = await fetch(url, {
      timeout: 15000,
      follow: 5,
      headers: {
        "user-agent": userAgent || "",
      },
    });

    this.handleStatusCode(res.status);

    return res.body;
  }

  async fetchFeedStreamFromApiService(
    url: string,
    options?: {
      getCachedResponse?: boolean;
    }
  ): Promise<NodeJS.ReadableStream> {
    const result = await this.feedFetcherApiService.fetchAndSave(url, options);

    if (result.requestStatus === FeedFetcherFetchStatus.BadStatusCode) {
      if (result.response?.statusCode) {
        this.handleStatusCode(result.response.statusCode);
      }

      throw new Error("Prior feed requests have failed");
    }

    if (result.requestStatus === FeedFetcherFetchStatus.ParseError) {
      throw new FeedParseException(
        `Feed host failed to return a valid, parseable feed`
      );
    }

    if (result.requestStatus === FeedFetcherFetchStatus.FetchTimeout) {
      throw new FeedFetchTimeoutException(`Feed fetch timed out`);
    }

    if (result.requestStatus === FeedFetcherFetchStatus.Success) {
      this.handleStatusCode(result.response.statusCode);
      const readable = new Readable();
      readable.push(result.response.body);
      readable.push(null);

      return readable;
    }

    if (result.requestStatus === FeedFetcherFetchStatus.Pending) {
      const readable = new Readable();
      readable.push(null);

      return readable;
    }

    throw new Error(`Unhandled request status: ${result["requestStatus"]}`);
  }

  async parseFeed(inputStream: NodeJS.ReadableStream): Promise<FeedData> {
    const feedparser = new FeedParser({});
    const idResolver = new ArticleIDResolver();
    const articleList: FeedParser.Item[] = [];

    return new Promise<FeedData>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new FeedParseTimeoutException());
      }, 10000);

      inputStream.on("error", (err: Error) => {
        // feedparser may not handle all errors such as incorrect headers. (feedparser v2.2.9)
        reject(new FeedParseException(err.message));
      });

      feedparser.on("error", (err: Error) => {
        if (err.message === "Not a feed") {
          reject(
            new InvalidFeedException(
              "That is a not a valid feed. Note that you cannot add just any link. " +
                "You may check if it is a valid feed by using online RSS feed validators"
            )
          );
        } else {
          reject(new FeedParseException(err.message));
        }
      });

      feedparser.on("readable", function (this: FeedParser) {
        let item;

        do {
          item = this.read();

          if (item) {
            idResolver.recordArticle(item);
            articleList.push(item);
          }
        } while (item);
      });

      feedparser.on("end", () => {
        clearTimeout(timeout);

        if (articleList.length === 0) {
          return resolve({ articleList });
        }

        clearTimeout(timeout);
        const idType = idResolver.getIDType();

        for (const article of articleList) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          article._id = ArticleIDResolver.getIDTypeValue(article, idType);
        }

        resolve({ articleList, idType });
      });

      inputStream.pipe(feedparser);
    });
  }

  private handleStatusCode(code: number) {
    if (code === HttpStatus.OK) {
      return;
    }

    if (code === HttpStatus.TOO_MANY_REQUESTS) {
      throw new FeedTooManyRequestsException();
    } else if (code === HttpStatus.UNAUTHORIZED) {
      throw new FeedUnauthorizedException();
    } else if (code === HttpStatus.FORBIDDEN) {
      throw new FeedForbiddenException();
    } else if (code === HttpStatus.NOT_FOUND) {
      throw new FeedNotFoundException();
    } else if (code >= HttpStatus.INTERNAL_SERVER_ERROR) {
      throw new FeedInternalErrorException();
    } else {
      throw new FeedRequestException(`Non-200 status code (${code})`);
    }
  }

  private convertRawObjectsToArticles(
    feedparserItems: FeedParser.Item[],
    feedOptions?: FetchFeedOptions
  ): Article[] {
    return feedparserItems.map(
      (item) =>
        new Article(
          item,
          {
            feed: feedOptions || {},
          },
          {
            dateFallback: false,
            timeFallback: false,
            dateFormat: "ddd, D MMMM YYYY, h:mm A z",
            formatTables: false,
            imgLinksExistence: true,
            imgPreviews: true,
            timezone: "UTC",
          }
        )
    );
  }
}
