import {
  useCallback,
  useContext,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { VZCodeContext } from '../../VZCodeContext';
import { VizContent, VizFileId } from '@vizhub/viz-types';
import { VisualEditorConfigEntry } from '../../../types';
import { EmptyState } from '../EmptyState';
import {
  toHclChannels,
  coerceChannelNumber,
  hclChannelsToHex,
} from './colorUtils';
import { CONFIG_FILE_NAME } from './constants';
import { getVisualEditorEmptyReason } from './status';
import { updateVisualEditorProperty } from './updateConfig';
import { SliderWidget } from './SliderWidget';
import { CheckboxWidget } from './CheckboxWidget';
import { TextInputWidget } from './TextInputWidget';
import { DropdownWidget } from './DropdownWidget';
import { SegmentedWidget } from './SegmentedWidget';
import { ColorWidget } from './ColorWidget';
import { getNestedProperty } from './utils';
import { PropertySection } from './PropertySection';

export const VisualEditor = () => {
  const {
    files,
    submitOperation,
    renderVisualEditorEmptyState,
  } = useContext(VZCodeContext);

  // Local state to track widget values during user interaction
  const [localValues, setLocalValues] = useState<{
    [key: string]: number | boolean | string;
  }>({});

  let configFileId: VizFileId | null = null;
  if (files) {
    for (const fileId in files) {
      if (files[fileId].name === CONFIG_FILE_NAME) {
        configFileId = fileId;
        break;
      }
    }
  }

  const configData = useMemo(() => {
    if (!files || !configFileId) {
      return null;
    }
    try {
      return JSON.parse(files[configFileId].text);
    } catch (_error) {
      console.error('Error parsing config.json:', _error);
      return null;
    }
  }, [configFileId, files]);

  // All controls share one optimistic state + ShareDB write path.
  const setWidgetValue = useCallback(
    (
      property: string,
      value: number | boolean | string,
      extraLocalValues: Record<string, number> = {},
    ) => {
      setLocalValues((prev) => ({
        ...prev,
        [property]: value,
        ...extraLocalValues,
      }));
      submitOperation((document: VizContent) =>
        updateVisualEditorProperty(
          document,
          configFileId,
          property,
          value,
        ),
      );
    },
    [configFileId, submitOperation],
  );

  const onSliderChange = useCallback(
    (property: string) =>
      (event: React.ChangeEvent<HTMLInputElement>) =>
        setWidgetValue(
          property,
          parseFloat(event.currentTarget.value),
        ),
    [setWidgetValue],
  );

  const onCheckboxChange = useCallback(
    (property: string) =>
      (event: React.ChangeEvent<HTMLInputElement>) =>
        setWidgetValue(
          property,
          event.currentTarget.checked,
        ),
    [setWidgetValue],
  );

  const onTextInputChange = useCallback(
    (property: string) =>
      (event: React.ChangeEvent<HTMLInputElement>) =>
        setWidgetValue(property, event.currentTarget.value),
    [setWidgetValue],
  );

  const onDropdownChange = useCallback(
    (property: string, value: string) =>
      setWidgetValue(property, value),
    [setWidgetValue],
  );

  const onHexColorChange = useCallback(
    (property: string, value: string) => setWidgetValue(property, value),
    [setWidgetValue],
  );

  const onColorChange = useCallback(
    (property: string, lchComponent: 'l' | 'c' | 'h') =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(
          event.currentTarget.value,
        );

        // Get current hex color from config using nested property access
        const currentHex =
          getNestedProperty<string>(configData, property) ??
          '#000000';

        const base = toHclChannels(currentHex);
        const channels = {
          h:
            (localValues[`${property}_h`] as number) ??
            base.h,
          c:
            (localValues[`${property}_c`] as number) ??
            base.c,
          l:
            (localValues[`${property}_l`] as number) ??
            base.l,
        };
        channels[lchComponent] = newValue;
        const newHex = hclChannelsToHex(
          channels,
          currentHex,
        );
        setWidgetValue(property, newHex, {
          [`${property}_h`]: channels.h,
          [`${property}_c`]: channels.c,
          [`${property}_l`]: channels.l,
        });
      },
    [configData, setWidgetValue, localValues],
  );

  const visualEditorWidgets: VisualEditorConfigEntry[] =
    useMemo(
      () =>
        Array.isArray(configData?.visualEditorWidgets)
          ? configData.visualEditorWidgets
          : [],
      [configData],
    );

  // Sync local values with config data when it changes (including remote updates)
  useEffect(() => {
    const newLocalValues: {
      [key: string]: number | boolean | string;
    } = {};
    visualEditorWidgets.forEach((widget) => {
      const value = getNestedProperty<
        string | number | boolean
      >(configData, widget.property);
      if (value !== undefined)
        newLocalValues[widget.property] = value;
      if (
        widget.type === 'color' &&
        typeof value === 'string'
      ) {
        const channels = toHclChannels(value);
        newLocalValues[`${widget.property}_h`] = channels.h;
        newLocalValues[`${widget.property}_c`] = channels.c;
        newLocalValues[`${widget.property}_l`] = channels.l;
      }
    });
    setLocalValues(newLocalValues);
  }, [configData, visualEditorWidgets]);

  const emptyReason = getVisualEditorEmptyReason(
    configFileId === null
      ? null
      : (files?.[configFileId]?.text ?? null),
  );
  if (emptyReason) {
    const hostUI =
      renderVisualEditorEmptyState?.(emptyReason);
    if (hostUI != null) return <>{hostUI}</>;
    const messages = {
      'missing-config':
        'To begin using the visual editor, create a config.json.',
      'invalid-config':
        'Your config.json file is not valid JSON.',
      'missing-widgets':
        'Add a visualEditorWidgets array to config.json.',
      'invalid-widgets':
        'Your visualEditorWidgets configuration is invalid.',
      'empty-widgets':
        'Add at least one widget to visualEditorWidgets.',
    };
    return <EmptyState>{messages[emptyReason]}</EmptyState>;
  }

  return (
    <div className="visual-editor">
      <header className="visual-properties-header">
        <div className="visual-properties-title">Visual Properties</div>
        <p className="visual-properties-hint">Changes appear in the preview automatically.</p>
      </header>
      <PropertySection title="Appearance">
      {visualEditorWidgets.map((widgetConfig, _index) => {
        if (widgetConfig.type === 'slider') {
          // Use local value if available, otherwise fall back to config value
          const currentValue =
            (localValues[
              widgetConfig.property
            ] as number) ??
            getNestedProperty<number>(
              configData,
              widgetConfig.property,
            ) ??
            widgetConfig.min;

          return (
            <SliderWidget
              key={widgetConfig.property}
              property={widgetConfig.property}
              label={widgetConfig.label}
              min={widgetConfig.min}
              max={widgetConfig.max}
              step={widgetConfig.step}
              currentValue={currentValue}
              onChange={onSliderChange(widgetConfig.property)}
              onNumberChange={(value) => setWidgetValue(widgetConfig.property, value)}
            />
          );
        } else if (widgetConfig.type === 'checkbox') {
          // Use local value if available, otherwise fall back to config value
          const currentValue =
            (localValues[
              widgetConfig.property
            ] as boolean) ??
            getNestedProperty<boolean>(
              configData,
              widgetConfig.property,
            ) ??
            false;

          return (
            <CheckboxWidget
              key={widgetConfig.property}
              property={widgetConfig.property}
              label={widgetConfig.label}
              currentValue={currentValue}
              onChange={onCheckboxChange(
                widgetConfig.property,
              )}
            />
          );
        } else if (widgetConfig.type === 'textInput') {
          // Use local value if available, otherwise fall back to config value
          const currentValue =
            (localValues[
              widgetConfig.property
            ] as string) ??
            getNestedProperty<string>(
              configData,
              widgetConfig.property,
            ) ??
            '';

          return (
            <TextInputWidget
              key={widgetConfig.property}
              property={widgetConfig.property}
              label={widgetConfig.label}
              currentValue={currentValue}
              onChange={onTextInputChange(
                widgetConfig.property,
              )}
            />
          );
        } else if (widgetConfig.type === 'dropdown') {
          // Use local value if available, otherwise fall back to config value
          const currentValue =
            (localValues[
              widgetConfig.property
            ] as string) ??
            getNestedProperty<string>(
              configData,
              widgetConfig.property,
            ) ??
            widgetConfig.options?.[0] ??
            '';
          return (
            <DropdownWidget
              key={widgetConfig.property}
              property={widgetConfig.property}
              label={widgetConfig.label}
              options={widgetConfig.options}
              currentValue={currentValue}
              onChange={(value) => onDropdownChange(widgetConfig.property, value)}
            />
          );
        } else if (widgetConfig.type === 'segmented') {
          const currentValue =
            (localValues[widgetConfig.property] as string) ??
            getNestedProperty<string>(configData, widgetConfig.property) ??
            widgetConfig.options[0] ?? '';
          return (
            <SegmentedWidget
              key={widgetConfig.property}
              label={widgetConfig.label}
              options={widgetConfig.options}
              currentValue={currentValue}
              onChange={(value) => onDropdownChange(widgetConfig.property, value)}
            />
          );
        } else if (widgetConfig.type === 'color') {
          // Use local value if available, otherwise fall back to config value
          const currentHex =
            (localValues[
              widgetConfig.property
            ] as string) ??
            getNestedProperty<string>(
              configData,
              widgetConfig.property,
            ) ??
            '#000000';

          const channels = toHclChannels(currentHex);
          const currentH = coerceChannelNumber(
            localValues[`${widgetConfig.property}_h`],
            channels.h,
          );
          const currentC = coerceChannelNumber(
            localValues[`${widgetConfig.property}_c`],
            channels.c,
          );
          const currentL = coerceChannelNumber(
            localValues[`${widgetConfig.property}_l`],
            channels.l,
          );

          return (
            <ColorWidget
              key={widgetConfig.property}
              property={widgetConfig.property}
              label={widgetConfig.label}
              currentHex={currentHex}
              currentH={currentH}
              currentC={currentC}
              currentL={currentL}
              onColorChange={onColorChange}
              onHexChange={onHexColorChange}
            />
          );
        }
      })}
      </PropertySection>
    </div>
  );
};
