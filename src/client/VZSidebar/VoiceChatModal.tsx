import {
  ParticipantLoop,
  ParticipantName,
  useParticipants,
  useRoomContext,
} from '@livekit/components-react';
import { useContext, useState } from 'react';
import { Button, Form, Modal } from '../ui';
import { v4 } from 'uuid';
import { VZCodeContext } from '../VZCodeContext';

export function VoiceChatModal() {
  const {
    liveKitRoomName,
    setLiveKitRoom,
    setLiveKitToken,
    liveKitConnection,
    setLiveKitConnection,
    voiceChatModalOpen,
    setVoiceChatModalOpen,
  } = useContext(VZCodeContext);
  const participants = useParticipants();

  const [roomName, setRoomName] = useState(
    liveKitRoomName || '',
  );
  const [username, setUsername] = useState('');
  const room = useRoomContext();

  const handleConnect = () => {
    if (liveKitConnection) {
      setLiveKitConnection(false);
      setLiveKitRoom(`${v4()}`);
      setLiveKitToken('');
      room.disconnect(true);
      return;
    }
    setLiveKitRoom(roomName);
    const fetchToken = async () => {
      try {
        const res = await fetch(
          `/livekit-token?room=${roomName}&username=${username}`,
          {
            method: 'GET',
          },
        );
        const tokenResponse = await res.text();
        setLiveKitToken(tokenResponse);
        setLiveKitConnection(true);
      } catch (error) {
        console.error('Error fetching token:', error);
      }
    };

    fetchToken();
  };

  const handleClose = () => {
    setVoiceChatModalOpen(false);
  };

  return (
    <Modal
      className="vz-settings"
      show={voiceChatModalOpen}
      onHide={handleClose}
      animation={false}
    >
      <Modal.Header closeButton>
        <Modal.Title>Connect to LiveKit Room</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group controlId="formRoomName">
            <Form.Label>Room Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter room name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
          </Form.Group>
        </Form>
        <Form>
          <Form.Group controlId="formUserName">
            <Form.Label>Username</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Form.Group>
        </Form>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <b>Users in Room: </b>
          <ParticipantLoop participants={participants}>
            <ParticipantName />
          </ParticipantLoop>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant={liveKitConnection ? 'danger' : 'primary'}
          onClick={handleConnect}
        >
          {liveKitConnection ? 'Disconnect' : 'Connect'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
