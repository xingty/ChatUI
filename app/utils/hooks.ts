import { useMemo } from "react";
import { useAccessStore, useAppConfig } from "../store";
import { collectModels } from "./model";
import { DEFAULT_MODELS } from "../constant";

export function useAllModels() {
  const accessStore = useAccessStore();
  const configStore = useAppConfig();

  const models = useMemo(() => {
    return collectModels(
      DEFAULT_MODELS,
      [configStore.customModels, accessStore.customModels].join(","),
    );
  }, [accessStore.customModels, configStore.customModels, DEFAULT_MODELS]);

  return models;
}
