"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import LessonComments from "../../components/LessonComments";

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

export default function CourseDetails() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [canView, setCanView] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
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
  const lastSaveRef = useRef<Record<string, number>>({});

  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  useEffect(() => {
    async function loadData() {
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
        .select("role")
        .eq("id", user.id)
        .single();

      const teacher = profile?.role === "teacher";
      setIsTeacher(teacher);

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
        const { data: enrollment } = await supabase
          .from("enrollments")
          .select("status")
          .eq("student_id", user.id)
          .eq("course_id", courseId);
        if (enrollment && enrollment.length > 0) {
          setStatus(
            enrollment.some((e) => e.status === "active") ? "active" : "pending"
          );
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
      }

      setLoading(false);
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

  async function requestSubscription() {
    setBusy(true);
    setMessage("");
    const supabase = client();
    const { error } = await supabase
      .from("enrollments")
      .insert({ student_id: studentId, course_id: courseId });
    if (error) {
      setMessage("خطأ إرسال الطلب: " + error.message);
    } else {
      setMessage("تم إرسال طلب الاشتراك، الأستاذ هيراجعه قريبًا إن شاء الله.");
      setStatus("pending");
    }
    setBusy(false);
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
      <p>{course.description}</p>

      {message && <p role="alert">{message}</p>}

      {!isTeacher && canView && lessons.length > 0 && (
        <div
          style={{
            background: "white",
            border: "1px solid #e0e4ea",
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
            <strong style={{ color: "var(--navy)" }}>تقدمك في الكورس</strong>
            <span style={{ color: "var(--muted)" }}>
              خلصت {completedCount} من {lessons.length} درس ({coursePercent}%)
            </span>
          </div>
          <div
            style={{
              background: "#e8ebf0",
              borderRadius: "8px",
              height: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: coursePercent === 100 ? "#2e9e5b" : "var(--gold)",
                height: "100%",
                width: `${coursePercent}%`,
                transition: "width 0.4s",
              }}
            />
          </div>
        </div>
      )}

      {!canView && (
        <div className="notice">
          {status === "active" && (
            <p>أنت مشترك في هذا الكورس ✅ الدروس هتظهر هنا أول ما تتنشر.</p>
          )}
          {status === "pending" && <p>طلبك قيد المراجعة ⏳</p>}
          {!status && (
            <>
              <p>محتوى الكورس متاح للمشتركين فقط.</p>
              <button onClick={requestSubscription} disabled={busy}>
                {busy
                  ? "جاري إرسال الطلب..."
                  : course.price > 0
                    ? `اشترك الآن - ${course.price} جنيه`
                    : "اشترك مجانًا"}
              </button>
            </>
          )}
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
                border: "1px solid #e0e4ea",
                borderRadius: "12px",
                padding: "16px",
                marginTop: "16px",
                background: "white",
              }}
            >
              <h3 style={{ margin: "0 0 8px", color: "var(--navy)" }}>
                الدرس {lesson.sort_order}: {lesson.title}
                {!isTeacher && p?.completed && (
                  <span style={{ color: "#2e9e5b", marginInlineStart: "8px" }}>
                    ✓ خلصته
                  </span>
                )}
              </h3>
              {lesson.description && <p>{lesson.description}</p>}

              {!isTeacher && lesson.video_path && p && (
                <div
                  style={{
                    background: "#e8ebf0",
                    borderRadius: "6px",
                    height: "6px",
                    overflow: "hidden",
                    marginBottom: "10px",
                    maxWidth: "300px",
                  }}
                >
                  <div
                    style={{
                      background: p.completed ? "#2e9e5b" : "var(--gold)",
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
                    background: "var(--navy)",
                    color: "white",
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
                    border: "1px solid var(--navy)",
                    borderRadius: "10px",
                    background: "white",
                    color: "var(--navy)",
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
                  border: "1px solid #d7dce4",
                  borderRadius: "10px",
                  background: "white",
                  color: "var(--muted)",
                  cursor: "pointer",
                }}
              >
                💬 النقاش
              </button>

              {openVideo?.id === lesson.id && (
                <video
                  src={openVideo.url}
                  controls
                  style={{
                    width: "100%",
                    marginTop: "12px",
                    borderRadius: "10px",
                  }}
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
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

      {canView && exams.length > 0 && (
        <>
          <h2 style={{ color: "var(--navy)", marginTop: "30px" }}>الاختبارات</h2>
          {exams.map((exam) => (
            <section
              key={exam.id}
              style={{
                border: "1px solid #e0e4ea",
                borderRadius: "12px",
                padding: "16px",
                marginTop: "16px",
                background: "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div>
                <strong style={{ color: "var(--navy)" }}>{exam.title}</strong>
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
                  background: "var(--navy)",
                  color: "white",
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
    </main>
  );
}
