import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PostService } from '../../../core/services/post.service';
import { BlogPost, PostComment } from '../../../core/models/catalog.models';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-post-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './post-detail.html',
  styleUrl: './post-detail.css',
})
export class PostDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly authService = inject(AuthService);
  private readonly postService = inject(PostService);
  private readonly router = inject(Router);

  readonly post = signal<BlogPost | null>(null);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly commentError = signal<string | null>(null);
  readonly commentSuccess = signal<string | null>(null);
  readonly comments = signal<PostComment[]>([]);
  readonly isDiscussionOpen = signal(false);
  readonly areCommentsLoading = signal(false);
  readonly deletingCommentId = signal<number | null>(null);
  private commentsLoadedForPostId: number | null = null;
  readonly isCommenting = signal(false);
  readonly commentForm = this.fb.nonNullable.group({
    content: ['', [Validators.required, Validators.maxLength(1000)]],
  });

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

  toggleDiscussion(postId: number): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }
    const isOpening = !this.isDiscussionOpen();
    this.isDiscussionOpen.set(isOpening);
    if (isOpening && this.commentsLoadedForPostId !== postId) {
      this.loadComments(postId);
    }
  }

  private loadComments(postId: number): void {
    this.areCommentsLoading.set(true);
    this.postService.getCommentsByPost(postId).subscribe({
      next: (comments) => {
        this.comments.set(comments);
        this.commentsLoadedForPostId = postId;
        this.areCommentsLoading.set(false);
      },
      error: (err) => {
        this.areCommentsLoading.set(false);
        this.commentError.set(err?.error?.message || 'Unable to load comments.');
      },
    });
  }

  isCommentInvalid(): boolean {
    const control = this.commentForm.controls.content;
    return control.invalid && (control.dirty || control.touched);
  }

  submitComment(postId: number): void {
    if (this.commentForm.invalid || this.isCommenting()) {
      this.commentForm.markAllAsTouched();
      return;
    }

    const postedBy = this.authService.currentUser()?.username;
    if (!postedBy) {
      this.commentError.set('Please sign in before joining the discussion.');
      return;
    }

    this.isCommenting.set(true);
    this.commentError.set(null);
    this.commentSuccess.set(null);
    this.postService.createComment({ postId, content: this.commentForm.controls.content.value.trim(), postedBy }).subscribe({
      next: (comment) => {
        this.comments.update((comments) => [...comments, comment]);
        this.commentForm.reset();
        this.isCommenting.set(false);
        this.commentSuccess.set('Your comment has been added.');
      },
      error: (err) => {
        this.isCommenting.set(false);
        this.commentError.set(err?.error?.message || 'Unable to add your comment. Please try again.');
      },
    });
  }

  canDeleteComment(comment: PostComment): boolean {
    return comment.id !== undefined && comment.postedBy === this.authService.currentUser()?.username;
  }

  deleteComment(comment: PostComment): void {
    if (comment.id === undefined || this.deletingCommentId()) {
      return;
    }

    this.deletingCommentId.set(comment.id);
    this.commentError.set(null);
    this.postService.deleteComment(comment.id).subscribe({
      next: () => {
        this.deletingCommentId.set(null);
        this.comments.update((comments) => comments.filter((c) => c.id !== comment.id));
        this.commentSuccess.set('Comment deleted.');
      },
      error: (err) => {
        this.deletingCommentId.set(null);
        this.commentError.set(err?.error?.message || 'Unable to delete comment.');
      }
    });

  }

  deletePost(post: BlogPost): void {
    void Swal.fire({
      title: 'Delete this post?',
      text: `"${post.name}" will be permanently removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete post',
      cancelButtonText: 'Keep post',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: { confirmButton: 'lp-swal-danger', cancelButton: 'lp-swal-cancel' },
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.postService.deletePost(post.id).subscribe({
        next: () => this.router.navigate(['/blog']),
        error: (err) => this.errorMessage.set(err?.error?.message || 'Unable to delete this post.'),
      });
    });
  }
}
