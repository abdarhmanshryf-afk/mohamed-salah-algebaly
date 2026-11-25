"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

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
  const [openVideo, setOpenVideo] = useState<{ id: string; url: string } | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});

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
      }

      setLoading(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function openFile(path: string) {
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

  return (
    <main className="subpage">
      <a href="/courses">← الكورسات</a>

      <h1>{course.title}</h1>
      <p>{course.description}</p>

      {message && <p role="alert">{message}</p>}

      {!canView && (
        <div className="notice">
          {status === "active" && <p>أنت مشترك في هذا الكورس ✅ الدروس هتظهر هنا أول ما تتنشر.</p>}
          {status === "pending" && <p>طلبك قيد المراجعة ⏳</p>}
          {!status && (
            <>
              <p>محتوى الكورس متاح للمشتركين فقط.</p>
              <button onClick={requestSubscription} disabled={busy}>
                {busy ? "جاري إرسال الطلب..." : course.price > 0 ? `اشترك الآن - ${course.price} جنيه` : "اشترك مجانًا"}
              </button>
            </>
          )}
        </div>
      )}

      {canView && lessons.length === 0 && (
        <p>لا توجد دروس منشورة في هذا الكورس حتى الآن.</p>
      )}

      {canView &&
        lessons.map((lesson) => (
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
            </h3>
            {lesson.description && <p>{lesson.description}</p>}

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
                ▶ شغل الفيديو
              </button>
            )}
            {lesson.pdf_path && (
              <button
                onClick={() => openFile(lesson.pdf_path!)}
                style={{
                  padding: "10px 20px",
                  border: "1px solid var(--navy)",
                  borderRadius: "10px",
                  background: "white",
                  color: "var(--navy)",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                📄 افتح الملف
              </button>
            )}

            {openVideo?.id === lesson.id && (
              <video
                src={openVideo.url}
                controls
                style={{ width: "100%", marginTop: "12px", borderRadius: "10px" }}
              />
            )}
          </section>
        ))}

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
                {bestScores[exam.id] !== undefined && (
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
                {bestScores[exam.id] !== undefined ? "أعد الاختبار" : "ابدأ الاختبار"}
              </a>
            </section>
          ))}
        </>
      )}

    </main>
  );
}
