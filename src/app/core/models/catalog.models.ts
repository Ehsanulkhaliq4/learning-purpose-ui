export interface VideoLecture {
  id: number;
  title: string;
  description: string;
  subject: string;
  contentType: string;
  fileSizeBytes: number;
  durationSeconds: number;
  uploadedBy: string;
  thumbnailUrl: string;
  streamUrl: string;
}

export interface BookItem {
  id: number;
  title: string;
  author: string;
  postedDate: string;
  contentType: string;
  description: string;
  coverImageUrl: string;
  pdfDownloadUrl: string;
}

export interface BlogPost {
  id: number;
  name: string;
  content: string;
  postedBy: string;
  imageUrl?: string;
  viewCount: number;
  likeCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  commentCount: number;
}

export interface PostRequest {
  name: string;
  content: string;
  postedBy: string;
  tags: string[];
}

export interface PostPage {
  content: BlogPost[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  last: boolean;
}