import { DeleteIcon } from "@chakra-ui/icons";
import { Button } from "@chakra-ui/react";
import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ConfirmModal } from "../../../../components";
import { FeedConnectionType } from "../../../../types";
import { notifyError } from "../../../../utils/notifyError";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { useDeleteConnection } from "../../hooks";
import { pages } from "@/constants";

interface Props {
  feedId: string;
  connectionId: string;
  type: FeedConnectionType;
  trigger?: React.ReactElement;
}

export const DeleteConnectionButton = ({ feedId, connectionId, type, trigger }: Props) => {
  const { t } = useTranslation();
  const { mutateAsync, status } = useDeleteConnection(type);
  const navigate = useNavigate();

  const onDelete = async () => {
    try {
      await mutateAsync({
        feedId,
        connectionId,
      });
      navigate(pages.userFeed(feedId));
      notifySuccess(t("common.success.deleted"));
    } catch (err) {
      notifyError(t("common.errors.somethingWentWrong"), err as Error);
    }
  };

  return (
    <ConfirmModal
      title={t("features.feedConnections.components.deleteButton.confirmTitle")}
      description={t("features.feedConnections.components.deleteButton.confirmDescription")}
      trigger={
        trigger ? (
          React.cloneElement(trigger, {
            disabled: status === "loading",
          })
        ) : (
          <Button variant="outline" isDisabled={status === "loading"} leftIcon={<DeleteIcon />}>
            {t("common.buttons.delete")}
          </Button>
        )
      }
      okText={t("pages.userFeed.deleteConfirmOk")}
      okLoading={status === "loading"}
      colorScheme="red"
      onConfirm={onDelete}
    />
  );
};
