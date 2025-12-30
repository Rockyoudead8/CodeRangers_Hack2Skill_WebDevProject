//src\app\signup\page.tsx

"use client";
import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import toast from "react-hot-toast";

const passwordCriteria = [
  { label: "At least 10 characters", test: (pw: any) => pw.length >= 10 },
  {
    label: "At least one uppercase letter",
    test: (pw: any) => /[A-Z]/.test(pw),
  },
  {
    label: "At least one lowercase letter",
    test: (pw: any) => /[a-z]/.test(pw),
  },
  { label: "At least one number", test: (pw: any) => /[0-9]/.test(pw) },
  {
    label: "At least one special character",
    test: (pw: any) => /[!@#$%^&*(),.?\":{}|<>]/.test(pw),
  },
];

export default function SignupPage() {
  const router = useRouter();
  const [user, setUser] = React.useState({
    email: "",
    password: "",
    username: "",
  });
  const [darkMode, setDarkMode] = React.useState(false);
  const [disable, setDisable] = React.useState(true);
  const [isEmail, setIsEmail] = React.useState(true);
  const [passwordChecks, setPasswordChecks] = React.useState(
    passwordCriteria.map(() => false)
  );
  const [showPassword, setShowPassword] = React.useState(false);
  const [showCriteria, setShowCriteria] = React.useState(false);

  function validateEmail(email: any) {
    return /\S+@\S+\.\S+/.test(email);
  }

  React.useEffect(() => {
    setIsEmail(user.email === "" || validateEmail(user.email));
  }, [user.email]);

  React.useEffect(() => {
    setPasswordChecks(passwordCriteria.map((c) => c.test(user.password)));
    if (user.password.length === 0) setShowCriteria(false);
  }, [user.password]);

  React.useEffect(() => {
    const allPasswordValid = passwordChecks.every(Boolean);
    setDisable(
      !(
        user.email.length > 0 &&
        user.username.length > 0 &&
        user.password.length > 0 &&
        isEmail &&
        allPasswordValid
      )
    );
  }, [user, isEmail, passwordChecks]);

  const onSingUp = async () => {
    try {
      const response = await axios.post("/api/users/signup", user);
      console.log("Success : \n", response.data);
      setTimeout(() => {
        router.push("/login");
      }, 5000);
    } catch (error: any) {
      console.log("Sign Up Failed.", error.message);
      toast.error(error.message);
    }
  };

  const passwordMsg = (() => {
    if (user.password.length === 0) return null;
    const isAllFullfilled = passwordChecks.every(Boolean);
    return isAllFullfilled
      ? { text: "All password criteria fulfilled.", color: "text-green-600" }
      : {
          text: "Password criteria is not fulfilled. See criteria.",
          color: "text-red-600",
        };
  })();

  return (
    <div
      className={`${
        darkMode ? "dark" : ""
      } min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 relative transition-colors`}
    >
      <button
        className="absolute top-6 left-6 flex items-center gap-2 px-3 py-2 rounded bg-white dark:bg-gray-800 shadow hover:shadow-md transition"
        onClick={() => setDarkMode((v) => !v)}
      >
        {darkMode ? "🌙 Dark" : "☀️ Light"}
      </button>
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-center text-gray-900 dark:text-gray-100 mb-2">
          Sign Up
        </h1>
        <div className="flex flex-col gap-4">
          {/* Username input and reserved message space */}
          <label className="flex flex-col gap-1">
            <span className="text-gray-700 dark:text-gray-200">Username</span>
            <input
              type="text"
              className="input input-bordered px-4 py-2 border rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
              value={user.username}
              onChange={(e) => setUser({ ...user, username: e.target.value })}
              placeholder="Enter your username"
            />
            {/* Reserve space for message (keeps vertical rhythm) */}
            <span className="block h-5" aria-hidden="true"></span>
          </label>
          {/* Email input and dynamic message */}
          <label className="flex flex-col gap-1">
            <span className="text-gray-700 dark:text-gray-200">Email</span>
            <input
              type="email"
              className="input input-bordered px-4 py-2 border rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
              value={user.email}
              onChange={(e) => setUser({ ...user, email: e.target.value })}
              placeholder="Enter your email"
            />
            <span
              className={`text-xs mt-1 block h-5 transition-all duration-300 ease-in-out ${
                !isEmail && user.email.length > 0
                  ? "visible text-red-600 opacity-100"
                  : "invisible opacity-0"
              }`}
            >
              Email is invalid.
            </span>
          </label>
          {/* Password input, reveal toggle, criteria with smooth transitions */}
          <label className="flex flex-col gap-1 relative">
            <span className="text-gray-700 dark:text-gray-200">Password</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="input input-bordered px-4 py-2 border rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white outline-none w-full"
                value={user.password}
                onChange={(e) => setUser({ ...user, password: e.target.value })}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-300 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <div className="relative min-h-4">
              <button
                type="button"
                className={`text-xs font-medium underline cursor-pointer transition-all duration-300 ease-in-out
                  ${passwordMsg?.color}
                  ${
                    passwordMsg && user.password.length > 0
                      ? "opacity-100 max-h-10"
                      : "opacity-0 max-h-0 pointer-events-none"
                  }
                `}
                style={{ outline: "none" }}
                onClick={() => setShowCriteria((v) => !v)}
                tabIndex={0}
              >
                {passwordMsg?.text}
              </button>
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden
                  ${
                    showCriteria
                      ? "max-h-40 opacity-100 mt-2"
                      : "max-h-0 opacity-0"
                  }
                `}
              >
                <ul className="flex flex-col gap-1 text-xs">
                  {passwordCriteria.map((crit, i) => (
                    <li
                      key={i}
                      className={`flex items-center gap-1 ${
                        passwordChecks[i] ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {passwordChecks[i] ? (
                        <FaCheckCircle className="inline-block" />
                      ) : (
                        <FaTimesCircle className="inline-block" />
                      )}
                      {crit.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </label>
          <button
            onClick={onSingUp}
            disabled={disable}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded shadow mt-4 transition"
          >
            {disable ? "Fill the details" : "Create Account"}
          </button>
        </div>
        <div className="text-center text-gray-600 dark:text-gray-300 text-sm">
          Already have an account?
          <Link
            href="/login"
            className="underline ml-1 text-blue-600 dark:text-blue-400"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
