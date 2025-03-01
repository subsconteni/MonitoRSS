import { ChevronDownIcon } from "@chakra-ui/icons";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Button,
  Grid,
  Heading,
  HStack,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { BoxConstrained, CategoryText, ConfirmModal, DashboardContentV2 } from "../components";
import { pages } from "../constants";
import { DiscordChannelName, DiscordServerName } from "../features/discordServers";
import { useUserFeed } from "../features/feed";
import {
  DeleteConnectionButton,
  LogicalFilterExpression,
  useDiscordChannelConnection,
  useUpdateDiscordChannelConnection,
  SendConnectionTestArticleButton,
  FiltersTabSection,
  MessageTabSection,
  ConnectionDisabledAlert,
  EditConnectionChannelDialog,
  UpdateDiscordChannelConnectionInput,
} from "../features/feedConnections";
import {
  FeedConnectionDisabledCode,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "../types";
import RouteParams from "../types/RouteParams";
import { notifyError } from "../utils/notifyError";
import { notifySuccess } from "../utils/notifySuccess";

enum TabSearchParam {
  Message = "?view=message",
  Filters = "?view=filters",
}

const tabIndexBySearchParam = new Map<string, number>([
  [TabSearchParam.Message, 0],
  [TabSearchParam.Filters, 1],
]);

const getPrettyChannelType = (
  type?: FeedDiscordChannelConnection["details"]["channel"]["type"]
) => {
  const { t } = useTranslation();

  if (type === "thread") {
    return t("pages.discordChannelConnection.channelTypeThread");
  }

  if (type === "forum") {
    return t("pages.discordChannelConnection.channelTypeForum");
  }

  return t("pages.discordChannelConnection.channelTypeTextChannel");
};

export const ConnectionDiscordChannelSettings: React.FC = () => {
  const { feedId, connectionId } = useParams<RouteParams>();
  const navigate = useNavigate();
  const { search: urlSearch } = useLocation();
  const { isOpen: editIsOpen, onClose: editOnClose, onOpen: editOnOpen } = useDisclosure();
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  const {
    feed,
    status: feedStatus,
    error: feedError,
  } = useUserFeed({
    feedId,
  });
  const {
    connection,
    status: connectionStatus,
    error: connectionError,
  } = useDiscordChannelConnection({
    connectionId,
    feedId,
  });
  const { t } = useTranslation();
  const { mutateAsync, status: updateStatus } = useUpdateDiscordChannelConnection();

  const serverId = connection?.details.channel.guildId;

  const onUpdate = async (details: UpdateDiscordChannelConnectionInput["details"]) => {
    if (!feedId || !connectionId) {
      return;
    }

    try {
      await mutateAsync({
        feedId,
        connectionId,
        details,
      });
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  return (
    <DashboardContentV2
      error={feedError || connectionError}
      loading={feedStatus === "loading" || connectionStatus === "loading"}
    >
      {connection && (
        <EditConnectionChannelDialog
          onCloseRef={actionsButtonRef}
          defaultValues={{
            channelId: connection.details.channel.id,
            name: connection.name,
            serverId,
          }}
          onUpdate={({ channelId: updatedChannelId, name }) =>
            onUpdate({
              channelId: updatedChannelId,
              name,
            })
          }
          isOpen={editIsOpen}
          onClose={editOnClose}
        />
      )}
      <Tabs isLazy isFitted defaultIndex={tabIndexBySearchParam.get(urlSearch) || 0}>
        <BoxConstrained.Wrapper paddingTop={10} background="gray.700">
          <BoxConstrained.Container spacing={12}>
            <Stack spacing={6}>
              <Stack spacing={4}>
                <Stack>
                  <Breadcrumb>
                    <BreadcrumbItem>
                      <BreadcrumbLink as={RouterLink} to={pages.userFeeds()}>
                        Feeds
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem>
                      <BreadcrumbLink as={RouterLink} to={pages.userFeed(feedId as string)}>
                        {feed?.title}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbItem isCurrentPage>
                      <BreadcrumbLink href="#">{connection?.name}</BreadcrumbLink>
                    </BreadcrumbItem>
                  </Breadcrumb>
                  <HStack alignItems="center" justifyContent="space-between">
                    <Heading size="lg" marginRight={4}>
                      {connection?.name}
                    </Heading>
                    {connection && (
                      <HStack>
                        <SendConnectionTestArticleButton
                          connectionId={connectionId as string}
                          feedId={feedId as string}
                          type={FeedConnectionType.DiscordChannel}
                          articleFormatter={{
                            options: {
                              formatTables: connection?.details.formatter?.formatTables || false,
                              stripImages: connection?.details.formatter?.stripImages || false,
                              dateFormat: feed?.formatOptions?.dateFormat,
                              dateTimezone: feed?.formatOptions?.dateTimezone,
                            },
                          }}
                        />
                        <Menu>
                          <MenuButton
                            ref={actionsButtonRef}
                            as={Button}
                            variant="outline"
                            rightIcon={<ChevronDownIcon />}
                          >
                            {t("common.buttons.actions")}
                          </MenuButton>
                          <MenuList>
                            <MenuItem aria-label="Edit" onClick={editOnOpen}>
                              {t("common.buttons.configure")}
                            </MenuItem>
                            {connection && !connection.disabledCode && (
                              <ConfirmModal
                                title={t(
                                  "pages.discordChannelConnection.manualDisableConfirmTitle"
                                )}
                                description={t(
                                  "pages.discordChannelConnection" +
                                    ".manualDisableConfirmDescription"
                                )}
                                trigger={
                                  <MenuItem isDisabled={updateStatus === "loading"}>
                                    {t("common.buttons.disable")}
                                  </MenuItem>
                                }
                                okText={t("common.buttons.yes")}
                                okLoading={updateStatus === "loading"}
                                colorScheme="blue"
                                onConfirm={() =>
                                  onUpdate({
                                    disabledCode: FeedConnectionDisabledCode.Manual,
                                  })
                                }
                              />
                            )}
                            <MenuDivider />
                            <DeleteConnectionButton
                              connectionId={connectionId as string}
                              feedId={feedId as string}
                              type={FeedConnectionType.DiscordChannel}
                              trigger={<MenuItem>{t("common.buttons.delete")}</MenuItem>}
                            />
                          </MenuList>
                        </Menu>
                      </HStack>
                    )}
                  </HStack>
                </Stack>
                <ConnectionDisabledAlert
                  disabledCode={connection?.disabledCode}
                  onEnable={() =>
                    onUpdate({
                      disabledCode: null,
                    })
                  }
                />
              </Stack>
              <Grid
                templateColumns={{
                  base: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: "repeat(4, fit-content(320px))",
                }}
                columnGap="20"
                rowGap={{ base: "8", lg: "14" }}
              >
                <CategoryText title={t("pages.discordChannelConnection.serverLabel")}>
                  <DiscordServerName serverId={serverId} />
                </CategoryText>
                <CategoryText title={t("pages.discordChannelConnection.channelNameLabel")}>
                  <DiscordChannelName
                    serverId={serverId}
                    channelId={connection?.details.channel.id as string}
                  />
                </CategoryText>
                <CategoryText title={t("pages.discordChannelConnection.channelTypeLabel")}>
                  <Text>{getPrettyChannelType(connection?.details.channel.type)}</Text>
                </CategoryText>
              </Grid>
            </Stack>
            <TabList>
              <Tab
                onClick={() => {
                  navigate({
                    search: TabSearchParam.Message,
                  });
                }}
              >
                Message
              </Tab>
              <Tab
                onClick={() => {
                  navigate({
                    search: TabSearchParam.Filters,
                  });
                }}
              >
                Filters
              </Tab>
            </TabList>
          </BoxConstrained.Container>
        </BoxConstrained.Wrapper>
        <TabPanels width="100%" display="flex" justifyContent="center" mt="8">
          <TabPanel width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <MessageTabSection
                  feedId={feedId as string}
                  onMessageUpdated={(data) => onUpdate(data)}
                  defaultMessageValues={{
                    content: connection?.details.content,
                    embeds: connection?.details.embeds,
                    splitOptions: connection?.splitOptions || null,
                    formatter: connection?.details.formatter,
                    forumThreadTitle: connection?.details.forumThreadTitle,
                    forumThreadTags: connection?.details.forumThreadTags || [],
                  }}
                  articleFormatter={{
                    options: {
                      formatTables: connection?.details.formatter.formatTables,
                      stripImages: connection?.details.formatter.stripImages,
                      dateFormat: feed?.formatOptions?.dateFormat,
                      dateTimezone: feed?.formatOptions?.dateTimezone,
                    },
                  }}
                  connection={{
                    id: connectionId as string,
                    type: FeedConnectionType.DiscordChannel,
                  }}
                  include={{
                    forumThreadTitle: connection?.details.channel.type === "forum",
                  }}
                />
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
          <TabPanel width="100%">
            <BoxConstrained.Wrapper>
              <BoxConstrained.Container>
                <FiltersTabSection
                  onFiltersUpdated={(filters) =>
                    onUpdate({
                      filters: filters
                        ? {
                            expression: filters,
                          }
                        : null,
                    })
                  }
                  feedId={feedId}
                  filters={connection?.filters?.expression as LogicalFilterExpression}
                  articleFormatter={{
                    options: {
                      formatTables: connection?.details.formatter.formatTables,
                      stripImages: connection?.details.formatter.stripImages,
                      dateFormat: feed?.formatOptions?.dateFormat,
                      dateTimezone: feed?.formatOptions?.dateTimezone,
                    },
                  }}
                />
              </BoxConstrained.Container>
            </BoxConstrained.Wrapper>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </DashboardContentV2>
  );
};
