import { FormControl, FormErrorMessage, Select } from "@chakra-ui/react";
import { Controller, FieldError, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { getNestedField } from "../../../../utils/getNestedField";
import { useUserFeedArticleProperties } from "../../../feed/hooks";

interface Props {
  controllerName: string;
  placeholder?: string;
  data: {
    feedId?: string;
  };
}

export const ArticlePropertySelect = ({ controllerName, placeholder, data }: Props) => {
  const { t } = useTranslation();
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const { data: propertiesData, status } = useUserFeedArticleProperties({
    feedId: data.feedId,
  });

  // Using bracket notation on the errors object will not work since the prefix is a string
  const error = getNestedField<FieldError>(errors, controllerName);

  return (
    <FormControl isInvalid={!!error}>
      <Controller
        name={controllerName}
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <>
            <Select placeholder={placeholder} isDisabled={status === "loading"} {...field}>
              {propertiesData?.result.properties.map((property) => (
                <option value={property} key={property}>
                  {property}
                </option>
              ))}
            </Select>
            {error?.type === "required" && (
              <FormErrorMessage>
                {t("features.feedConnections.components.filtersForm.valueIsRequired")}
              </FormErrorMessage>
            )}
          </>
        )}
      />
    </FormControl>
  );
};
