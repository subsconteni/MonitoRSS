import { InferType, object } from "yup";
import fetchRest from "../../../utils/fetchRest";
import { FeedConnectionDisabledCode, FeedConnectionSchema } from "@/types";

export interface UpdateDiscordChannelConnectionInput {
  feedId: string;
  connectionId: string;
  details: {
    name?: string;
    channelId?: string;
    content?: string | null;
    forumThreadTitle?: string | null;
    filters?: {
      expression: Record<string, any>;
    } | null;
    disabledCode?: FeedConnectionDisabledCode.Manual | null;
    passingComparisons?: string[];
    blockingComparisons?: string[];
    embeds?: Array<{
      color?: string | null;
      author?: {
        name?: string | null;
        url?: string | null;
        iconUrl?: string | null;
      } | null;
      title?: string | null;
      url?: string | null;
      description?: string | null;
      thumbnail?: {
        url?: string | null;
      } | null;
      image?: {
        url?: string | null;
      } | null;
      footer?: {
        text?: string | null;
        iconUrl?: string | null;
      } | null;
    }>;
    splitOptions?: {
      splitChar?: string | null;
      appendChar?: string | null;
      prependChar?: string | null;
    } | null;
    formatter?: {
      formatTables?: boolean | null;
      stripImages?: boolean | null;
    } | null;
  };
}

const UpdateDiscordChannelConnectionOutputSchema = object({
  result: FeedConnectionSchema,
}).required();

export type UpdateDiscordChannelConnectionOutput = InferType<
  typeof UpdateDiscordChannelConnectionOutputSchema
>;

export const updateDiscordChannelConnection = async (
  options: UpdateDiscordChannelConnectionInput
): Promise<UpdateDiscordChannelConnectionOutput> => {
  const res = await fetchRest(
    `/api/v1/user-feeds/${options.feedId}/connections/discord-channels/${options.connectionId}`,
    {
      validateSchema: UpdateDiscordChannelConnectionOutputSchema,
      requestOptions: {
        method: "PATCH",
        body: JSON.stringify(options.details),
      },
    }
  );

  return res as UpdateDiscordChannelConnectionOutput;
};
