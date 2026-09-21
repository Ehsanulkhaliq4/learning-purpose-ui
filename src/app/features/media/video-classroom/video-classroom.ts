import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MediaService } from '../../../core/services/media.service';
import { Video } from '../../../core/models/media.models';

@Component({
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  selector: 'app-video-classroom',
  styleUrl: './video-classroom.css',
  templateUrl: './video-classroom.html',
})
export class VideoClassroom implements OnInit {
  private readonly mediaService = inject(MediaService);
  private readonly fb = inject(FormBuilder);
  readonly videos = signal<Video[]>([]);
  readonly likedVideos = signal<Record<number, boolean>>({});
  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly selectedFile = signal<File | undefined>(undefined);
  readonly uploadForm = this.fb.nonNullable.group({ title: ['', Validators.required], description: [''] });

  ngOnInit(): void { this.loadVideos(); }

  loadVideos(): void {
    this.isLoading.set(true);
    this.mediaService.getVideos().subscribe({
      next: (videos) => {
        this.videos.set(videos);
        this.isLoading.set(false);
        videos.forEach((video) => this.mediaService.getLikeStatus(video.id).subscribe({
          next: (status) => this.likedVideos.update((likes) => ({ ...likes, [video.id]: status.liked })),
        }));
      },
      error: (error) => { this.errorMessage.set(error?.error?.message || 'Unable to load classroom videos.'); this.isLoading.set(false); },
    });
  }

  onFileSelected(event: Event): void { this.selectedFile.set((event.target as HTMLInputElement).files?.[0]); }

  upload(): void {
    const file = this.selectedFile();
    if (this.uploadForm.invalid || !file || this.isSubmitting()) { this.uploadForm.markAllAsTouched(); return; }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    const { title, description } = this.uploadForm.getRawValue();
    this.mediaService.uploadVideo(title, description, file).subscribe({
      next: (video) => {
        this.videos.update((videos) => [video, ...videos]);
        this.uploadForm.reset();
        this.selectedFile.set(undefined);
        this.isSubmitting.set(false);
        this.successMessage.set('Video uploaded successfully.');
      },
      error: (error) => { this.isSubmitting.set(false); this.errorMessage.set(error?.error?.message || 'Unable to upload this video.'); },
    });
  }

  recordView(video: Video): void {
    this.mediaService.recordView(video.id).subscribe({
      next: () => this.videos.update((videos) => videos.map((item) => item.id === video.id ? { ...item, viewCount: item.viewCount + 1 } : item)),
    });
  }

  toggleLike(video: Video): void {
    this.mediaService.toggleLike(video.id).subscribe({
      next: (result) => {
        this.likedVideos.update((likes) => ({ ...likes, [video.id]: result.liked }));
        this.videos.update((videos) => videos.map((item) => item.id === video.id ? { ...item, likeCount: item.likeCount + (result.liked ? 1 : -1) } : item));
      },
      error: (error) => this.errorMessage.set(error?.error?.message || 'Unable to update this like.'),
    });
  }

  deleteVideo(video: Video): void {
    if (!confirm(`Delete "${video.title}"?`)) return;
    this.mediaService.deleteVideo(video.id).subscribe({
      next: () => this.videos.update((videos) => videos.filter((item) => item.id !== video.id)),
      error: (error) => this.errorMessage.set(error?.error?.message || 'Unable to delete this video.'),
    });
  }

  isLiked(video: Video): boolean { return this.likedVideos()[video.id] === true; }
  streamUrl(video: Video): string { return this.mediaService.getStreamUrl(video.id); }
}
