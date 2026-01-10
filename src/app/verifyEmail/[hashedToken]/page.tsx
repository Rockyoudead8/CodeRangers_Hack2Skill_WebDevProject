"use client";
import { use } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import React from "react";
import toast from "react-hot-toast";

export default function VerifyEmail({
  params,
}: {
  params: Promise<{ hashedToken: string }>;
}) {
  // Unwrap params Promise
  const { hashedToken } = use(params);
  const [status, setStatus] = React.useState("Verifying...");
  const route = useRouter();

  React.useEffect(() => {
    const verify = async () => {
      try {
        console.log("sending hashed token : ",hashedToken);

        const response = await axios.post("/api/users/verifyEmail", { hashedToken });

        console.log("Response : ",response);

        setStatus(hashedToken);

        toast.success("Email verification successful!");
        
        setTimeout(() => {
          route.push("/login");
        }, 10000); // Give time for toast to show
      
      } 
      
      catch (e) {
        
        setStatus("Verification Failed");
        
        toast.error("Email verification failed. Sign up again!");
        setTimeout(() => {
          route.push("/signup");
        }, 10000); // Give time for toast to show
      
      }
    };
    
    verify();

  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f5f6fa"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "12px",
        boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
        padding: "32px 40px",
        minWidth: "320px",
        textAlign: "center"
      }}>
        <h2 style={{ marginBottom: 0 }}>{status}</h2>
      </div>
    </div>
  );
}
