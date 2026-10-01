export interface Video {
  id: number;
  title: string;
  description: string | null;
  objectName: string;
  contentType: string;
  fileSize: number;
  viewCount: number;
  likeCount: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoLikeResponse {
  videoId: number;
  liked: boolean;
}

export interface ConferenceRoomCreateRequest {
  roomId: string;
}

export interface ConferenceRoomCreateResponse {
  message: string;
  roomId: string;
  routerId: string;
}

export interface ConferenceParticipantJoinRequest {
  userId: string;
}

export interface ConferenceParticipantJoinResponse {
  message: string;
  roomId: string;
  userId: string;
}

export interface ConferenceTransportCreateRequest {
  userId: string;
  direction: 'recv' | 'send' | 'sendrecv';
}

export interface ConferenceTransportCreateResponse {
  message: string;
  transport: ConferenceTransport;
}

export interface ConferenceTransport {
  direction: 'recv' | 'send' | 'sendrecv';
  dtlsParameters: {
    fingerprints: Array<{ algorithm: string; value: string }>;
    role: string;
  };
  iceCandidates: Array<{
    address: string;
    foundation: string;
    ip?: string;
    port: number;
    priority: number;
    protocol: string;
    tcpType: string | null;
    type: string;
  }>;
  iceParameters: {
    iceLite: boolean;
    password: string;
    usernameFragment: string;
  };
  id: string;
}