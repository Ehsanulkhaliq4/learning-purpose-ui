import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PostService } from '../../../core/services/post.service';
import { BlogPost } from '../../../core/models/catalog.models';
import { AuthService } from '../../../core/services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-public-blog',
  imports: [DatePipe, RouterLink],
  templateUrl: './public-blog.html',
  styleUrl: './public-blog.css',
})
export class PublicBlog implements OnInit {
  private readonly postService = inject(PostService);
  private readonly route = inject(ActivatedRoute);
  readonly authService = inject(AuthService);
  readonly posts = signal<BlogPost[]>([]);
  readonly selectedPost = signal<BlogPost | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  handleRead(event: Event, postId: number): void {
    if (this.authService.isAuthenticated()) {
      return;
    }

    event.preventDefault();
    void Swal.fire({
      title: 'Sign in to keep learning',
      text: 'Please log in before reading community stories.',
      icon: 'info',
      confirmButtonText: 'Go to login',
      showCancelButton: true,
      cancelButtonText: 'Maybe later',
      reverseButtons: true,
      buttonsStyling: true,
      customClass: {
        popup: 'lp-swal-popup',
        title: 'lp-swal-title',
        htmlContainer: 'lp-swal-text',
        confirmButton: 'lp-swal-confirm',
        cancelButton: 'lp-swal-cancel',
      },
    }).then((result) => {
      if (result.isConfirmed) {
        window.location.href = `/auth/login?returnUrl=/explore/${postId}`;
      }
    });
  }

  ngOnInit(): void {
    const postId = Number(this.route.snapshot.paramMap.get('id'));
    if (postId) {
      this.postService.getPublicPostById(postId).subscribe({
        next: (post) => { this.selectedPost.set(post); this.isLoading.set(false); },
        error: (err) => { this.errorMessage.set(err?.error?.message || 'Unable to load this story.'); this.isLoading.set(false); },
      });
      return;
    }
    this.postService.getPublicPosts().subscribe({
      next: (page) => { this.posts.set(page.content); this.isLoading.set(false); },
      error: (err) => { this.errorMessage.set(err?.error?.message || 'Unable to load the latest stories.'); this.isLoading.set(false); },
    });
  }
}