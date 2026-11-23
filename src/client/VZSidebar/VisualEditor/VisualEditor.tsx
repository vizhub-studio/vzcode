/** Live ShareDB adapter around the reusable visual properties controls. */
import React, { useCallback, useContext } from 'react';
import { VZCodeContext } from '../../VZCodeContext';
import { CONFIG_FILE_NAME } from './constants';
import {
  updateVisualEditorProperties,
  type WidgetValue,
} from './updateConfig';
import { VisualEditorControls } from './VisualEditorControls';

export const VisualEditor = () => {
  const {
    files,
    submitOperation,
    renderVisualEditorEmptyState,
  } = useContext(VZCodeContext);
  const configId = files
    ? (Object.keys(files).find(
        (id) => files[id].name === CONFIG_FILE_NAME,
      ) ?? null)
    : null;
  const configText =
    configId && files
      ? (files[configId]?.text ?? null)
      : null;
  const onChangeBatch = useCallback(
    (changes: Record<string, WidgetValue>) => {
      submitOperation((document) =>
        updateVisualEditorProperties(
          document,
          configId,
          changes,
        ),
      );
    },
    [configId, submitOperation],
  );
  return (
    <VisualEditorControls
      configText={configText}
      renderEmptyState={renderVisualEditorEmptyState}
      onChange={(property, value) =>
        onChangeBatch({ [property]: value })
      }
      onChangeBatch={onChangeBatch}
    />
  );
};
