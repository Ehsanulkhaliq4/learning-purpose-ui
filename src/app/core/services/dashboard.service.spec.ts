import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DashboardService } from './dashboard.service';
import {
  CreateActivityRequest,
  DashboardResponse,
  LogStudyTimeRequest,
  UpdateResumeItemRequest,
} from '../models/dashboard.models';

describe('DashboardService', () => {
  let service: DashboardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch user dashboard with specific userId and anti-cache timestamp param', () => {
    const mockResponse: DashboardResponse = {
      todayFocus: null,
      studyRhythm: null,
      learningStreak: { mainValue: '5', unit: 'days', caption: '+1', isPositiveTrend: true },
      completedLessons: null,
      assessmentScore: null,
      studyTime: null,
      weeklyTarget: null,
      recentActivities: [],
      resumeItems: [],
      nextMilestone: null,
    };

    service.getDashboard(42).subscribe((res) => {
      expect(res.learningStreak?.mainValue).toBe('5');
    });

    const req = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/v1/users/dashboard/42');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('t')).toBe(true);
    req.flush(mockResponse);
  });

  it('should fetch /me when userId is omitted or null', () => {
    service.getDashboard().subscribe();
    const req1 = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/v1/users/dashboard/me');
    expect(req1.request.method).toBe('GET');
    expect(req1.request.params.has('t')).toBe(true);
    req1.flush({});

    service.getMyDashboard().subscribe();
    const req2 = httpMock.expectOne((r) => r.url === 'http://localhost:8080/api/v1/users/dashboard/me');
    expect(req2.request.method).toBe('GET');
    expect(req2.request.params.has('t')).toBe(true);
    req2.flush({});
  });

  it('should post new activity', () => {
    const body: CreateActivityRequest = {
      title: 'Watched Video',
      subtitle: 'Angular 22 signals',
      actionType: 'MEDIA_WATCHED',
      statusColor: 'sky',
    };

    service.logActivity(42, body).subscribe((act) => {
      expect(act.title).toBe('Watched Video');
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/users/dashboard/42/activities');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: '101', title: 'Watched Video', timeAgo: 'Just now' });
  });

  it('should post study time', () => {
    const body: LogStudyTimeRequest = {
      hours: 1.5,
      studyDate: '2026-11-02',
    };

    service.logStudyTime(42, body).subscribe((bar) => {
      expect(bar.hours).toBe(1.5);
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/users/dashboard/42/study-rhythm');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ dayOfWeek: 'M', hours: 1.5 });
  });

  it('should post resume item update', () => {
    const body: UpdateResumeItemRequest = {
      itemType: 'QUIZ',
      referenceId: 88,
      title: 'Algorithms',
      progressPercentage: 80,
    };

    service.updateResumeItem(42, body).subscribe((item) => {
      expect(item.progressPercentage).toBe(80);
    });

    const req = httpMock.expectOne('http://localhost:8080/api/v1/users/dashboard/42/resume-items');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ type: 'QUIZ', title: 'Algorithms', progressPercentage: 80 });
  });
});
