import type { SupabaseClient } from "@supabase/supabase-js";

// يسجّل حركة في دفتر الحسابات. بيفشل بهدوء لو سكريبت المرحلة 2 لسه ما اتشغّلش.
export async function logPaymentEvent(
  supabase: SupabaseClient,
  enrollmentId: string,
  event: "submitted" | "approved" | "rejected" | "manual_add" | "refunded",
  amount?: number | null,
  note?: string | null
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("payment_events").insert({
      enrollment_id: enrollmentId,
      actor_id: user?.id ?? null,
      event,
      amount: amount ?? null,
      note: note ?? null,
    });
  } catch {
    // الجدول لسه مش موجود — مفيش مشكلة، الدفتر هيبدأ يتسجّل بعد السكريبت.
  }
}
