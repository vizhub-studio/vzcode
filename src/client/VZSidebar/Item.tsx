import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useContext,
} from 'react';
import { ItemId } from '../../types';
import { EditSVG, TrashSVG } from '../Icons';
import { Tooltip, OverlayTrigger } from '../ui';
import { VZCodeContext } from '../VZCodeContext';
import { FileTypeIcon } from './FileTypeIcon';

// TODO consider moving this up to a higher level of the component tree
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

const enableRenameDirectory = true;

// A file or directory in the sidebar.
export const Item = ({
  id,
  name,
  children,
  handleClick,
  handleDoubleClick,
  handleRenameClick,
  handleDeleteClick,
  isDirectory = false,
  isActive = false,
  renameFileTooltipText = isDirectory
    ? 'Rename Directory'
    : 'Rename File',
  deleteFileTooltipText = isDirectory
    ? 'Delete Directory'
    : 'Delete File',
}: {
  id: ItemId;
  name: string;
  children: React.ReactNode;
  handleClick: (event: React.MouseEvent) => void;
  handleDoubleClick?: (event: React.MouseEvent) => void;
  handleRenameClick: (newName: string) => void;
  handleDeleteClick: () => void;
  isDirectory?: boolean;
  isActive?: boolean;
  renameFileTooltipText?: string;
  deleteFileTooltipText?: string;
}) => {
  const { hoveredItemId, setHoveredItemId } =
    useContext(VZCodeContext);
  // // Tracks whether the mouse is hovering over the file or directory
  // const [isHovered, setIsHovered] = useState(false);
  const isHovered = hoveredItemId === id;
  const setIsHovered = useCallback(
    (isHovered: boolean) => {
      if (isHovered) {
        setHoveredItemId(id);
      } else {
        setHoveredItemId(null);
      }
    },
    [id, setHoveredItemId],
  );

  // Tracks whether the file is being renamed (inline text input)
  const [isRenaming, setIsRenaming] = useState(false);

  // Tracks the value of the input field when renaming
  const [renameValue, setRenameValue] = useState('');

  // Tracks whether the delete confirmation modal is open
  const [showModal, setShowModal] = useState(false);

  // Ref to track the input DOM, so that we can focus and blur it
  const renameInputRef = useRef(null);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        setIsRenaming(false);
      } else if (event.key === 'Enter') {
        renameInputRef.current.blur();
      }
    },
    [],
  );

  const onBlur = useCallback(() => {
    setIsRenaming(false);
    if (renameInputRef.current.value.trim() === '') {
      // Renaming to empty signals deletion
      setShowModal(true);
    } else {
      handleRenameClick(renameInputRef.current.value);
    }
  }, [handleRenameClick]);

  const handleRenameIconClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setIsRenaming(!isRenaming);
      setRenameValue(name);
    },
    [name, isRenaming],
  );

  // Focus the input field when renaming
  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current.focus();
    }
  }, [isRenaming]);

  // Function to open the delete file confirmation modal
  const handleModalOpen = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setShowModal(true);
    },
    [],
  );

  // Function to close the modal
  const handleModalClose = useCallback(() => {
    setShowModal(false);
  }, []);

  // Function to handle confirmation on modal
  const handleConfirmModal = useCallback(
    (event: React.MouseEvent | undefined) => {
      // TODO clean this up.
      // This was added to prevent parent listeners from firing
      // when the modal is confirmed.
      event?.stopPropagation();
      setShowModal(false);
      handleDeleteClick();
    },
    [handleDeleteClick],
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, [setIsHovered]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, [setIsHovered]);

  const onChange = useCallback(() => {
    setRenameValue(renameInputRef.current.value);
  }, []);

  return (
    <div
      className={`file-or-directory ${
        isActive ? 'active-file' : ''
      }`}
      onClick={isRenaming ? null : handleClick}
      onDoubleClick={
        isRenaming || !handleDoubleClick
          ? null
          : handleDoubleClick
      }
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="name">
        {isRenaming ? (
          <>
            <FileTypeIcon name={renameValue} />
            <input
              className="rename-input"
              ref={renameInputRef}
              type="text"
              aria-label="Field name"
              value={renameValue}
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              onChange={onChange}
            />
          </>
        ) : (
          children
        )}
      </div>
      {isHovered && !isRenaming ? (
        <div
          className="utils"
          style={{ position: 'relative' }}
        >
          {(isDirectory ? enableRenameDirectory : true) ? (
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip id="rename-file-tooltip">
                  {renameFileTooltipText}
                </Tooltip>
              }
            >
              <i
                onClick={handleRenameIconClick}
                className="vz-icon-button"
              >
                <EditSVG />
              </i>
            </OverlayTrigger>
          ) : null}
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip id="delete-file-tooltip">
                {deleteFileTooltipText}
              </Tooltip>
            }
          >
            <i
              onClick={handleModalOpen}
              className="vz-icon-button"
            >
              <TrashSVG />
            </i>
          </OverlayTrigger>
        </div>
      ) : null}
      {/* TODO Move this up to a higher level of the tree */}
      {showModal && (
        <DeleteConfirmationModal
          show={showModal}
          onClose={handleModalClose}
          onConfirm={handleConfirmModal}
          isDirectory={isDirectory}
          name={name}
        />
      )}
    </div>
  );
};
