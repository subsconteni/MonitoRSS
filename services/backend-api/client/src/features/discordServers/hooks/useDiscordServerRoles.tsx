import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ApiAdapterError from "../../../utils/ApiAdapterError";
import { getServerRoles, GetServerRolesOutput } from "../api";

interface Props {
  serverId?: string;
}

export const useDiscordServerRoles = ({ serverId }: Props) => {
  const [hasErrored, setHasErrored] = useState(false);

  const { data, status, error } = useQuery<GetServerRolesOutput, ApiAdapterError>(
    [
      "server-roles",
      {
        serverId,
      },
    ],
    async () => {
      if (!serverId) {
        throw new Error("Missing server ID when getting server roles");
      }

      return getServerRoles({
        serverId,
      });
    },
    {
      enabled: !!serverId && !hasErrored,
      onError: () => setHasErrored(true),
    }
  );

  const getRolebyId = (roleId: string) => {
    if (!data?.results) {
      return null;
    }

    return data.results.find((role) => role.id === roleId) || null;
  };

  return {
    data,
    status,
    error,
    getRolebyId,
  };
};
