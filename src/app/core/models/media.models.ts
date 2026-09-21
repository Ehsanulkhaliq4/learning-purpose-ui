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