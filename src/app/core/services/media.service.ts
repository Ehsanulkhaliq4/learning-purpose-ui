import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ConferenceParticipantJoinResponse,
  ConferenceRoomCreateResponse,
  ConferenceTransportCreateResponse,
  Video,
  VideoLikeResponse,
} from '../models/media.models';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/v1/media';

  getVideos(): Observable<Video[]> { return this.http.get<Video[]>(`${this.apiUrl}/videos`); }

  uploadVideo(title: string, description: string, file: File): Observable<Video> {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('file', file, file.name);
    return this.http.post<Video>(`${this.apiUrl}/videos`, formData);
  }

  deleteVideo(id: number): Observable<void> { return this.http.delete<void>(`${this.apiUrl}/videos/${id}`); }
  recordView(id: number): Observable<void> { return this.http.post<void>(`${this.apiUrl}/videos/${id}/views`, {}); }
  toggleLike(id: number): Observable<VideoLikeResponse> { return this.http.post<VideoLikeResponse>(`${this.apiUrl}/videos/${id}/like`, {}); }
  getLikeStatus(id: number): Observable<{ liked: boolean }> { return this.http.get<{ liked: boolean }>(`${this.apiUrl}/videos/${id}/like-status`); }
  getStreamUrl(id: number): string { return `${this.apiUrl}/videos/${id}/stream`; }

  createConferenceRoom(roomId: string): Observable<ConferenceRoomCreateResponse> {
    return this.http.post<ConferenceRoomCreateResponse>(`${this.apiUrl}/conference/rooms`, { roomId });
  }

  joinConferenceParticipant(roomId: string, userId: string): Observable<ConferenceParticipantJoinResponse> {
    return this.http.post<ConferenceParticipantJoinResponse>(`${this.apiUrl}/conference/rooms/${roomId}/participants`, { userId });
  }

  createConferenceTransport(roomId: string, userId: string, direction: 'recv' | 'send' | 'sendrecv'): Observable<ConferenceTransportCreateResponse> {
    return this.http.post<ConferenceTransportCreateResponse>(`${this.apiUrl}/conference/rooms/${roomId}/transports`, {
      userId,
      direction,
    });
  }
}