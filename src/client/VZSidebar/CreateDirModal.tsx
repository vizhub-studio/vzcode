import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useContext,
} from 'react';
import { Modal, Form, Button } from '../ui';
import { VZCodeContext } from '../VZCodeContext';

export const CreateDirModal = ({
  initialFileName = '',
}) => {
  const [newName, setNewName] = useState(initialFileName);
  const inputRef = useRef(null);

  const {
    files,
    isCreateDirModalOpen,
    handleCloseCreateDirModal,
    handleCreateDirClick,
  } = useContext(VZCodeContext);

  useEffect(() => {
    if (isCreateDirModalOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreateDirModalOpen]);

  const handleNameChange = useCallback((event) => {
    setNewName(event.target.value);
  }, []);

  const onCreateClick = useCallback(() => {
    handleCreateDirClick(newName);
    setNewName('');
  }, [newName, handleCreateDirClick]);

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
        if (fileName + '/' === files[key].name) {
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

  return isCreateDirModalOpen ? (
    <Modal
      show={isCreateDirModalOpen}
      onHide={handleCloseCreateDirModal}
      animation={false}
      onKeyDown={handleKeyDown}
    >
      <Modal.Header closeButton>
        <Modal.Title>Create Directory</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3" controlId="fileName">
          <Form.Label>Directory Name</Form.Label>
          <Form.Control
            type="text"
            value={newName}
            onChange={handleNameChange}
            ref={inputRef}
            spellCheck="false"
          />
          <Form.Text className="text-muted">
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
          Create Directory
        </Button>
      </Modal.Footer>
    </Modal>
  ) : null;
};
