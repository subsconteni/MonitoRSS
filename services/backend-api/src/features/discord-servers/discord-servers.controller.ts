import {
  Body,
  CacheTTL,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  StreamableFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from "@nestjs/common";
import { NestedQuery } from "../../common/decorators/NestedQuery";
import { DiscordOAuth2Guard } from "../discord-auth/guards/DiscordOAuth2.guard";
import { TransformValidationPipe } from "../../common/pipes/TransformValidationPipe";
import { DiscordServersService } from "./discord-servers.service";
import { GetServerFeedsInputDto } from "./dto/GetServerFeedsInput.dto";
import { GetServerFeedsOutputDto } from "./dto/GetServerFeedsOutput.dto";
import { BotHasServerGuard } from "./guards/BotHasServer.guard";
import { UserManagesServerGuard } from "./guards/UserManagesServer.guard";
import { GetServerChannelsOutputDto } from "./dto/GetServerChannelsOutput.dto";
import { HttpCacheInterceptor } from "../../common/interceptors/http-cache-interceptor";
import { GetServerRolesOutputDto } from "./dto/GetServerRolesOutput.dto";
import { GetServerStatusOutputDto } from "./dto/GetServerStatusOutput.dto";
import { GetServerOutputDto } from "./dto/GetServerOutput.dto";
import { UpdateServerOutputDto } from "./dto/UpdateServerOutput.dto";
import { UpdateServerInputDto } from "./dto/UpdateServerInput.dto";
import { GetDiscordServerChannelsFilter } from "./filters";
import { GetServerActiveThreadsInputDto } from "./dto/GetServerActiveThreadsInput.dto";

@Controller("discord-servers")
@UseGuards(DiscordOAuth2Guard)
export class DiscordServersController {
  constructor(private readonly discordServersService: DiscordServersService) {}

  @Get(":serverId")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async getServer(
    @Param("serverId") serverId: string
  ): Promise<GetServerOutputDto> {
    const profile = await this.discordServersService.getServerProfile(serverId);

    return {
      result: {
        profile,
      },
    };
  }

  @Get(":serverId/backup")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async getBackup(
    @Param("serverId") serverId: string
  ): Promise<StreamableFile> {
    const backupJson = await this.discordServersService.createBackup(serverId);

    const buffer = Buffer.from(JSON.stringify(backupJson, null, 2));

    return new StreamableFile(buffer);
  }

  @Get(":serverId/active-threads")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async getActiveThreads(
    @Param("serverId") serverId: string,
    @NestedQuery(TransformValidationPipe)
    { parentChannelId }: GetServerActiveThreadsInputDto
  ): Promise<GetServerChannelsOutputDto> {
    const channels = await this.discordServersService.getActiveThreads(
      serverId,
      {
        parentChannelId,
      }
    );

    return GetServerChannelsOutputDto.fromEntities(channels);
  }

  @Patch(":serverId")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async updateServer(
    @Param("serverId") serverId: string,
    @Body(ValidationPipe) updateServerInputDto: UpdateServerInputDto
  ): Promise<UpdateServerOutputDto> {
    const profile = await this.discordServersService.updateServerProfile(
      serverId,
      updateServerInputDto
    );

    return {
      result: {
        profile,
      },
    };
  }

  @Get(":serverId/status")
  @UseGuards(UserManagesServerGuard)
  async getServerStatus(
    @Param("serverId") serverId: string
  ): Promise<GetServerStatusOutputDto> {
    const result = await this.discordServersService.getServer(serverId);

    return {
      result: {
        authorized: !!result,
      },
    };
  }

  @Get(":serverId/feeds")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  async getServerFeeds(
    @Param("serverId") serverId: string,
    @NestedQuery(TransformValidationPipe)
    getServerFeedsInput: GetServerFeedsInputDto
  ): Promise<GetServerFeedsOutputDto> {
    const [serverFeeds, totalFeeds] = await Promise.all([
      this.discordServersService.getServerFeeds(serverId, {
        search: getServerFeedsInput.search,
        limit: getServerFeedsInput.limit,
        offset: getServerFeedsInput.offset,
      }),
      this.discordServersService.countServerFeeds(serverId, {
        search: getServerFeedsInput.search,
      }),
    ]);

    return {
      results: serverFeeds.map((feed) => ({
        id: feed._id.toHexString(),
        channel: feed.channel,
        createdAt: feed.addedAt?.toISOString(),
        status: feed.status,
        title: feed.title,
        url: feed.url,
      })),
      total: totalFeeds,
    };
  }

  @Get(":serverId/channels")
  @UseGuards(UserManagesServerGuard)
  @UseInterceptors(HttpCacheInterceptor)
  @UseFilters(GetDiscordServerChannelsFilter)
  @CacheTTL(1)
  async getServerChannels(
    @Param("serverId") serverId: string,
    @Query("include") include?: string
  ): Promise<GetServerChannelsOutputDto> {
    const channels = await this.discordServersService.getTextChannelsOfServer(
      serverId,
      {
        include: include?.split(","),
      }
    );

    return GetServerChannelsOutputDto.fromEntities(channels);
  }

  @Get(":serverId/roles")
  @UseGuards(BotHasServerGuard)
  @UseGuards(UserManagesServerGuard)
  @UseInterceptors(HttpCacheInterceptor)
  @CacheTTL(60 * 5)
  async getServerRoles(
    @Param("serverId") serverId: string
  ): Promise<GetServerRolesOutputDto> {
    const roles = await this.discordServersService.getRolesOfServer(serverId);

    return GetServerRolesOutputDto.fromEntities(roles);
  }
}
