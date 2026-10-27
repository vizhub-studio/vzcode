import React, { useContext } from 'react';
import { Button, Modal, Form } from './ui';
import { VZCodeContext } from './VZCodeContext';

export const VZKeyboardShortcutsDoc = ({
  enableUsernameField: _enableUsernameField = true,
}: {
  // Feature flag to enable/disable username field
  enableUsernameField?: boolean;
}) => {
  const { isDocOpen, closeDoc } = useContext(VZCodeContext);

  return isDocOpen ? (
    <Modal
      className="vz-settings"
      show={isDocOpen}
      onHide={closeDoc}
      animation={false}
    >
      <Modal.Header closeButton>
        <Modal.Title>Keyboard Shortcuts</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group>
          <Form.Text>
            Keyboard shortcuts and interactive widgets for
            quick actions
          </Form.Text>
        </Form.Group>
        <Form.Group>
          {/* <Form.Label>WINDOWS</Form.Label> */}
          <ul>
            <li>
              <strong>
                <kbd>Ctrl</kbd> + <kbd>S</kbd>
              </strong>{' '}
              or{' '}
              <strong>
                <kbd>Shift↑</kbd> + <kbd>Enter←</kbd>
              </strong>{' '}
              <br />
              <span>Run and format code</span>
            </li>
            <li>
              <strong>
                <kbd>Alt</kbd> + Drag on a number
              </strong>
              <br />
              <span>
                Modify the number by dragging left or right
              </span>
            </li>
            <li>
              <strong>
                <kbd>Alt</kbd> + Click on a hex color
              </strong>
              <br />
              <span>
                Open a color picker to modify the color
              </span>
            </li>
            <li>
              <strong>
                <kbd>Alt</kbd> + <kbd>W</kbd>
              </strong>{' '}
              <br />
              <span>Close the current tab</span>
            </li>
            <li>
              <strong>
                <kbd>Alt</kbd> + <kbd>N</kbd>
              </strong>{' '}
              or{' '}
              <strong>
                <kbd>Ctrl</kbd> + <kbd>Shift↑</kbd> +{' '}
                <kbd>N</kbd>
              </strong>{' '}
              <br />
              <span>Open the create file modal</span>
            </li>
            <li>
              <strong>
                <kbd>Alt</kbd> + <kbd>PgUp↑</kbd>
              </strong>{' '}
              <br />
              <span>
                Change the active tab to the previous one
              </span>
            </li>
            <li>
              <strong>
                <kbd>Alt</kbd> + <kbd>PgDn↓</kbd>
              </strong>{' '}
              <br />
              <span>
                Change the active tab to the next one
              </span>
            </li>
            <li>
              <strong>Most VSCode Shortcuts</strong> <br />
              See VSCode docs:{' '}
              <a
                href="https://code.visualstudio.com/shortcuts/keyboard-shortcuts-windows.pdf"
                target="_blank"
              >
                Windows
              </a>
              ,{' '}
              <a
                href="https://code.visualstudio.com/shortcuts/keyboard-shortcuts-macos.pdf"
                target="_blank"
              >
                MacOS
              </a>
              ,{' '}
              <a
                href="https://code.visualstudio.com/shortcuts/keyboard-shortcuts-linux.pdf"
                target="_blank"
              >
                Linux
              </a>
            </li>
          </ul>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={closeDoc}>
          Done
        </Button>
      </Modal.Footer>
    </Modal>
  ) : null;
};
