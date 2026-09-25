import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MediaService } from '../../../core/services/media.service';
import { Video } from '../../../core/models/media.models';
import Swal from 'sweetalert2';

@Component({
  imports: [DatePipe, FormsModule, RouterLink],
  selector: 'app-video-classroom',
  styleUrl: './video-classroom.css',
  templateUrl: './video-classroom.html',
})
export class VideoClassroom implements OnInit {
  private readonly mediaService = inject(MediaService);
  readonly videos = signal<Video[]>([]);
  readonly searchTerm = signal('');
  readonly filteredVideos = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.videos();
    return this.videos().filter(v =>
      v.title.toLowerCase().includes(term) ||
      (v.description && v.description.toLowerCase().includes(term))
    );
  });
  readonly likedVideos = signal<Record<number, boolean>>({});
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadVideos();
  }

  loadVideos(): void {
    this.isLoading.set(true);
    this.mediaService.getVideos().subscribe({
      next: (videos) => {
        this.videos.set(videos);
        this.isLoading.set(false);
        videos.forEach((video) =>
          this.mediaService.getLikeStatus(video.id).subscribe({
            next: (status) =>
              this.likedVideos.update((likes) => ({ ...likes, [video.id]: status.liked })),
          })
        );
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message || 'Unable to load classroom videos.');
        this.isLoading.set(false);
      },
    });
  }

  recordView(video: Video): void {
    this.mediaService.recordView(video.id).subscribe({
      next: () =>
        this.videos.update((videos) =>
          videos.map((item) =>
            item.id === video.id ? { ...item, viewCount: item.viewCount + 1 } : item
          )
        ),
    });
  }

  toggleLike(video: Video): void {
    this.mediaService.toggleLike(video.id).subscribe({
      next: (result) => {
        this.likedVideos.update((likes) => ({ ...likes, [video.id]: result.liked }));
        this.videos.update((videos) =>
          videos.map((item) =>
            item.id === video.id
              ? { ...item, likeCount: item.likeCount + (result.liked ? 1 : -1) }
              : item
          )
        );
      },
      error: (error) =>
        this.errorMessage.set(error?.error?.message || 'Unable to update like.'),
    });
  }

  deleteVideo(video: Video): void {
    void Swal.fire({
      title: 'Delete this video?',
      text: `"${video.title}" will be permanently removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete video',
      cancelButtonText: 'Keep video',
      reverseButtons: true,
      buttonsStyling: true,
      customClass: { confirmButton: 'lp-swal-danger', cancelButton: 'lp-swal-cancel' },
    }).then((result) => {
      if (!result.isConfirmed) return;
      this.mediaService.deleteVideo(video.id).subscribe({
        next: () =>
          this.videos.update((videos) => videos.filter((item) => item.id !== video.id)),
        error: (error) =>
          this.errorMessage.set(error?.error?.message || 'Unable to delete this video.'),
      });
    });
  }

  isLiked(video: Video): boolean {
    return this.likedVideos()[video.id] === true;
  }

  streamUrl(video: Video): string {
    return this.mediaService.getStreamUrl(video.id);
  }
}
