"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getBrowserClient } from "../../lib/supabase-browser";
import LessonComments from "../../components/LessonComments";
import { PAYMENT_RECEIVER_NUMBER } from "../../config";
import { logPaymentEvent } from "../../lib/paymentEvents";

type Course = {
  id: string;
  title: string;
  description: string | null;
  price: number;
};

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  video_path: string | null;
  pdf_path: string | null;
  sort_order: number;
};

type Exam = {
  id: string;
  title: string;
};

type Progress = {
  watched_seconds: number;
  duration_seconds: number;
  completed: boolean;
};

type LiveSession = { id: string; title: string; youtube_id: string };

type LeaderRow = {
  rank: number;
  student_name: string;
  avg_score: number;
  exams_taken: number;
};

type Assignment = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
};

type Submission = {
  assignment_id: string;
  score: number | null;
  feedback: string | null;
  file_path: string;
};

type RatingRow = {
  id: string;
  stars: number;
  comment: string | null;
  is_hidden: boolean;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

export default function CourseDetails() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [canView, setCanView] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [showPayModal, setShowPayModal] = useState(false);
  const [payRef, setPayRef] = useState("");
  const [payFile, setPayFile] = useState<File | null>(null);
  const [payMessage, setPayMessage] = useState("");
  const [studentName, setStudentName] = useState("");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [openNotes, setOpenNotes] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  const [featuresOn, setFeaturesOn] = useState(true);
  const [myStars, setMyStars] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [ratingSaved, setRatingSaved] = useState(false);
  const [ratingAvg, setRatingAvg] = useState<{ avg: number; count: number } | null>(null);
  const [ratingsList, setRatingsList] = useState<RatingRow[]>([]);
  const [certBusy, setCertBusy] = useState(false);
  const [certPreview, setCertPreview] = useState<string | null>(null);
  const [certMeta, setCertMeta] = useState<{ code: string; date: string } | null>(null);
  const certPdfRef = useRef<{ save: (n: string) => void } | null>(null);
  const certNameRef = useRef("certificate.pdf");
  const [chapters, setChapters] = useState<
    Record<string, { id: string; title: string; seconds: number }[]>
  >({});
  const [chaptersOn, setChaptersOn] = useState(true);
  const [newCh, setNewCh] = useState<Record<string, { title: string; time: string }>>({});
  const [audioOnly, setAudioOnly] = useState<Record<string, boolean>>({});
  const pendingSeekRef = useRef<Record<string, number>>({});
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [openVideo, setOpenVideo] = useState<{ id: string; url: string } | null>(
    null
  );
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>(
    {}
  );
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const lastSaveRef = useRef<Record<string, number>>({});

  const client = () =>
    getBrowserClient();

  useEffect(() => {
    async function loadData() {
      try {
      const supabase = client();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        window.location.href = "/login";
        return;
      }
      setStudentId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();

      const teacher = profile?.role === "teacher";
      setIsTeacher(teacher);
      setStudentName(profile?.full_name || "");

      const { data: courseData } = await supabase
        .from("courses")
        .select("id, title, description, price")
        .eq("id", courseId)
        .single();

      if (!courseData) {
        setMessage("الكورس ده مش موجود.");
        setLoading(false);
        return;
      }
      setCourse(courseData);

      const { data: lessonData } = await supabase
        .from("lessons")
        .select("id, title, description, video_path, pdf_path, sort_order")
        .eq("course_id", courseId)
        .eq("is_published", true)
        .order("sort_order");

      const list = (lessonData as Lesson[]) || [];
      setLessons(list);
      setCanView(teacher || list.length > 0);

      // Chapters need phase1-features.sql; degrade gracefully.
      const videoIds = list.filter((l) => l.video_path).map((l) => l.id);
      if (videoIds.length > 0) {
        const chRes = await supabase
          .from("lesson_chapters")
          .select("id, lesson_id, title, seconds")
          .in("lesson_id", videoIds)
          .order("seconds");
        if (chRes.error) {
          setChaptersOn(false);
        } else {
          const cmap: Record<string, { id: string; title: string; seconds: number }[]> = {};
          (chRes.data || []).forEach(
            (c: { id: string; lesson_id: string; title: string; seconds: number }) => {
              if (!cmap[c.lesson_id]) cmap[c.lesson_id] = [];
              cmap[c.lesson_id].push({ id: c.id, title: c.title, seconds: c.seconds });
            }
          );
          setChapters(cmap);
        }
      }

      const { data: examData } = await supabase
        .from("exams")
        .select("id, title")
        .eq("course_id", courseId)
        .eq("is_published", true)
        .order("created_at");
      const examList = (examData as Exam[]) || [];
      setExams(examList);

      if (examList.length > 0) {
        const { data: attempts } = await supabase
          .from("exam_attempts")
          .select("exam_id, score")
          .eq("student_id", user.id);
        const best: Record<string, number> = {};
        (attempts || []).forEach((a: { exam_id: string; score: number }) => {
          if (!(a.exam_id in best) || a.score > best[a.exam_id]) {
            best[a.exam_id] = a.score;
          }
        });
        setBestScores(best);
      }

      if (!teacher) {
        // review_note is added by the admin setup SQL; fall back pre-setup.
        let enrollment: { status: string; review_note?: string | null }[] | null;
        const withNote = await supabase
          .from("enrollments")
          .select("status, review_note, created_at")
          .eq("student_id", user.id)
          .eq("course_id", courseId)
          .order("created_at", { ascending: false });
        if (withNote.error) {
          const basic = await supabase
            .from("enrollments")
            .select("status")
            .eq("student_id", user.id)
            .eq("course_id", courseId);
          enrollment = basic.data;
        } else {
          enrollment = withNote.data;
        }
        if (enrollment && enrollment.length > 0) {
          if (enrollment.some((e) => e.status === "active")) {
            setStatus("active");
          } else if (enrollment.some((e) => e.status === "pending")) {
            setStatus("pending");
          } else {
            setStatus("cancelled");
            const note = enrollment.find((e) => e.review_note)?.review_note;
            if (note) setReviewNote(note);
          }
        }

        const { data: progressData } = await supabase
          .from("lesson_progress")
          .select("lesson_id, watched_seconds, duration_seconds, completed")
          .eq("student_id", user.id);
        const map: Record<string, Progress> = {};
        (
          (progressData as ({ lesson_id: string } & Progress)[]) || []
        ).forEach((p) => {
          map[p.lesson_id] = {
            watched_seconds: p.watched_seconds,
            duration_seconds: p.duration_seconds,
            completed: p.completed,
          };
        });
        setProgress(map);

        // Student features need student-features-setup.sql; degrade gracefully.
        const [favRes, noteRes] = await Promise.all([
          supabase.from("favorites").select("lesson_id").eq("student_id", user.id),
          supabase.from("lesson_notes").select("lesson_id, note").eq("student_id", user.id),
        ]);
        if (favRes.error || noteRes.error) {
          setFeaturesOn(false);
        } else {
          const fmap: Record<string, boolean> = {};
          (favRes.data || []).forEach((f: { lesson_id: string }) => {
            fmap[f.lesson_id] = true;
          });
          setFavorites(fmap);
          const nmap: Record<string, string> = {};
          (noteRes.data || []).forEach((n: { lesson_id: string; note: string }) => {
            nmap[n.lesson_id] = n.note;
          });
          setNotes(nmap);

          const { data: myR } = await supabase
            .from("course_ratings")
            .select("stars, comment")
            .eq("student_id", user.id)
            .eq("course_id", courseId)
            .maybeSingle();
          if (myR) {
            setMyStars(myR.stars);
            setMyComment(myR.comment || "");
            setRatingSaved(true);
          }
        }
      }

      const ratingsRes = await supabase
        .from("course_ratings")
        .select("id, stars, comment, is_hidden, created_at, profiles(full_name)")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (!ratingsRes.error) {
        applyRatings((ratingsRes.data as unknown as RatingRow[]) || []);
      }

      const { data: liveData } = await supabase
        .from("live_sessions")
        .select("id, title, youtube_id")
        .eq("course_id", courseId)
        .eq("is_live", true);
      setLiveSessions((liveData as LiveSession[]) || []);

      const { data: lbData } = await supabase.rpc("course_leaderboard", {
        p_course_id: courseId,
      });
      setLeaderboard((lbData as LeaderRow[]) || []);

      if (list.length > 0) {
        const { data: asgData } = await supabase
          .from("assignments")
          .select("id, lesson_id, title, description")
          .in(
            "lesson_id",
            list.map((l) => l.id)
          );
        const asgList = (asgData as Assignment[]) || [];
        setAssignments(asgList);

        if (!teacher && asgList.length > 0) {
          const { data: subData } = await supabase
            .from("assignment_submissions")
            .select("assignment_id, score, feedback, file_path")
            .eq("student_id", user.id);
          const subMap: Record<string, Submission> = {};
          ((subData as Submission[]) || []).forEach((s) => {
            subMap[s.assignment_id] = s;
          });
          setSubmissions(subMap);
        }
      }

      setLoading(false);
      } catch {
        setMessage("حصل خطأ أثناء تحميل البيانات. حدّث الصفحة وحاول مرة أخرى.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function saveProgress(
    lessonId: string,
    watched: number,
    duration: number,
    ended: boolean
  ) {
    if (isTeacher || !studentId) return;
    const now = Date.now();
    if (!ended && now - (lastSaveRef.current[lessonId] || 0) < 8000) return;
    lastSaveRef.current[lessonId] = now;

    const prev = progress[lessonId];
    const watchedSec = Math.max(
      Math.floor(watched),
      prev?.watched_seconds || 0
    );
    const durSec = Math.max(Math.floor(duration) || 0, prev?.duration_seconds || 0);
    const completed =
      ended ||
      (prev?.completed ?? false) ||
      (durSec > 0 && watchedSec / durSec >= 0.9);

    const supabase = client();
    await supabase.from("lesson_progress").upsert(
      {
        student_id: studentId,
        lesson_id: lessonId,
        watched_seconds: watchedSec,
        duration_seconds: durSec,
        completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,lesson_id" }
    );
    setProgress((p) => ({
      ...p,
      [lessonId]: {
        watched_seconds: watchedSec,
        duration_seconds: durSec,
        completed,
      },
    }));
  }

  async function markLessonDone(lessonId: string) {
    if (isTeacher || !studentId) return;
    const prev = progress[lessonId];
    if (prev?.completed) return;
    const supabase = client();
    await supabase.from("lesson_progress").upsert(
      {
        student_id: studentId,
        lesson_id: lessonId,
        watched_seconds: prev?.watched_seconds || 0,
        duration_seconds: prev?.duration_seconds || 0,
        completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,lesson_id" }
    );
    setProgress((p) => ({
      ...p,
      [lessonId]: {
        watched_seconds: prev?.watched_seconds || 0,
        duration_seconds: prev?.duration_seconds || 0,
        completed: true,
      },
    }));
  }

  async function openFile(path: string, lessonId: string) {
    const supabase = client();
    const { data, error } = await supabase.storage
      .from("lesson-media")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      setMessage("مش قادرين نفتح الملف دلوقتي، جرب تاني.");
      return;
    }
    const full = data.signedUrl.startsWith("http")
      ? data.signedUrl
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${data.signedUrl}`;
    markLessonDone(lessonId);
    window.location.href = full;
  }

  async function playVideo(lesson: Lesson) {
    if (!lesson.video_path) return;
    const supabase = client();
    const { data, error } = await supabase.storage
      .from("lesson-media")
      .createSignedUrl(lesson.video_path, 3600);
    if (error || !data?.signedUrl) {
      setMessage("مش قادرين نفتح الفيديو دلوقتي، جرب تاني.");
      return;
    }
    const full = data.signedUrl.startsWith("http")
      ? data.signedUrl
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${data.signedUrl}`;
    setOpenVideo({ id: lesson.id, url: full });
  }

  function fmtTime(total: number) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function parseTime(t: string): number | null {
    const m = t.trim().match(/^(\d+):(\d{1,2})$/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const n = parseInt(t.trim(), 10);
    return isNaN(n) ? null : n;
  }

  function seekChapter(lesson: Lesson, seconds: number) {
    if (openVideo?.id === lesson.id) {
      const v = document.querySelector<HTMLVideoElement>(
        `video[data-lesson="${lesson.id}"]`
      );
      if (v) v.currentTime = seconds;
    } else {
      pendingSeekRef.current[lesson.id] = seconds;
      playVideo(lesson);
    }
  }

  async function addChapter(lessonId: string) {
    const draft = newCh[lessonId];
    if (!draft?.title.trim()) return;
    const seconds = parseTime(draft.time || "0");
    if (seconds === null) return;
    const supabase = client();
    const { data, error } = await supabase
      .from("lesson_chapters")
      .insert({ lesson_id: lessonId, title: draft.title.trim(), seconds })
      .select("id, title, seconds")
      .single();
    if (error) {
      setMessage("الفصول لسه محتاجة سكريبت phase1-features.sql يتشغّل.");
      return;
    }
    setChapters((p) => ({
      ...p,
      [lessonId]: [...(p[lessonId] || []), data].sort((a, b) => a.seconds - b.seconds),
    }));
    setNewCh((p) => ({ ...p, [lessonId]: { title: "", time: "" } }));
  }

  async function deleteChapter(lessonId: string, chapterId: string) {
    const supabase = client();
    const { error } = await supabase
      .from("lesson_chapters")
      .delete()
      .eq("id", chapterId);
    if (!error) {
      setChapters((p) => ({
        ...p,
        [lessonId]: (p[lessonId] || []).filter((c) => c.id !== chapterId),
      }));
    }
  }

  async function submitAssignment(assignmentId: string, file: File) {
    if (isTeacher || !studentId) return;
    setUploadingId(assignmentId);
    setMessage("");
    const supabase = client();
    const path = `${studentId}/${assignmentId}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("submissions")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setMessage("الملف ما اترفعش، جرب تاني.");
      setUploadingId(null);
      return;
    }
    const { error } = await supabase.from("assignment_submissions").upsert(
      {
        assignment_id: assignmentId,
        student_id: studentId,
        file_path: path,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "assignment_id,student_id" }
    );
    if (error) {
      setMessage("التسليم ما اتسجلش: " + error.message);
    } else {
      setMessage("تم تسليم الواجب ✅ الأستاذ هيصححه قريبًا.");
      setSubmissions((prev) => ({
        ...prev,
        [assignmentId]: {
          assignment_id: assignmentId,
          score: prev[assignmentId]?.score ?? null,
          feedback: prev[assignmentId]?.feedback ?? null,
          file_path: path,
        },
      }));
    }
    setUploadingId(null);
  }

  function openSubscribe() {
    if (course && course.price > 0) {
      setPayRef("");
      setPayFile(null);
      setPayMessage("");
      setShowPayModal(true);
    } else {
      submitSubscription(null, null);
    }
  }

  async function submitSubscription(ref: string | null, file: File | null) {
    setBusy(true);
    setMessage("");
    setPayMessage("");
    const supabase = client();

    let proofPath: string | null = null;
    if (file) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${studentId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { contentType: file.type || undefined });
      // Bucket created by the setup SQL; if missing, continue without the file.
      if (!upErr) proofPath = path;
    }

    const fullRow = {
      student_id: studentId,
      course_id: courseId,
      payment_reference: ref && ref.trim() ? ref.trim() : null,
      payment_proof_path: proofPath,
    };
    let { error } = await supabase.from("enrollments").insert(fullRow);
    if (error && /payment_|proof/i.test(error.message)) {
      // Columns not added yet (setup SQL pending) — plain request instead.
      const fallback = await supabase
        .from("enrollments")
        .insert({ student_id: studentId, course_id: courseId });
      error = fallback.error;
    }
    if (error) {
      const msg = "خطأ إرسال الطلب: " + error.message;
      if (course && course.price > 0) setPayMessage(msg);
      else setMessage(msg);
    } else {
      const { data: created } = await supabase
        .from("enrollments")
        .select("id")
        .eq("student_id", studentId)
        .eq("course_id", courseId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (created && created[0]) {
        await logPaymentEvent(
          supabase,
          created[0].id,
          "submitted",
          course && course.price > 0 ? course.price : null,
          ref && ref.trim() ? "مرجع الدفع: " + ref.trim() : null
        );
      }
      setShowPayModal(false);
      setMessage(
        course && course.price > 0
          ? "تم إرسال طلب الاشتراك مع بيانات الدفع ✅ الأستاذ هيراجعه قريبًا إن شاء الله."
          : "تم إرسال طلب الاشتراك ✅ الأستاذ هيراجعه قريبًا إن شاء الله."
      );
      setStatus("pending");
    }
    setBusy(false);
  }

  function applyRatings(rows: RatingRow[]) {
    setRatingsList(rows);
    const visible = rows.filter((r) => !r.is_hidden);
    if (visible.length > 0) {
      const avg = visible.reduce((s, r) => s + r.stars, 0) / visible.length;
      setRatingAvg({ avg: Math.round(avg * 10) / 10, count: visible.length });
    } else {
      setRatingAvg(null);
    }
  }

  async function toggleFavorite(lessonId: string) {
    if (!studentId || isTeacher) return;
    const supabase = client();
    if (favorites[lessonId]) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("student_id", studentId)
        .eq("lesson_id", lessonId);
      if (!error) setFavorites((p) => ({ ...p, [lessonId]: false }));
    } else {
      const { error } = await supabase
        .from("favorites")
        .insert({ student_id: studentId, lesson_id: lessonId });
      if (!error) setFavorites((p) => ({ ...p, [lessonId]: true }));
    }
  }

  async function saveNote(lessonId: string) {
    if (!studentId || isTeacher) return;
    setSavingNote(true);
    const supabase = client();
    const text = notes[lessonId] || "";
    if (!text.trim()) {
      await supabase
        .from("lesson_notes")
        .delete()
        .eq("student_id", studentId)
        .eq("lesson_id", lessonId);
    } else {
      await supabase.from("lesson_notes").upsert(
        { student_id: studentId, lesson_id: lessonId, note: text.trim() },
        { onConflict: "student_id,lesson_id" }
      );
    }
    setSavingNote(false);
    setOpenNotes(null);
  }

  async function submitRating() {
    if (!studentId || myStars === 0) return;
    const supabase = client();
    const { error } = await supabase.from("course_ratings").upsert(
      {
        student_id: studentId,
        course_id: courseId,
        stars: myStars,
        comment: myComment.trim() || null,
      },
      { onConflict: "student_id,course_id" }
    );
    if (error) {
      setMessage("التقييمات لسه محتاجة سكريبت الإعداد student-features-setup.sql يتشغّل.");
      return;
    }
    setRatingSaved(true);
    const { data } = await supabase
      .from("course_ratings")
      .select("id, stars, comment, is_hidden, created_at, profiles(full_name)")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    applyRatings((data as unknown as RatingRow[]) || []);
  }

  async function hideRating(id: string) {
    const supabase = client();
    const { error } = await supabase
      .from("course_ratings")
      .update({ is_hidden: true })
      .eq("id", id);
    if (!error) {
      const next = ratingsList.map((r) =>
        r.id === id ? { ...r, is_hidden: true } : r
      );
      applyRatings(next);
    }
  }

  async function generateCertificate() {
    if (!studentId || !course) return;
    setCertBusy(true);
    setMessage("");
    const supabase = client();
    let certRowId = "";
    let issuedAt = new Date().toISOString();
    const { data: existing } = await supabase
      .from("certificates")
      .select("id, issued_at")
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existing) {
      certRowId = existing.id;
      issuedAt = existing.issued_at;
    } else {
      const { data: inserted, error } = await supabase
        .from("certificates")
        .insert({ student_id: studentId, course_id: courseId })
        .select("id, issued_at")
        .single();
      if (error || !inserted) {
        setMessage("الشهادات لسه محتاجة سكريبت الإعداد student-features-setup.sql يتشغّل.");
        setCertBusy(false);
        return;
      }
      certRowId = inserted.id;
      issuedAt = inserted.issued_at;
    }
    const code = "ITQAN-" + certRowId.replace(/-/g, "").slice(0, 8).toUpperCase();
    setCertMeta({ code, date: new Date(issuedAt).toLocaleDateString("ar-EG") });
    await new Promise((r) => setTimeout(r, 150));
    try {
      const el = document.getElementById("certificate-render");
      if (!el) throw new Error("certificate element missing");
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(el, {
        backgroundColor: "var(--bg)",
        scale: 2,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height],
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
      certPdfRef.current = pdf as unknown as { save: (n: string) => void };
      certNameRef.current = `certificate-${code}.pdf`;
      setCertPreview(img);
    } catch {
      setMessage("حصل خطأ أثناء تجهيز الشهادة، جرب تاني.");
    }
    setCertBusy(false);
  }

  if (loading) {
    return <main className="subpage">جاري تحميل الكورس...</main>;
  }

  if (!course) {
    return (
      <main className="subpage">
        <a href="/courses">← الكورسات</a>
        <p role="alert">{message || "الكورس ده مش موجود."}</p>
      </main>
    );
  }

  const completedCount = lessons.filter((l) => progress[l.id]?.completed).length;
  const coursePercent =
    lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  return (
    <main className="subpage">
      <a href="/courses">← الكورسات</a>

      <h1>{course.title}</h1>
      {ratingAvg && (
        <p style={{ color: "var(--gold)", margin: "4px 0" }}>
          ⭐ {ratingAvg.avg} من 5 ({ratingAvg.count} تقييم)
        </p>
      )}
      <p>{course.description}</p>

      {message && <p role="alert">{message}</p>}

      {canView &&
        liveSessions.map((s) => (
          <section
            key={s.id}
            style={{
              border: "2px solid var(--error)",
              borderRadius: "12px",
              padding: "16px",
              marginTop: "16px",
              background: "var(--surface)",
            }}
          >
            <h3 style={{ margin: "0 0 10px", color: "var(--error)" }}>
              🔴 بث مباشر الآن: {s.title}
            </h3>
            <div
              style={{
                position: "relative",
                paddingBottom: "56.25%",
                height: 0,
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${s.youtube_id}`}
                title={s.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  border: 0,
                }}
              />
            </div>
          </section>
        ))}

      {!isTeacher && canView && lessons.length > 0 && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "14px 16px",
            marginTop: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <strong style={{ color: "var(--gold)" }}>تقدمك في الكورس</strong>
            <span style={{ color: "var(--text-muted)" }}>
              خلصت {completedCount} من {lessons.length} درس ({coursePercent}%)
            </span>
          </div>
          <div
            style={{
              background: "var(--border)",
              borderRadius: "8px",
              height: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: coursePercent === 100 ? "var(--success)" : "var(--gold)",
                height: "100%",
                width: `${coursePercent}%`,
                transition: "width 0.4s",
              }}
            />
          </div>
        </div>
      )}

      {canView && studentId && !isTeacher && (
        <div style={{ marginTop: "16px" }}>
          <a
            href={`/level-check/${courseId}`}
            style={{
              display: "inline-block",
              padding: "10px 20px",
              border: "1px solid var(--gold)",
              borderRadius: "10px",
              color: "var(--gold)",
              fontWeight: "bold",
              textDecoration: "none",
            }}
          >
            🎯 حدد مستواك (10 دقائق)
          </a>
        </div>
      )}

      {canView && studentId && !isTeacher && coursePercent === 100 && (
        <div style={{ marginTop: "16px" }}>
          <button
            onClick={generateCertificate}
            disabled={certBusy}
            style={{
              padding: "12px 24px",
              border: "none",
              borderRadius: "10px",
              background: "var(--gold)",
              color: "var(--gold-ink)",
              fontWeight: "bold",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            {certBusy ? "جاري تجهيز الشهادة..." : "🎓 تحميل شهادة الإتمام"}
          </button>
        </div>
      )}

      {canView && studentId && !isTeacher && featuresOn && (
        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "16px",
            background: "var(--surface)",
          }}
        >
          <h3 style={{ margin: "0 0 8px", color: "var(--gold)" }}>قيّم الكورس</h3>
          <div style={{ fontSize: "1.6rem", direction: "ltr", textAlign: "right" }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <span
                key={s}
                onClick={() => setMyStars(s)}
                style={{
                  cursor: "pointer",
                  color: s <= myStars ? "var(--gold)" : "var(--text-dim)",
                }}
              >
                ★
              </span>
            ))}
          </div>
          <textarea
            value={myComment}
            onChange={(e) => setMyComment(e.target.value)}
            placeholder="اكتب رأيك في الكورس (اختياري)"
            rows={3}
            style={{
              width: "100%",
              marginTop: "8px",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={submitRating}
            disabled={myStars === 0}
            style={{
              marginTop: "8px",
              padding: "10px 20px",
              border: "none",
              borderRadius: "10px",
              background: myStars === 0 ? "var(--text-dim)" : "var(--gold)",
              color: myStars === 0 ? "var(--text-muted)" : "var(--gold-ink)",
              fontWeight: "bold",
              cursor: myStars === 0 ? "default" : "pointer",
            }}
          >
            {ratingSaved ? "حدّث تقييمك" : "احفظ التقييم"}
          </button>
          {ratingSaved && (
            <span style={{ color: "var(--success)", marginInlineStart: "10px" }}>
              ✓ تقييمك محفوظ
            </span>
          )}
        </section>
      )}

      {!canView && (
        <div className="notice">
          {status === "active" && (
            <p>أنت مشترك في هذا الكورس ✅ الدروس هتظهر هنا أول ما تتنشر.</p>
          )}
          {status === "pending" && <p>طلبك قيد المراجعة ⏳</p>}
          {status === "cancelled" && (
            <>
              <p>طلب الاشتراك السابق اترفض ❌</p>
              {reviewNote && <p>السبب: {reviewNote}</p>}
              <button onClick={openSubscribe} disabled={busy}>
                أعد طلب الاشتراك
              </button>
            </>
          )}
          {!status && (
            <>
              <p>محتوى الكورس متاح للمشتركين فقط.</p>
              <button onClick={openSubscribe} disabled={busy}>
                {course.price > 0
                  ? `اشترك الآن - ${course.price} جنيه`
                  : "اشترك مجانًا"}
              </button>
            </>
          )}
        </div>
      )}

      {showPayModal && course && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(4,10,22,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 50,
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: "440px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h3 style={{ marginTop: 0 }}>الدفع والاشتراك 💳</h3>
            <p style={{ fontSize: "15px" }}>
              حوّل{" "}
              <strong style={{ color: "var(--gold)" }}>
                {course.price} جنيه
              </strong>{" "}
              على الرقم ده عن طريق <strong>فودافون كاش</strong> أو{" "}
              <strong>انستاباي</strong>:
            </p>
            <p
              dir="ltr"
              style={{
                textAlign: "center",
                fontSize: "24px",
                fontWeight: "bold",
                color: "var(--gold)",
                letterSpacing: "1px",
                margin: "10px 0",
              }}
            >
              {PAYMENT_RECEIVER_NUMBER}
            </p>
            <p style={{ fontSize: "14px" }}>
              بعد التحويل اكتب رقم العملية (المرجع) أو ارفع صورة الإيصال،
              وهنفعّل اشتراكك بعد المراجعة.
            </p>
            <label style={{ display: "block", marginTop: "12px" }}>
              رقم العملية / المرجع
              <input
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="مثال: 123456789"
                style={{ width: "100%", marginTop: "6px" }}
              />
            </label>
            <label style={{ display: "block", marginTop: "12px" }}>
              صورة الإيصال (اختياري)
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                style={{ width: "100%", marginTop: "6px" }}
              />
            </label>
            {payMessage && (
              <p role="alert" style={{ color: "var(--error)" }}>
                {payMessage}
              </p>
            )}
            <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
              <button
                style={{ flex: 1 }}
                disabled={busy}
                onClick={() => {
                  if (!payRef.trim() && !payFile) {
                    setPayMessage("اكتب رقم العملية أو ارفع صورة الإيصال الأول.");
                    return;
                  }
                  submitSubscription(payRef, payFile);
                }}
              >
                {busy ? "جاري الإرسال..." : "تأكيد الطلب"}
              </button>
              <button
                disabled={busy}
                onClick={() => setShowPayModal(false)}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text-soft)",
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {canView && lessons.length === 0 && (
        <p>لا توجد دروس منشورة في هذا الكورس حتى الآن.</p>
      )}

      {canView &&
        lessons.map((lesson) => {
          const p = progress[lesson.id];
          const pct =
            p && p.duration_seconds > 0
              ? Math.min(
                  100,
                  Math.round((p.watched_seconds / p.duration_seconds) * 100)
                )
              : 0;
          return (
            <section
              key={lesson.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                marginTop: "16px",
                background: "var(--surface)",
              }}
            >
              <h3 style={{ margin: "0 0 8px", color: "var(--gold)" }}>
                الدرس {lesson.sort_order}: {lesson.title}
                {!isTeacher && p?.completed && (
                  <span style={{ color: "var(--success)", marginInlineStart: "8px" }}>
                    ✓ خلصته
                  </span>
                )}
              </h3>
              {lesson.description && <p>{lesson.description}</p>}

              {!isTeacher && lesson.video_path && p && (
                <div
                  style={{
                    background: "var(--border)",
                    borderRadius: "6px",
                    height: "6px",
                    overflow: "hidden",
                    marginBottom: "10px",
                    maxWidth: "300px",
                  }}
                >
                  <div
                    style={{
                      background: p.completed ? "var(--success)" : "var(--gold)",
                      height: "100%",
                      width: `${p.completed ? 100 : pct}%`,
                    }}
                  />
                </div>
              )}

              {lesson.video_path && (
                <button
                  onClick={() => playVideo(lesson)}
                  style={{
                    padding: "10px 20px",
                    border: 0,
                    borderRadius: "10px",
                    background: "var(--gold)",
                    color: "var(--gold-ink)",
                    fontWeight: "bold",
                    cursor: "pointer",
                    marginInlineEnd: "8px",
                  }}
                >
                  ▶{" "}
                  {!isTeacher && p && p.watched_seconds > 0 && !p.completed
                    ? "كمل المشاهدة"
                    : "شغل الفيديو"}
                </button>
              )}
              {lesson.pdf_path && (
                <button
                  onClick={() => openFile(lesson.pdf_path!, lesson.id)}
                  style={{
                    padding: "10px 20px",
                    border: "1px solid var(--gold)",
                    borderRadius: "10px",
                    background: "var(--surface)",
                    color: "var(--gold)",
                    fontWeight: "bold",
                    cursor: "pointer",
                    marginInlineEnd: "8px",
                  }}
                >
                  📄 افتح الملف
                </button>
              )}
              <button
                onClick={() =>
                  setOpenComments(openComments === lesson.id ? null : lesson.id)
                }
                style={{
                  padding: "10px 16px",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  background: "var(--surface)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                💬 النقاش
              </button>
              {!isTeacher && studentId && featuresOn && (
                <>
                  <button
                    onClick={() => toggleFavorite(lesson.id)}
                    title={favorites[lesson.id] ? "شيل من المفضلة" : "ضيف للمفضلة"}
                    style={{
                      padding: "10px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      background: favorites[lesson.id] ? "var(--gold-dim)" : "var(--surface)",
                      color: favorites[lesson.id] ? "var(--gold)" : "var(--text-muted)",
                      cursor: "pointer",
                      marginInlineStart: "8px",
                    }}
                  >
                    {favorites[lesson.id] ? "★" : "☆"}
                  </button>
                  <button
                    onClick={() =>
                      setOpenNotes(openNotes === lesson.id ? null : lesson.id)
                    }
                    title="ملاحظاتك عن الدرس"
                    style={{
                      padding: "10px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      background: "var(--surface)",
                      color: notes[lesson.id] ? "var(--gold)" : "var(--text-muted)",
                      cursor: "pointer",
                      marginInlineStart: "8px",
                    }}
                  >
                    📝
                  </button>
                </>
              )}

              {openNotes === lesson.id && (
                <div style={{ marginTop: "12px" }}>
                  <textarea
                    value={notes[lesson.id] || ""}
                    onChange={(e) =>
                      setNotes((p) => ({ ...p, [lesson.id]: e.target.value }))
                    }
                    placeholder="اكتب ملاحظاتك عن الدرس ده..."
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--text)",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={() => saveNote(lesson.id)}
                    disabled={savingNote}
                    style={{
                      marginTop: "8px",
                      padding: "8px 18px",
                      border: "none",
                      borderRadius: "8px",
                      background: "var(--gold)",
                      color: "var(--gold-ink)",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    {savingNote ? "جاري الحفظ..." : "احفظ الملاحظة"}
                  </button>
                </div>
              )}

              {openVideo?.id === lesson.id && (
                <video
                  src={openVideo.url}
                  data-lesson={lesson.id}
                  controls
                  playsInline
                  preload="metadata"
                  style={{
                    width: "100%",
                    marginTop: "12px",
                    borderRadius: "10px",
                    ...(audioOnly[lesson.id] ? { height: "48px" } : {}),
                  }}
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    const pending = pendingSeekRef.current[lesson.id];
                    if (pending !== undefined) {
                      v.currentTime = pending;
                      delete pendingSeekRef.current[lesson.id];
                      return;
                    }
                    const saved = progress[lesson.id];
                    if (
                      saved &&
                      !saved.completed &&
                      saved.watched_seconds > 5 &&
                      v.duration > 0 &&
                      saved.watched_seconds < v.duration - 10
                    ) {
                      v.currentTime = saved.watched_seconds;
                    }
                  }}
                  onTimeUpdate={(e) =>
                    saveProgress(
                      lesson.id,
                      e.currentTarget.currentTime,
                      e.currentTarget.duration,
                      false
                    )
                  }
                  onPause={(e) =>
                    saveProgress(
                      lesson.id,
                      e.currentTarget.currentTime,
                      e.currentTarget.duration,
                      false
                    )
                  }
                  onEnded={(e) =>
                    saveProgress(
                      lesson.id,
                      e.currentTarget.duration,
                      e.currentTarget.duration,
                      true
                    )
                  }
                />
              )}

              {openVideo?.id === lesson.id && (
                <div style={{ marginTop: "8px", fontSize: "14px" }}>
                  <button
                    onClick={() =>
                      setAudioOnly((p) => ({ ...p, [lesson.id]: !p[lesson.id] }))
                    }
                    style={{
                      padding: "6px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      background: audioOnly[lesson.id] ? "var(--gold-dim)" : "var(--surface)",
                      color: audioOnly[lesson.id] ? "var(--gold)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    🎧 صوت بس (يوفّر باقة)
                  </button>
                  <a
                    href={openVideo.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      marginInlineStart: "10px",
                      padding: "6px 14px",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      background: "var(--surface)",
                      color: "var(--text-muted)",
                      textDecoration: "none",
                    }}
                  >
                    ⬇ تحميل الفيديو
                  </a>
                </div>
              )}

              {lesson.video_path && chaptersOn && canView && (
                <div style={{ marginTop: "10px" }}>
                  {(chapters[lesson.id] || []).length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {(chapters[lesson.id] || []).map((c) => (
                        <span key={c.id}>
                          <button
                            onClick={() => seekChapter(lesson, c.seconds)}
                            style={{
                              padding: "4px 12px",
                              border: "1px solid var(--border)",
                              borderRadius: "14px",
                              background: "var(--bg)",
                              color: "var(--gold)",
                              cursor: "pointer",
                              fontSize: "13px",
                            }}
                          >
                            ▸ {fmtTime(c.seconds)} {c.title}
                          </button>
                          {isTeacher && (
                            <button
                              onClick={() => deleteChapter(lesson.id, c.id)}
                              title="امسح الفصل"
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "var(--error)",
                                cursor: "pointer",
                                fontSize: "13px",
                              }}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  {isTeacher && (
                    <div style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <input
                        value={newCh[lesson.id]?.title || ""}
                        onChange={(e) =>
                          setNewCh((p) => ({
                            ...p,
                            [lesson.id]: {
                              title: e.target.value,
                              time: p[lesson.id]?.time || "",
                            },
                          }))
                        }
                        placeholder="اسم الفصل"
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "var(--bg)",
                          color: "var(--text)",
                          width: "140px",
                        }}
                      />
                      <input
                        value={newCh[lesson.id]?.time || ""}
                        onChange={(e) =>
                          setNewCh((p) => ({
                            ...p,
                            [lesson.id]: {
                              title: p[lesson.id]?.title || "",
                              time: e.target.value,
                            },
                          }))
                        }
                        placeholder="م:ثث مثل 2:30"
                        style={{
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "var(--bg)",
                          color: "var(--text)",
                          width: "110px",
                          direction: "ltr",
                        }}
                      />
                      <button
                        onClick={() => addChapter(lesson.id)}
                        style={{
                          padding: "6px 14px",
                          border: "none",
                          borderRadius: "8px",
                          background: "var(--gold)",
                          color: "var(--gold-ink)",
                          fontWeight: "bold",
                          cursor: "pointer",
                          fontSize: "13px",
                        }}
                      >
                        + فصل
                      </button>
                    </div>
                  )}
                </div>
              )}

              {assignments
                .filter((a) => a.lesson_id === lesson.id)
                .map((a) => {
                  const sub = submissions[a.id];
                  return (
                    <div
                      key={a.id}
                      style={{
                        marginTop: "12px",
                        border: "1px dashed var(--gold)",
                        borderRadius: "10px",
                        padding: "12px",
                        background: "var(--surface-2)",
                      }}
                    >
                      <strong style={{ color: "var(--gold)" }}>
                        📝 الواجب: {a.title}
                      </strong>
                      {a.description && (
                        <p style={{ margin: "4px 0" }}>{a.description}</p>
                      )}
                      {!isTeacher && (
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                            flexWrap: "wrap",
                            marginTop: "6px",
                          }}
                        >
                          <label
                            style={{
                              padding: "8px 16px",
                              borderRadius: "8px",
                              background: "var(--gold)",
                              color: "var(--gold-ink)",
                              fontWeight: "bold",
                              cursor: "pointer",
                            }}
                          >
                            {uploadingId === a.id
                              ? "جاري الرفع..."
                              : sub
                                ? "📤 أعد رفع الحل"
                                : "📤 ارفع حلك"}
                            <input
                              type="file"
                              style={{ display: "none" }}
                              disabled={uploadingId === a.id}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) submitAssignment(a.id, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {sub && sub.score === null && (
                            <span style={{ color: "var(--text-muted)" }}>
                              تم التسليم ⏳ بانتظار التصحيح
                            </span>
                          )}
                          {sub && sub.score !== null && (
                            <span>
                              درجتك:{" "}
                              <strong style={{ color: "var(--success)" }}>
                                {sub.score}/100
                              </strong>
                              {sub.feedback && ` — ${sub.feedback}`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

              {openComments === lesson.id && (
                <LessonComments
                  lessonId={lesson.id}
                  userId={studentId}
                  isTeacher={isTeacher}
                />
              )}
            </section>
          );
        })}

      {canView && leaderboard.length > 0 && (
        <>
          <h2 style={{ color: "var(--gold)", marginTop: "30px" }}>
            🏆 لوحة المتفوقين
          </h2>
          <section
            style={{
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "8px 16px",
              marginTop: "16px",
              background: "var(--surface)",
            }}
          >
            {leaderboard.map((row) => (
              <div
                key={row.rank}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderTop: row.rank > 1 ? "1px solid var(--border)" : 0,
                }}
              >
                <span>
                  {row.rank === 1
                    ? "🥇"
                    : row.rank === 2
                      ? "🥈"
                      : row.rank === 3
                        ? "🥉"
                        : `${row.rank}.`}{" "}
                  {row.student_name}
                </span>
                <span>
                  <strong style={{ color: "var(--gold)" }}>
                    {row.avg_score}%
                  </strong>{" "}
                  <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                    ({row.exams_taken}{" "}
                    {row.exams_taken === 1 ? "اختبار" : "اختبارات"})
                  </span>
                </span>
              </div>
            ))}
          </section>
        </>
      )}

      {canView && exams.length > 0 && (
        <>
          <h2 style={{ color: "var(--gold)", marginTop: "30px" }}>الاختبارات</h2>
          {exams.map((exam) => (
            <section
              key={exam.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                marginTop: "16px",
                background: "var(--surface)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div>
                <strong style={{ color: "var(--gold)" }}>{exam.title}</strong>
                {!isTeacher && bestScores[exam.id] !== undefined && (
                  <p style={{ margin: "4px 0 0" }}>
                    أفضل نتيجة: {bestScores[exam.id]}%
                  </p>
                )}
              </div>
              <a
                href={`/exams/${exam.id}`}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  background: "var(--gold)",
                  color: "var(--gold-ink)",
                  fontWeight: "bold",
                  whiteSpace: "nowrap",
                }}
              >
                {bestScores[exam.id] !== undefined
                  ? "أعد الاختبار"
                  : "ابدأ الاختبار"}
              </a>
            </section>
          ))}
        </>
      )}

      {(ratingsList.filter((r) => !r.is_hidden).length > 0 ||
        (isTeacher && ratingsList.length > 0)) && (
        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "16px",
            background: "var(--surface)",
          }}
        >
          <h3 style={{ margin: "0 0 12px", color: "var(--gold)" }}>
            آراء الطلاب
          </h3>
          {ratingsList.map((r) => {
            if (r.is_hidden && !isTeacher) return null;
            return (
              <div
                key={r.id}
                style={{
                  borderTop: "1px solid var(--border)",
                  padding: "10px 0",
                  opacity: r.is_hidden ? 0.5 : 1,
                }}
              >
                <div style={{ direction: "ltr", textAlign: "right" }}>
                  <span style={{ color: "var(--gold)", letterSpacing: "2px" }}>
                    {"★".repeat(r.stars)}
                  </span>
                  <span style={{ color: "var(--text-dim)", letterSpacing: "2px" }}>
                    {"★".repeat(5 - r.stars)}
                  </span>
                </div>
                <strong>{r.profiles?.full_name || "طالب"}</strong>
                {r.is_hidden && isTeacher && (
                  <span style={{ color: "var(--error)", marginInlineStart: "8px" }}>
                    (مخفي)
                  </span>
                )}
                {r.comment && <p style={{ margin: "4px 0 0" }}>{r.comment}</p>}
                {isTeacher && !r.is_hidden && (
                  <button
                    onClick={() => hideRating(r.id)}
                    style={{
                      marginTop: "6px",
                      padding: "4px 12px",
                      border: "1px solid var(--error)",
                      borderRadius: "8px",
                      background: "transparent",
                      color: "var(--error)",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    إخفاء التعليق
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      {certPreview && (
        <div
          onClick={() => setCertPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              borderRadius: "12px",
              padding: "16px",
              maxWidth: "900px",
              width: "100%",
            }}
          >
            <img
              src={certPreview}
              alt="شهادة الإتمام"
              style={{ width: "100%", borderRadius: "8px" }}
            />
            <div style={{ marginTop: "12px", textAlign: "center" }}>
              <button
                onClick={() => certPdfRef.current?.save(certNameRef.current)}
                style={{
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: "10px",
                  background: "var(--gold)",
                  color: "var(--gold-ink)",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                ⬇ تحميل الشهادة PDF
              </button>
              <button
                onClick={() => setCertPreview(null)}
                style={{
                  padding: "12px 24px",
                  marginInlineStart: "10px",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  background: "transparent",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                قفل
              </button>
            </div>
          </div>
        </div>
      )}

      {certMeta && course && (
        <div
          id="certificate-render"
          dir="rtl"
          style={{
            position: "fixed",
            left: "-3000px",
            top: 0,
            width: "1120px",
            height: "792px",
            background: "var(--bg)",
            color: "var(--text)",
            fontFamily: "inherit",
            boxSizing: "border-box",
            padding: "40px",
          }}
        >
          <div
            style={{
              border: "3px solid var(--gold)",
              borderRadius: "12px",
              height: "100%",
              boxSizing: "border-box",
              padding: "12px",
            }}
          >
            <div
              style={{
                border: "1px solid var(--gold)",
                borderRadius: "8px",
                height: "100%",
                boxSizing: "border-box",
                padding: "40px 56px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ color: "var(--gold)", fontSize: "22px" }}>
                  منصة متقن
                </div>
                <div
                  style={{
                    color: "var(--gold)",
                    fontSize: "44px",
                    fontWeight: "bold",
                    marginTop: "16px",
                  }}
                >
                  شهادة إتمام
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "18px", marginTop: "24px" }}>
                  تشهد منصة متقن بأن
                </div>
                <div
                  style={{
                    fontSize: "38px",
                    fontWeight: "bold",
                    marginTop: "8px",
                  }}
                >
                  {studentName || "الطالب"}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "18px", marginTop: "16px" }}>
                  قد أتم بنجاح جميع دروس كورس
                </div>
                <div
                  style={{
                    color: "var(--gold)",
                    fontSize: "28px",
                    fontWeight: "bold",
                    marginTop: "8px",
                  }}
                >
                  {course.title}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  alignItems: "flex-end",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                    محمد صلاح الجبالي
                  </div>
                  <div
                    style={{
                      borderTop: "1px solid var(--text-muted)",
                      marginTop: "6px",
                      paddingTop: "6px",
                      color: "var(--text-muted)",
                      fontSize: "14px",
                    }}
                  >
                    المدرّس
                  </div>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                  <div>تاريخ الإصدار: {certMeta.date}</div>
                  <div style={{ marginTop: "4px" }}>رقم الشهادة: {certMeta.code}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
