import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BlogPost, CommentRequest, PostComment, PostPage, PostRequest } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class PostService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:8080/api/v1/posts';

  createPost(post: PostRequest, image?: File): Observable<BlogPost> {
    const formData = new FormData();
    formData.append(
      'post',
      new Blob([JSON.stringify(post)], { type: 'application/json' }),
    );

    if (image) {
      formData.append('image', image, image.name);
    }

    return this.http.post<BlogPost>(this.API_URL, formData);
  }

  getAllPosts(page = 0, size = 10): Observable<PostPage> {
    return this.http.get<PostPage>(this.API_URL, { params: { page, size } });
  }

  getPostById(id: number): Observable<BlogPost> {
    return this.http.get<BlogPost>(`${this.API_URL}/${id}`);
  }

  searchPosts(query: string): Observable<BlogPost[]> {
    return this.http.get<BlogPost[]>(`${this.API_URL}/search`, { params: { query } });
  }

  createComment(comment: CommentRequest): Observable<PostComment> {
    return this.http.post<PostComment>('http://localhost:8080/api/v1/comments', comment);
  }

  getCommentsByPost(postId: number): Observable<PostComment[]> {
    return this.http.get<PostComment[]>(`http://localhost:8080/api/v1/comments/post/${postId}`);
  }

  deleteComment(id: number): Observable<void> {
    return this.http.delete<void>(`http://localhost:8080/api/v1/comments/${id}`);
  }

  likePost(id: number): Observable<void> {
    return this.http.put<void>(`${this.API_URL}/${id}/like`, null);
  }

  deletePost(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }
}