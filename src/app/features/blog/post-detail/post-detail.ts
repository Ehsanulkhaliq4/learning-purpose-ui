import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PostService } from '../../../core/services/post.service';
import { BlogPost } from '../../../core/models/catalog.models';

@Component({
  selector: 'app-post-detail',
  imports: [DatePipe, RouterLink],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.css',
})
export class PostDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly postService = inject(PostService);

  readonly post = signal<BlogPost | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.errorMessage.set('This post could not be found.');
      this.isLoading.set(false);
      return;
    }
    this.postService.getPostById(id).subscribe({
      next: (post) => { this.post.set(post); this.isLoading.set(false); },
      error: (err) => { this.errorMessage.set(err?.error?.message || 'Unable to load this post.'); this.isLoading.set(false); },
    });
  }
}
