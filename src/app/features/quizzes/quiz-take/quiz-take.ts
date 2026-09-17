import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { QuizService } from '../../../core/services/quiz.service';
import { ExamSubmission, Question, QuizEvaluationResult } from '../../../core/models/quiz.models';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

@Component({
  imports: [DecimalPipe, RouterLink],
  selector: 'app-quiz-take',
  styleUrl: './quiz-take.css',
  templateUrl: './quiz-take.html',
})
export class QuizTake {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly quizService = inject(QuizService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private timerId?: ReturnType<typeof setInterval>;

  readonly quizId = signal<number>(0);
  readonly questions = signal<Question[]>([]);
  readonly currentQuestionIndex = signal<number>(0);
  readonly selectedAnswers = signal<Map<number, string>>(new Map());
  readonly isSubmitted = signal<boolean>(false);
  readonly result = signal<QuizEvaluationResult | null>(null);
  readonly loading = signal<boolean>(true);
  readonly submitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly answeredCount = computed(() => this.selectedAnswers().size);
  readonly secondsRemaining = signal(120);
  readonly timerLabel = computed(() => {
    const minutes = Math.floor(this.secondsRemaining() / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (this.secondsRemaining() % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  });
  readonly timerIsUrgent = computed(() => this.secondsRemaining() <= 30);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.quizId.set(id);
    this.loadQuestions(id);
  }

  loadQuestions(id: number): void {
    this.loading.set(true);
    this.quizService.getQuestionsByQuiz(id).subscribe({
      next: (data) => {
        this.questions.set(data);
        this.loading.set(false);
        this.resetQuestionTimer();
      },
      error: () => this.loading.set(false),
    });
  }

  selectOption(questionId: number, option: string): void {
    if (this.isSubmitted()) return;
    const map = new Map(this.selectedAnswers());
    map.set(questionId, option);
    this.selectedAnswers.set(map);
  }

  goToQuestion(index: number): void {
    if (index < 0 || index >= this.questions().length || this.isSubmitted()) return;
    this.currentQuestionIndex.set(index);
    this.resetQuestionTimer();
  }

  submitExam(isAutomatic = false): void {
    if (this.submitting() || this.isSubmitted()) return;
    const user = this.auth.currentUser();
    if (!user?.username) {
      this.errorMessage.set('Your user session is missing a username. Please sign in again.');
      return;
    }

    if (!isAutomatic && this.selectedAnswers().size === 0) {
      this.errorMessage.set('Select at least one answer before submitting.');
      return;
    }

    const payload: ExamSubmission = {
      quizId: this.quizId(),
      username: user.username,
      userEmail: user.email,
      selectedAnswers: Object.fromEntries(this.selectedAnswers()),
    };

    this.submitting.set(true);
    this.stopQuestionTimer();
    this.errorMessage.set(null);
    this.quizService.evaluateQuiz(payload).subscribe({
      next: (evaluation) => {
        this.result.set(evaluation);
        this.isSubmitted.set(true);
        this.submitting.set(false);
      },
      error: (error) => {
        this.submitting.set(false);
        this.errorMessage.set(
          typeof error?.error === 'string'
            ? error.error
            : error?.error?.message || 'Unable to submit this assessment.',
        );
      },
    });
  }

 async downloadResult(): Promise<void> {
    const evaluation = this.result();
    const user = this.auth.currentUser();
    if (!evaluation || !this.isBrowser) return;

    // ─────────────── Compute derived values ───────────────
    const pct        = Number(evaluation.percentage ?? 0);
    const attempted  = evaluation.attempted ?? 0;
    const total      = evaluation.totalQuestions ?? 0;
    const correct    = evaluation.correctAnswers ?? 0;
    const scored     = evaluation.marksScored ?? 0;
    const max        = evaluation.maxMarks ?? 0;
    const passed     = !!evaluation.passed;

    const accuracy   = attempted ? +(correct / attempted * 100).toFixed(1) : 0;
    const completion = total     ? +(attempted / total * 100).toFixed(1)   : 0;
    const efficiency = attempted ? +(scored / attempted).toFixed(2)        : 0;

    const grade = (() => {
        if (pct >= 95) return { letter: 'A+', label: 'Outstanding',   color: 'FF16A34A' };
        if (pct >= 90) return { letter: 'A',  label: 'Excellent',     color: 'FF22C55E' };
        if (pct >= 85) return { letter: 'A-', label: 'Very Good',     color: 'FF4ADE80' };
        if (pct >= 80) return { letter: 'B+', label: 'Good',          color: 'FF84CC16' };
        if (pct >= 75) return { letter: 'B',  label: 'Above Average', color: 'FFEAB308' };
        if (pct >= 70) return { letter: 'B-', label: 'Satisfactory',  color: 'FFF59E0B' };
        if (pct >= 65) return { letter: 'C+', label: 'Fair',          color: 'FFF97316' };
        if (pct >= 60) return { letter: 'C',  label: 'Average',       color: 'FFF97316' };
        if (pct >= 50) return { letter: 'D',  label: 'Pass',          color: 'FFEF4444' };
        return           { letter: 'F',  label: 'Fail',           color: 'FFDC2626' };
    })();

    const reportId = (() => {
        const d = new Date(), p = (v: number) => String(v).padStart(2, '0');
        return `LP-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    })();

    // ─────────────── Build workbook ───────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'LearningPurpose';
    wb.created = new Date();

    const ws = wb.addWorksheet('Assessment Report', {
        properties: { defaultRowHeight: 22 },
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.2 } },
    });

    // Column widths — A is spacer, B is label, C..L hold the progress bar (10 narrow cells), M is value
    ws.columns = [
        { width: 3  }, // A
        { width: 26 }, // B  label
        { width: 3  }, // C  bar slot 1
        { width: 3  }, // D  bar slot 2
        { width: 3  }, // E  bar slot 3
        { width: 3  }, // F  bar slot 4
        { width: 3  }, // G  bar slot 5
        { width: 3  }, // H  bar slot 6
        { width: 3  }, // I  bar slot 7
        { width: 3  }, // J  bar slot 8
        { width: 3  }, // K  bar slot 9
        { width: 3  }, // L  bar slot 10
        { width: 22 }, // M  value column
        { width: 3  }, // N  spacer
    ];

    const BAR_START_COL = 3;   // C
    const BAR_END_COL   = 12;  // L
    const BAR_SLOTS     = BAR_END_COL - BAR_START_COL + 1; // 10

    let rowIdx = 1;

    // ── helpers ─────────────────────────────────────────
    const setCell = (row: number, col: number, value: any) => {
        const c = ws.getCell(row, col);
        c.value = value;
        return c;
    };

    const applyBorder = (cell: ExcelJS.Cell, argb = 'FFCBD5E1', style: ExcelJS.BorderStyle = 'thin') => {
        cell.border = {
            top:    { style, color: { argb } },
            left:   { style, color: { argb } },
            bottom: { style, color: { argb } },
            right:  { style, color: { argb } },
        };
    };

    const fillRange = (row: number, fromCol: number, toCol: number, argb: string) => {
        for (let c = fromCol; c <= toCol; c++) {
            const cell = ws.getCell(row, c);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
            applyBorder(cell, argb);
        }
    };

    const mergeAndStyle = (
        row: number, fromCol: number, toCol: number,
        value: any, opts: {
            bg?: string, fg?: string, bold?: boolean, size?: number,
            align?: 'left' | 'center' | 'right', italic?: boolean, border?: string,
        } = {}
    ) => {
        ws.mergeCells(row, fromCol, row, toCol);
        const c = setCell(row, fromCol, value);
        c.font = {
            name: 'Calibri',
            size: opts.size ?? 11,
            bold: opts.bold ?? false,
            italic: opts.italic ?? false,
            color: { argb: opts.fg ?? 'FF0F172A' },
        };
        c.alignment = { horizontal: opts.align ?? 'left', vertical: 'middle' };
        if (opts.bg) fillRange(row, fromCol, toCol, opts.bg);
        if (opts.border) {
            for (let cc = fromCol; cc <= toCol; cc++) applyBorder(ws.getCell(row, cc), opts.border);
        }
        return c;
    };

    // ── 1. TOP BANNER ───────────────────────────────────
    ws.mergeCells(rowIdx, 2, rowIdx, 13);
    const titleCell = setCell(rowIdx, 2, 'LEARNINGPURPOSE');
    titleCell.font = { name: 'Calibri', size: 24, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    fillRange(rowIdx, 2, 13, 'FF1E293B');
    ws.getRow(rowIdx).height = 42;
    rowIdx++;

    ws.mergeCells(rowIdx, 2, rowIdx, 13);
    const subCell = setCell(rowIdx, 2, 'OFFICIAL ASSESSMENT REPORT');
    subCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFCBD5E1' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    fillRange(rowIdx, 2, 13, 'FF1E293B');
    ws.getRow(rowIdx).height = 22;
    rowIdx++;

    ws.mergeCells(rowIdx, 2, rowIdx, 13);
    const accent = setCell(rowIdx, 2, '');
    fillRange(rowIdx, 2, 13, grade.color);
    ws.getRow(rowIdx).height = 4;
    rowIdx += 2;

    // ── 2. META STRIP ───────────────────────────────────
    const metaRow = (label: string, value: string) => {
        const lc = setCell(rowIdx, 2, label);
        lc.font = { size: 10, bold: true, color: { argb: 'FF64748B' } };
        lc.alignment = { vertical: 'middle' };
        ws.mergeCells(rowIdx, 3, rowIdx, 13);
        const vc = setCell(rowIdx, 3, value);
        vc.font = { size: 10, color: { argb: 'FF334155' } };
        vc.alignment = { vertical: 'middle' };
        rowIdx++;
    };
    metaRow('Report ID', reportId);
    metaRow('Generated', new Date().toLocaleString());
    rowIdx++;

    // ── 3. SECTION HELPER ───────────────────────────────
    const sectionHeader = (title: string, bg: string) => {
        ws.mergeCells(rowIdx, 2, rowIdx, 13);
        const c = setCell(rowIdx, 2, `   ${title}`);
        c.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        c.alignment = { horizontal: 'left', vertical: 'middle' };
        fillRange(rowIdx, 2, 13, bg);
        ws.getRow(rowIdx).height = 26;
        rowIdx++;
    };

    const kvRow = (label: string, value: string, opts?: {
        valueColor?: string, valueBold?: boolean, zebra?: boolean,
    }) => {
        const bg = opts?.zebra ? 'FFF8FAFC' : 'FFFFFFFF';
        const lc = setCell(rowIdx, 2, label);
        lc.font = { size: 11, bold: true, color: { argb: 'FF475569' } };
        lc.alignment = { vertical: 'middle' };
        lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        applyBorder(lc);

        ws.mergeCells(rowIdx, 3, rowIdx, 13);
        const vc = setCell(rowIdx, 3, value);
        vc.font = {
            size: 11,
            bold: opts?.valueBold ?? false,
            color: { argb: opts?.valueColor ?? 'FF0F172A' },
        };
        vc.alignment = { vertical: 'middle' };
        fillRange(rowIdx, 3, 13, bg);

        ws.getRow(rowIdx).height = 22;
        rowIdx++;
    };

    // ── 4. LEARNER ──────────────────────────────────────
    sectionHeader('LEARNER DETAILS', 'FF0EA5E9');
    kvRow('Username', user?.username ?? 'Learner', { zebra: true });
    kvRow('Email',    user?.email    ?? '—',       { zebra: false });
    rowIdx++;

    // ── 5. ASSESSMENT ───────────────────────────────────
    sectionHeader('ASSESSMENT', 'FF6366F1');
    kvRow('Title',  evaluation.quizTitle ?? 'Untitled Assessment', { zebra: true });
    kvRow('Status', passed ? 'PASSED' : 'NOT PASSED', {
        zebra: false,
        valueColor: passed ? 'FF16A34A' : 'FFDC2626',
        valueBold: true,
    });
    rowIdx++;

    // ── 6. SCORE HIGHLIGHT (big block) ──────────────────
    ws.mergeCells(rowIdx, 2, rowIdx + 2, 6);
    const scoreCell = setCell(rowIdx, 2, `${pct}%`);
    scoreCell.font = { name: 'Calibri', size: 44, bold: true, color: { argb: grade.color } };
    scoreCell.alignment = { horizontal: 'center', vertical: 'middle' };
    fillRange(rowIdx, 2, 6, 'FFF8FAFC');
    for (let r = rowIdx; r <= rowIdx + 2; r++) for (let c = 2; c <= 6; c++) applyBorder(ws.getCell(r, c));

    ws.mergeCells(rowIdx, 7, rowIdx + 2, 13);
    const gradeCell = setCell(rowIdx, 7, `${grade.letter}   ·   ${grade.label}`);
    gradeCell.font = { name: 'Calibri', size: 20, bold: true, color: { argb: grade.color } };
    gradeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    fillRange(rowIdx, 7, 13, grade.color + '22');
    for (let r = rowIdx; r <= rowIdx + 2; r++) for (let c = 7; c <= 13; c++) applyBorder(ws.getCell(r, c), grade.color);

    ws.getRow(rowIdx).height = 26;
    ws.getRow(rowIdx + 1).height = 26;
    ws.getRow(rowIdx + 2).height = 26;
    rowIdx += 4;

    // ── 7. PROGRESS BAR (10 colored cells) ─────────────
    const lc = setCell(rowIdx, 2, 'Progress');
    lc.font = { size: 11, bold: true, color: { argb: 'FF475569' } };
    lc.alignment = { vertical: 'middle' };
    lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    applyBorder(lc);
    for (let c = 3; c <= 13; c++) {
        const cell = ws.getCell(rowIdx, c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        applyBorder(cell, 'FFCBD5E1');
    }
    ws.getRow(rowIdx).height = 22;
    rowIdx++;

    const filledSlots = Math.round((pct / 100) * BAR_SLOTS);
    const barRowBg = 'FFF1F5F9';
    const barRow = rowIdx;
    for (let c = 2; c <= 13; c++) {
        const cell = ws.getCell(barRow, c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: barRowBg } };
    }
    applyBorder(ws.getCell(barRow, 2));
    for (let slot = 0; slot < BAR_SLOTS; slot++) {
        const c = BAR_START_COL + slot;
        const cell = ws.getCell(barRow, c);
        if (slot < filledSlots) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: grade.color } };
        }
        applyBorder(cell, 'FFCBD5E1');
    }
    ws.mergeCells(barRow, 2, barRow, 2); // noop — keeps B as label cell but empty
    ws.getCell(barRow, 2).value = null;
    ws.getRow(barRow).height = 22;
    rowIdx += 2;

    // ── 8. PERFORMANCE METRICS ──────────────────────────
    sectionHeader('PERFORMANCE METRICS', 'FF10B981');
    kvRow('Overall Score', `${pct}%`,                  { zebra: true,  valueBold: true, valueColor: grade.color });
    kvRow('Grade',         `${grade.letter} — ${grade.label}`, { zebra: false, valueColor: grade.color, valueBold: true });
    kvRow('Marks Scored',  `${scored} / ${max}`,       { zebra: true });
    kvRow('Correct',       `${correct} / ${total}`,    { zebra: false });
    kvRow('Attempted',     `${attempted} / ${total}`,  { zebra: true });
    kvRow('Accuracy',      `${accuracy}%`,             { zebra: false, valueColor: accuracy >= 70 ? 'FF16A34A' : 'FFDC2626' });
    kvRow('Completion',    `${completion}%`,           { zebra: true,  valueColor: completion >= 80 ? 'FF16A34A' : 'FFF59E0B' });
    kvRow('Efficiency',    `${efficiency} marks / question`, { zebra: false });
    rowIdx++;

    // ── 9. INSIGHTS ─────────────────────────────────────
    sectionHeader('INSIGHTS & RECOMMENDATIONS', 'FFF59E0B');

    const insights: string[] = [];
    if (pct >= 90) insights.push('Exceptional mastery — you are ready for advanced material.');
    else if (pct >= 75) insights.push('Strong performance — minor refinement needed.');
    else if (pct >= 50) insights.push('Passing — targeted revision will lift your score.');
    else insights.push('Revision strongly recommended before re-attempt.');

    if (attempted < total) insights.push(`${total - attempted} question(s) were left unattempted.`);
    else insights.push('All questions were attempted — full coverage achieved.');

    if (accuracy < 70) insights.push('Accuracy below 70% — review the topics where mistakes occurred.');
    else insights.push('Accuracy is healthy — maintain this consistency.');

    insights.forEach((line, i) => {
        ws.mergeCells(rowIdx, 2, rowIdx, 13);
        const c = setCell(rowIdx, 2, `   •  ${line}`);
        c.font = { size: 11, color: { argb: 'FF334155' } };
        c.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        fillRange(rowIdx, 2, 13, i % 2 === 0 ? 'FFFFFBEB' : 'FFFFFFFF');
        for (let cc = 2; cc <= 13; cc++) applyBorder(ws.getCell(rowIdx, cc), 'FFFDE68A');
        ws.getRow(rowIdx).height = 26;
        rowIdx++;
    });
    rowIdx++;

    // ── 10. FOOTER ──────────────────────────────────────
    ws.mergeCells(rowIdx, 2, rowIdx, 13);
    const foot = setCell(rowIdx, 2, 'Generated by LearningPurpose Assessment Engine v2.0  ·  This document is auto-generated and requires no signature.');
    foot.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    foot.alignment = { horizontal: 'center', vertical: 'middle' };
    fillRange(rowIdx, 2, 13, 'FFF1F5F9');
    ws.getRow(rowIdx).height = 24;

    // ── Save ──
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `${this.slugify(evaluation.quizTitle)}-report.xlsx`);
}

  private slugify(value: string): string {
    return (
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'assessment'
    );
  }

  private resetQuestionTimer(): void {
    this.stopQuestionTimer();
    this.secondsRemaining.set(120);
    if (!this.isBrowser || this.isSubmitted()) return;
    this.timerId = setInterval(() => {
      if (this.secondsRemaining() <= 1) {
        this.secondsRemaining.set(0);
        this.stopQuestionTimer();
        this.submitExam(true);
        return;
      }
      this.secondsRemaining.update((seconds) => seconds - 1);
    }, 1000);
  }

  private stopQuestionTimer(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }

  ngOnDestroy(): void {
    this.stopQuestionTimer();
  }
}
