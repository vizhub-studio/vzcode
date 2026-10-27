import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useContext,
} from 'react';
import { Modal, Form, Button } from '../ui';
import { VZCodeContext } from '../VZCodeContext';

export const CreateFileModal = ({
  initialFileName = '',
}) => {
  const [newName, setNewName] = useState(initialFileName);
  const inputRef = useRef(null);

  const {
    files,
    isCreateFileModalOpen,
    handleCloseCreateFileModal,
    handleCreateFileClick,
  } = useContext(VZCodeContext);

  useEffect(() => {
    if (isCreateFileModalOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreateFileModalOpen]);

  const handleNameChange = useCallback((event) => {
    setNewName(event.target.value);
  }, []);

  const onCreateClick = useCallback(() => {
    handleCreateFileClick(newName);
    setNewName('');
  }, [newName, handleCreateFileClick]);

  // Returns true if file name is valid, false otherwise.
  const validateFileName = useCallback(
    (fileName: string) => {
      let valid;
      //General Character Check
      const regex =
        /^[a-zA-Z0-9](?:[a-zA-Z0-9 ./+=_-]*[a-zA-Z0-9])?$/;
      valid = regex.test(fileName);

      //Check for Duplicate Filename
      for (const key in files) {
        if (fileName === files[key].name) {
          valid = false;
        }
      }

      return valid;
    },
    [files],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (
        e.key === 'Enter' &&
        validateFileName(newName) &&
        (e.ctrlKey ||
          e.shiftKey ||
          (!e.altKey && !e.metaKey))
      ) {
        onCreateClick();
      }
    },
    [onCreateClick, validateFileName, newName],
  );

  return isCreateFileModalOpen ? (
    <Modal
      show={isCreateFileModalOpen}
      onHide={handleCloseCreateFileModal}
      animation={false}
      onKeyDown={handleKeyDown}
    >
      <Modal.Header closeButton>
        <Modal.Title>Create File</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group controlId="fileName">
          <Form.Label>File Name</Form.Label>
          <Form.Control
            type="text"
            value={newName}
            onChange={handleNameChange}
            ref={inputRef}
            spellCheck="false"
          />
          <Form.Text>
            Enter the name for your file
          </Form.Text>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={onCreateClick}
          disabled={!validateFileName(newName)}
        >
          Create File
        </Button>
      </Modal.Footer>
    </Modal>
  ) : null;
};
