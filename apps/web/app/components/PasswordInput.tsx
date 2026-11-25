"use client";

import { useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  required?: boolean;
  autoComplete?: string;
};

function EyeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function PasswordInput({
  value,
  onChange,
  minLength,
  required = true,
  autoComplete,
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={minLength}
        required={required}
        autoComplete={autoComplete}
        style={{ paddingInlineEnd: "44px" }}
      />
      <button
        type="button"
        aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        title={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        onClick={() => setShow((s) => !s)}
        style={{
          position: "absolute",
          insetInlineEnd: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px",
          color: "#6b7280",
          display: "flex",
          alignItems: "center",
        }}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
