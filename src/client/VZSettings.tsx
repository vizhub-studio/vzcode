import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button, Modal, Form } from './ui';
import { ThemeLabel, themes } from './themes';
import { VZCodeContext } from './VZCodeContext';

const DEBUG = false;

// Font size options for the editor
const fontSizes = [
  '10px',
  '12px',
  '14px',
  '16px',
  '18px',
  '20px',
  '24px',
];

// List of system fonts to be detected for availability
const systemFonts = [
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'Helvetica Neue',
  'Arial',
  'sans-serif',
  'Courier New',
  'Georgia',
  'Tahoma',
  'Verdana',
  'Times New Roman',
  'Trebuchet MS',
  'Comic Sans MS',
];

// Utility function to detect if a given font is available
const isFontAvailable = (font: string): boolean => {
  const testString = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const testSize = '72px';

  const span = document.createElement('span');
  span.style.fontSize = testSize;
  span.style.visibility = 'hidden';
  span.style.position = 'absolute';
  span.innerHTML = testString;
  document.body.appendChild(span);

  const defaultFont = 'monospace';
  span.style.fontFamily = defaultFont;
  const defaultWidth = span.offsetWidth;

  span.style.fontFamily = `${font}, ${defaultFont}`;
  const newWidth = span.offsetWidth;

  document.body.removeChild(span);

  return newWidth !== defaultWidth;
};

export const VZSettings = ({
  enableUsernameField = true,
}: {
  enableUsernameField?: boolean;
}) => {
  // Extracting context values for managing settings state
  const {
    isSettingsOpen,
    closeSettings,
    theme,
    setTheme,
    username,
    setUsername,
    sidebarRef,
  } = useContext(VZCodeContext);

  // State variables for managing font and font size
  const [selectedFont, setSelectedFont] =
    useState('Roboto Mono');
  const [selectedFontSize, setSelectedFontSize] =
    useState('16px');
  const [availableFonts, setAvailableFonts] = useState<
    string[]
  >([]);

  // Load saved settings from local storage on initial render
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const selectedFontFromLocalStorage =
        window.localStorage.getItem('vzcodeSelectedFont');
      const selectedFontSizeFromLocalStorage =
        window.localStorage.getItem(
          'vzcodeSelectedFontSize',
        );

      if (selectedFontFromLocalStorage !== null) {
        setSelectedFont(selectedFontFromLocalStorage);
      }
      if (selectedFontSizeFromLocalStorage !== null) {
        setSelectedFontSize(
          selectedFontSizeFromLocalStorage,
        );
      }
    }
  }, []);

  // Detect available system fonts and update the state
  useEffect(() => {
    const detectFonts = () => {
      const detectedFonts: string[] = [];
      for (const font of systemFonts) {
        if (isFontAvailable(font)) {
          detectedFonts.push(font);
          if (DEBUG) {
            console.log(`${font} is available`);
          }
        } else if (DEBUG) {
          console.log(`${font} is not available`);
        }
      }
      setAvailableFonts(detectedFonts);
    };

    detectFonts();
  }, []);

  // Reset all settings to default values
  const resetSettings = useCallback(() => {
    setSelectedFont('Roboto Mono');
    setSelectedFontSize('16px');
    setTheme(themes[0].label);
    if (enableUsernameField) {
      setUsername('');
    }
    localStorage.removeItem('vzcodeSelectedFont');
    localStorage.removeItem('vzcodeSelectedFontSize');
  }, [enableUsernameField, setTheme, setUsername]);

  // Update font family in the document's style
  useEffect(() => {
    sidebarRef.current
      ?.closest<HTMLElement>('.app')
      ?.style.setProperty(
        '--vzcode-font-family',
        selectedFont,
      );
  }, [selectedFont, sidebarRef]);

  // Update font size in the document's style
  useEffect(() => {
    sidebarRef.current
      ?.closest<HTMLElement>('.app')
      ?.style.setProperty(
        '--vzcode-font-size',
        selectedFontSize,
      );
  }, [selectedFontSize, sidebarRef]);

  const usernameRef = useRef<HTMLInputElement>(null);

  // Handle username input change
  const handleUsernameChange = useCallback(() => {
    setUsername(usernameRef.current?.value || '');
  }, [setUsername]);

  // Close settings modal on Enter key press
  useEffect(() => {
    if (isSettingsOpen) {
      const handleEnterKey = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          closeSettings();
        }
      };

      window.addEventListener('keydown', handleEnterKey);
      return () => {
        window.removeEventListener(
          'keydown',
          handleEnterKey,
        );
      };
    }
  }, [isSettingsOpen, closeSettings]);

  return isSettingsOpen ? (
    <Modal
      className="vz-settings"
      show={isSettingsOpen}
      onHide={closeSettings}
      animation={false}
    >
      <Modal.Header closeButton>
        <Modal.Title>Editor Settings</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {enableUsernameField ? (
          <Form.Group controlId="vz-settings-username">
            <Form.Label>Username</Form.Label>
            <Form.Control
              type="text"
              ref={usernameRef}
              onChange={handleUsernameChange}
              placeholder="Enter username"
              value={username}
            />
            <Form.Text>
              Enter a username to be displayed on your
              cursor
            </Form.Text>
          </Form.Group>
        ) : null}

        <Form.Group controlId="vz-settings-theme">
          <Form.Label>Theme</Form.Label>
          <select
            id="vz-settings-theme"
            className="vz-ui-select"
            value={theme}
            onChange={(e) =>
              setTheme(e.target.value as ThemeLabel)
            }
          >
            {themes.map(({ label }) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </Form.Group>

        <Form.Group controlId="vz-settings-font">
          <Form.Label>Font</Form.Label>
          <select
            id="vz-settings-font"
            className="vz-ui-select"
            onChange={(e) =>
              setSelectedFont(e.target.value)
            }
            value={selectedFont}
          >
            {availableFonts.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </Form.Group>

        <Form.Group controlId="vz-settings-size">
          <Form.Label>Font Size</Form.Label>
          <select
            id="vz-settings-size"
            className="vz-ui-select"
            onChange={(e) =>
              setSelectedFontSize(e.target.value)
            }
            value={selectedFontSize}
          >
            {fontSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={resetSettings}>
          Reset to Default
        </Button>
        <Button variant="primary" onClick={closeSettings}>
          Done
        </Button>
      </Modal.Footer>
    </Modal>
  ) : null;
};
