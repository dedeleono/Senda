"use client";

import * as z from 'zod'
import { useState, useCallback, memo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, UseFormReturn } from "react-hook-form";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle2, ArrowRight, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

import dynamic from 'next/dynamic';
const GoogleSignInButton = dynamic(
  () => import("@/components/auth/google-auth-button"),
  { ssr: true }
);

const formSchema = z.object({
  email: z.string().email({ message: "Enter a valid email address" }),
});

type UserFormValue = z.infer<typeof formSchema>;

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 }
  }
};

const MotionDiv = motion.div;

const EmailSentSuccess = memo(({ onReset }: { onReset: () => void }) => (
  <MotionDiv variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-md mx-auto">
    <Card className="border-none shadow-lg bg-background/80 backdrop-blur-sm rounded-xl">
      <CardHeader className="space-y-4 pb-8">
        <div className="mx-auto rounded-full bg-primary/10 p-4 w-fit">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-2xl font-bold text-center">Check your email</CardTitle>
          <CardDescription className="text-center text-base">Magic link sent</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border bg-card/50 p-4">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">Email sent successfully</p>
            <p className="text-sm text-muted-foreground">Close window</p>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={onReset}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go back to login
        </Button>
      </CardContent>
    </Card>
  </MotionDiv>
))

EmailSentSuccess.displayName = 'EmailSentSuccess';

const EmailField = memo(({ 
  form, 
  loading, 
}: { 
  form: UseFormReturn<UserFormValue>, 
  loading: boolean, 
}) => (
  <FormField
    control={form.control}
    name="email"
    render={({ field }) => (
      <FormItem>
        <FormLabel className="text-sm font-medium">Email</FormLabel>
        <FormControl>
          <Input
            type="email"
            placeholder="Email"
            disabled={loading}
            className="h-11 bg-muted/30 border-muted-foreground/20 placeholder:text-xs"
            {...field}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
));

EmailField.displayName = 'EmailField';

const FormFooter = memo(() => (
  <CardFooter className="text-center px-8 pb-8">
    <p className="text-sm text-muted-foreground">
      Terms of Service{" "}
      <a
        href="#"
        className="underline hover:text-primary transition-colors"
      >
        Terms of Service
      </a>{" "}
      and{" "}
      <a
        href="#"
        className="underline hover:text-primary transition-colors"
      >
        Privacy Policy
      </a>
    </p>
  </CardFooter>
));

FormFooter.displayName = 'FormFooter';

function AuthFormComponent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [loading, setLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(() => {
    // Initialize from sessionStorage during component initialization
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('emailSent') === 'true';
    }
    return false;
  });
  const [error, setError] = useState<string | null>(null);
  
  const isSubmittingRef = useRef(false);
  
  useEffect(() => {
    const persistedEmailSent = sessionStorage.getItem('emailSent');
    if (persistedEmailSent === 'true') {
      setIsEmailSent(true);
    }
  }, []);

  const form = useForm<UserFormValue>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = useCallback(async (data: UserFormValue) => {
    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    
    setLoading(true);
    setError(null);
    try {
      

      let callbackUrlValue = callbackUrl || "/";
      
      const result = await signIn("email", {
        email: data.email,
        callbackUrl: callbackUrlValue,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      if (result?.ok) {
        sessionStorage.setItem('emailSent', 'true');
        setIsEmailSent(true);
        setLoading(false);
        return;
      } else {
        throw new Error('Failed to send login email');
      }
    } catch (error) {
      console.error("Error signing in:", error);
      setError(error instanceof Error ? error.message : 'Failed to send login link');
      setLoading(false);
    } finally {
      if (!isEmailSent) {
        setLoading(false);
      }
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 300);
    }
  }, [callbackUrl, loading, isEmailSent]);

  const resetEmailSent = useCallback(() => {
    sessionStorage.removeItem('emailSent');
    setIsEmailSent(false);
  }, []);

  if (isEmailSent) {
    return <EmailSentSuccess onReset={resetEmailSent} />;
  }

  return (
    <div className="w-full backdrop-blur-sm bg-background/80 rounded-3xl shadow-lg p-8 border border-border/50 transition-all duration-300 hover:shadow-xl">
      <MotionDiv
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md mx-auto"
      >
        <Card className="border-none shadow-lg p-4 rounded-xl">
          <CardContent className="space-y-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-5"
              >
                <EmailField form={form} loading={loading} />

                <Button
                  disabled={loading}
                  className="w-full h-11 font-medium text-sm"
                  type="submit"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                      <span>Sending link</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-2">
                      Continue with email
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>
            </Form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-muted-foreground/20" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-4 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <GoogleSignInButton />
          </CardContent>
          <FormFooter />
        </Card>
      </MotionDiv>
    </div>
  );
}

export default memo(AuthFormComponent);
