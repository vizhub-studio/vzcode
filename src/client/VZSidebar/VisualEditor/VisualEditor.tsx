/** Live ShareDB adapter around the reusable VZCode visual controls. */
import React, { useContext } from 'react';
import { VZCodeContext } from '../../VZCodeContext';
import { CONFIG_FILE_NAME } from './constants';
import { updateVisualEditorProperty } from './updateConfig';
import { VisualEditorControls } from './VisualEditorControls';

export const VisualEditor = () => {
  const { files, submitOperation, renderVisualEditorEmptyState } = useContext(VZCodeContext);
  const configId = files
    ? Object.keys(files).find(id => files[id].name === CONFIG_FILE_NAME) ?? null
    : null;
  const configText = configId && files ? files[configId]?.text ?? null : null;
  return <VisualEditorControls
    configText={configText}
    renderEmptyState={renderVisualEditorEmptyState}
    onChange={(property, value) => {
      submitOperation(document =>
        updateVisualEditorProperty(document, configId, property, value)
      );
    }}
  />;
};
