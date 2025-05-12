"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useSession } from "next-auth/react";
import { 
  InputOTP,
  InputOTPGroup,
  InputOTPSlot
} from "@/components/ui/input-otp";
import Link from "next/link";

const codeSchema = z.string().length(6).regex(/^\d+$/);

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 }
  }
};

const MotionDiv = motion.div;

export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCodeValid, setIsCodeValid] = useState(true);
  const [isVerificationSuccessful, setIsVerificationSuccessful] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/home";

  

  const handleVerification = async (): Promise<void> => {
    try {
      if (!session?.user?.email) {
        toast.error("No user email found in session");
        return;
      }

      codeSchema.parse(verificationCode);
      setIsCodeValid(true);
      setIsLoading(true);
      
      console.log("Submitting 2FA verification for:", session.user.email);
      
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          email: session.user.email,
          token: verificationCode 
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log("2FA verification successful");
        toast.success("Verification successful");
        setIsVerificationSuccessful(true);
        
        await update({
          needs2FA: false
        });
        
        console.log("Redirecting to:", callbackUrl);
        router.push(callbackUrl);
      } else {
        console.error("2FA verification failed:", data.error);
        toast.error(data.error || "Verification failed");
      }
    } catch (error) {
      console.error("Error during 2FA verification:", error);
      if (error instanceof z.ZodError) {
        setIsCodeValid(false);
        toast.error("Please enter a valid 6-digit code");
      } else {
        toast.error("An error occurred during verification");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    await handleVerification();
  };

  useEffect(() => {
    if (verificationCode.length === 6 && !isLoading) {
      handleVerification()
    }
  }, [verificationCode, handleVerification, isLoading])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    }
  }, [status, router, callbackUrl])

  if (status === "loading" && !isVerificationSuccessful) {
    return (
      <div className="min-h-screen bg-primary/30 dark:bg-primary/30 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-primary/30 dark:bg-primary/30 flex items-center justify-center p-6">
      <div className="absolute top-6 right-6 flex items-center gap-2 flex-row">
        {/* <Suspense fallback={<div className="w-9 h-9" />}>
          <ThemeToggle />
        </Suspense> */}
      </div>

      <div className="flex flex-col items-center w-full max-w-md">
        <div className="mb-8 transform hover:scale-105 transition-transform duration-200">
          <Link href="/">
            {/* <Logo width={150} height={150} /> */}
            Senda
          </Link>
        </div>

        <div className="w-full backdrop-blur-sm bg-background/80 rounded-3xl shadow-lg p-8 border border-border/50 transition-all duration-300 hover:shadow-xl">
          <MotionDiv
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-md mx-auto"
          >
            <Card className="border-none shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex flex-col items-center space-y-3 text-center">
                  <div className="rounded-full bg-primary/10 p-4 w-fit">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold">
                      Two-Factor Authentication
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Enter the verification code from your authenticator app
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isVerificationSuccessful && (
                  <div className="flex flex-col items-center justify-center space-y-4 py-6">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-quaternary/80 border-t-transparent" />
                    {/* <p className="text-quaternary/80 font-medium text-center">
                      Success! Just a sec...
                    </p> */}
                  </div>
                )}
                {!isVerificationSuccessful && (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={verificationCode}
                          onChange={setVerificationCode}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          disabled={isLoading}
                          containerClassName="gap-2"
                        >
                          <InputOTPGroup>
                            {Array.from({ length: 6 }).map((_, i) => (
                              <InputOTPSlot
                                key={i}
                                index={i}
                                className="w-10 h-12 bg-muted/30 border-muted-foreground/20"
                              />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      {!isCodeValid && (
                        <p className="text-sm text-destructive text-center">
                          Please enter a valid 6-digit code
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-11 font-medium text-sm"
                      disabled={isLoading || verificationCode.length !== 6}
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                          <span>Verifying</span>
                        </div>
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </MotionDiv>
        </div>
      </div>
    </div>
  );
} 