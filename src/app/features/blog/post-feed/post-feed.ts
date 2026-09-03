import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PostService } from '../../../core/services/post.service';
import { BlogPost } from '../../../core/models/catalog.models';

@Component({ selector: 'app-post-feed', imports: [DatePipe, RouterLink], styleUrl: './post-feed.css', templateUrl: './post-feed.html' })
export class PostFeed implements OnInit {
  private readonly postService = inject(PostService);
  readonly posts = signal<BlogPost[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly searchTerm = signal('');

  ngOnInit(): void { this.loadPosts(); }

  loadPosts(): void {
    this.isLoading.set(true);
    this.postService.getAllPosts().subscribe({
      next: (page) => { this.posts.set(page.content); this.isLoading.set(false); },
      error: (err) => { this.errorMessage.set(err?.error?.message || 'Unable to load posts.'); this.isLoading.set(false); },
    });
  }

  search(): void {
    const query = this.searchTerm().trim();
    if (!query) { this.loadPosts(); return; }
    this.isLoading.set(true);
    this.postService.searchPosts(query).subscribe({
      next: (posts) => { this.posts.set(posts); this.isLoading.set(false); },
      error: (err) => { this.errorMessage.set(err?.error?.message || 'Unable to search posts.'); this.isLoading.set(false); },
    });
  }

  likePost(post: BlogPost): void {
    this.postService.likePost(post.id).subscribe({
      next: () => this.posts.update((posts) => posts.map((item) => item.id === post.id ? { ...item, likeCount: item.likeCount + 1 } : item)),
      error: (err) => this.errorMessage.set(err?.error?.message || 'Unable to like this post.'),
    });
  }

  deletePost(post: BlogPost): void {
    if (!confirm(`Delete "${post.name}"?`)) return;
    this.postService.deletePost(post.id).subscribe({
      next: () => this.posts.update((posts) => posts.filter((item) => item.id !== post.id)),
      error: (err) => this.errorMessage.set(err?.error?.message || 'Unable to delete this post.'),
    });
  }
}
