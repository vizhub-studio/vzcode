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
import { color, hcl, HCLColor, rgb } from 'd3-color';
import { CONFIG_FILE_NAME } from './constants';
import { SliderWidget } from './SliderWidget';
import { CheckboxWidget } from './CheckboxWidget';
import { TextInputWidget } from './TextInputWidget';
import { DropdownWidget } from './DropdownWidget';
import { ColorWidget } from './ColorWidget';
import {
  getNestedProperty,
  setNestedProperty,
} from './utils';

export const VisualEditor = () => {
  const { files, submitOperation } =
    useContext(VZCodeContext);

  // Local state to track widget values during user interaction
  const [localValues, setLocalValues] = useState<{
    [key: string]: number | boolean | string;
  }>({});

  // State to track which dropdown is open
  const [openDropdown, setOpenDropdown] = useState<
    string | null
  >(null);

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

  const onSliderChange = useCallback(
    (property: string) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseFloat(
          event.currentTarget.value,
        );

        // Update local state immediately for responsive UI
        setLocalValues((prev) => ({
          ...prev,
          [property]: newValue,
        }));

        // Update config.json with support for nested properties
        const newConfigData = setNestedProperty(
          configData,
          property,
          newValue,
        );

        submitOperation((document: VizContent) => ({
          ...document,
          files: {
            ...files,
            [configFileId]: {
              name: 'config.json',
              text: JSON.stringify(newConfigData, null, 2),
            },
          },
        }));
      },
    [configData, files, configFileId, submitOperation],
  );

  const onCheckboxChange = useCallback(
    (property: string) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.currentTarget.checked;

        // Update local state immediately for responsive UI
        setLocalValues((prev) => ({
          ...prev,
          [property]: newValue,
        }));

        // Update config.json with support for nested properties
        const newConfigData = setNestedProperty(
          configData,
          property,
          newValue,
        );

        submitOperation((document: VizContent) => ({
          ...document,
          files: {
            ...files,
            [configFileId]: {
              name: 'config.json',
              text: JSON.stringify(newConfigData, null, 2),
            },
          },
        }));
      },
    [configData, files, configFileId, submitOperation],
  );

  const onTextInputChange = useCallback(
    (property: string) =>
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.currentTarget.value;

        // Update local state immediately for responsive UI
        setLocalValues((prev) => ({
          ...prev,
          [property]: newValue,
        }));

        // Update config.json with support for nested properties
        const newConfigData = setNestedProperty(
          configData,
          property,
          newValue,
        );

        submitOperation((document: VizContent) => ({
          ...document,
          files: {
            ...files,
            [configFileId]: {
              name: 'config.json',
              text: JSON.stringify(newConfigData, null, 2),
            },
          },
        }));
      },
    [configData, files, configFileId, submitOperation],
  );

  const onDropdownChange = useCallback(
    (property: string, newValue: string) => {
      // Update local state immediately for responsive UI
      setLocalValues((prev) => ({
        ...prev,
        [property]: newValue,
      }));

      // Update config.json with support for nested properties
      const newConfigData = setNestedProperty(
        configData,
        property,
        newValue,
      );

      submitOperation((document: VizContent) => ({
        ...document,
        files: {
          ...files,
          [configFileId]: {
            name: 'config.json',
            text: JSON.stringify(newConfigData, null, 2),
          },
        },
      }));
    },
    [configData, files, configFileId, submitOperation],
  );

  // Custom dropdown handlers
  const handleDropdownToggle = useCallback(
    (property: string) => {
      setOpenDropdown((prev) =>
        prev === property ? null : property,
      );
    },
    [],
  );

  const handleDropdownOptionClick = useCallback(
    (property: string, value: string) => {
      onDropdownChange(property, value);
      setOpenDropdown(null);
    },
    [onDropdownChange],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown) {
        const target = event.target as Element;
        if (!target.closest('.visual-editor-dropdown')) {
          setOpenDropdown(null);
        }
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside,
    );
    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      );
    };
  }, [openDropdown]);

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

        // Convert current hex to LCH
        let hclFromRGB: HCLColor;
        try {
          const rgbColor = rgb(currentHex);
          hclFromRGB = hcl(rgbColor);
        } catch {
          // Fallback to black if conversion fails
          hclFromRGB = hcl('black');
        }

        const hclArray: number[] = [
          (localValues[`${property}_h`] as number) ??
            hclFromRGB.h,
          (localValues[`${property}_c`] as number) ??
            hclFromRGB.c,
          (localValues[`${property}_l`] as number) ??
            hclFromRGB.l,
        ];

        // Update the specific LCH component
        const newhcl = [...hclArray];
        if (lchComponent === 'h') newhcl[0] = newValue;
        else if (lchComponent === 'c') newhcl[1] = newValue;
        else if (lchComponent === 'l') newhcl[2] = newValue;

        // Convert back to hex
        let newHex;
        try {
          const newColor = hcl(
            newhcl[0],
            newhcl[1],
            newhcl[2],
          );

          if (newColor.displayable()) {
            newHex = newColor.formatHex();
          } else {
            newHex = currentHex;
          }
        } catch {
          // Fallback to current color if conversion fails
          newHex = currentHex;
        }

        // Update local state for responsive UI
        setLocalValues((prev) => ({
          ...prev,
          [property]: newHex,
          [`${property}_h`]: newhcl[0],
          [`${property}_c`]: newhcl[1],
          [`${property}_l`]: newhcl[2],
        }));

        // Update config.json with hex value using nested property access
        const newConfigData = setNestedProperty(
          configData,
          property,
          newHex,
        );

        submitOperation((document: VizContent) => ({
          ...document,
          files: {
            ...files,
            [configFileId]: {
              name: 'config.json',
              text: JSON.stringify(newConfigData, null, 2),
            },
          },
        }));
      },
    [
      configData,
      files,
      configFileId,
      submitOperation,
      localValues,
    ],
  );

  const visualEditorWidgets: VisualEditorConfigEntry[] =
    useMemo(
      () => configData?.visualEditorWidgets ?? [],
      [configData],
    );

  // Sync local values with config data when it changes (including remote updates)
  useEffect(() => {
    const newLocalValues: {
      [key: string]: number | boolean | string;
    } = {};
    visualEditorWidgets.forEach((widget) => {
      if (widget.type === 'slider') {
        newLocalValues[widget.property] = getNestedProperty(
          configData,
          widget.property,
        );
      } else if (widget.type === 'checkbox') {
        newLocalValues[widget.property] = getNestedProperty(
          configData,
          widget.property,
        );
      } else if (widget.type === 'textInput') {
        newLocalValues[widget.property] = getNestedProperty(
          configData,
          widget.property,
        );
      } else if (widget.type === 'dropdown') {
        newLocalValues[widget.property] = getNestedProperty(
          configData,
          widget.property,
        );
      } else if (widget.type === 'color') {
        newLocalValues[widget.property] = getNestedProperty(
          configData,
          widget.property,
        );

        // Convert hex to LCH for internal state
        const hexColor = getNestedProperty<string>(
          configData,
          widget.property,
        );

        if (localValues[widget.property] !== hexColor) {
          if (hexColor) {
            try {
              const rgbColor = color(hexColor);
              const lch = hcl(rgbColor);
              newLocalValues[`${widget.property}_h`] =
                lch.h;
              newLocalValues[`${widget.property}_c`] =
                lch.c;
              newLocalValues[`${widget.property}_l`] =
                lch.l;
            } catch {
              // Fallback values if conversion fails
              newLocalValues[`${widget.property}_l`] = 0;
              newLocalValues[`${widget.property}_c`] = 0;
              newLocalValues[`${widget.property}_h`] = 0;
            }
          }
        }
      }
    });
    setLocalValues(newLocalValues);
  }, [configData, localValues, visualEditorWidgets]);

  if (configFileId === null) {
    return (
      <EmptyState>
        To begin using the visual editor, create a
        config.json.
      </EmptyState>
    );
  }

  if (!configData) {
    return (
      <EmptyState>
        Your config.json file is not valid json.
      </EmptyState>
    );
  }

  if (
    configData &&
    !('visualEditorWidgets' in configData)
  ) {
    return (
      <EmptyState>
        To begin using the visual editor, make sure your
        config.json has a key called
        &quot;visualEditorWidgets&quot;, whose value is the
        config for the visual editor.
      </EmptyState>
    );
  }

  if (
    configData &&
    !Array.isArray(configData.visualEditorWidgets)
  ) {
    return (
      <EmptyState>
        Your config.json file has
        &quot;visualEditorWidgets&quot; but it is not an
        array. Please make sure
        &quot;visualEditorWidgets&quot; is an array of
        widget configurations.
      </EmptyState>
    );
  }

  return (
    <div className="visual-editor">
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
              onChange={onSliderChange(
                widgetConfig.property,
              )}
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
          const isOpen =
            openDropdown === widgetConfig.property;

          return (
            <DropdownWidget
              key={widgetConfig.property}
              property={widgetConfig.property}
              label={widgetConfig.label}
              options={widgetConfig.options}
              currentValue={currentValue}
              isOpen={isOpen}
              onToggle={() =>
                handleDropdownToggle(widgetConfig.property)
              }
              onOptionClick={(value) =>
                handleDropdownOptionClick(
                  widgetConfig.property,
                  value,
                )
              }
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

          // Convert hex to LCH for slider values
          let hclColor;
          try {
            const rgbColor = color(currentHex);
            hclColor = hcl(rgbColor);
          } catch {
            hclColor = hcl('black');
          }

          // Use local LCH values if available, otherwise convert from hex
          const currentH =
            localValues[`${widgetConfig.property}_h`] ??
            hclColor.h;
          const currentC =
            localValues[`${widgetConfig.property}_c`] ??
            hclColor.c;
          const currentL =
            localValues[`${widgetConfig.property}_l`] ??
            hclColor.l;

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
            />
          );
        }
      })}
    </div>
  );
};
