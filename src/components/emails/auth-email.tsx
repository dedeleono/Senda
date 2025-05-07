import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

interface AuthEmailProps {
  host: string;
  url: string;
  email?: string;
}

export default function AuthEmail({ host, url, email }: AuthEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Click the link below to sign into your Senda Account</Preview>

      <Tailwind
        config={{
          darkMode: "class",
          theme: {
            extend: {
              fontFamily: {
                sans: ["var(--font-sans)"],
              },
              colors: {
                brand: "hsl(var(--primary))",
                muted: "hsl(var(--muted))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                card: {
                  DEFAULT: "hsl(var(--card))",
                  foreground: "hsl(var(--card-foreground))",
                },
                popover: {
                  DEFAULT: "hsl(var(--popover))",
                  foreground: "hsl(var(--popover-foreground))",
                },
                primary: {
                  DEFAULT: "hsl(var(--primary))",
                  foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                  DEFAULT: "hsl(var(--secondary))",
                  foreground: "hsl(var(--secondary-foreground))",
                },
                accent: {
                  DEFAULT: "hsl(var(--accent))",
                  foreground: "hsl(var(--accent-foreground))",
                },
                destructive: {
                  DEFAULT: "hsl(var(--destructive))",
                  foreground: "hsl(var(--destructive-foreground))",
                },
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                chart: {
                  "1": "hsl(var(--chart-1))",
                  "2": "hsl(var(--chart-2))",
                  "3": "hsl(var(--chart-3))",
                  "4": "hsl(var(--chart-4))",
                  "5": "hsl(var(--chart-5))",
                },
              },
              borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 3.5px)",
                sm: "calc(var(--radius) - 4px)",
              },
            },
          },
        }}
      >
        <Body className="font-sans">
          <Container className="mx-auto my-[20px] px-4 py-5">
            <Section className="mt-2">
              <Link href={host}>
                <Img
                  src="https://dk29k70tan5xj.cloudfront.net/assets/image/Maverick-Green.png"
                  width="150"
                  height="30"
                  alt="Maverick Exchange Logo"
                  style={{
                    maxHeight: "30px",
                    width: "auto",
                  }}
                />
              </Link>
            </Section>

            <Section className="mt-6">
              <Text className="text-2xl font-bold text-[#244746]">
                Login
              </Text>
            </Section>

            <Section className="mt-4">
              <Text className="text-base">
                Click the button below to login as{" "}
                <Link href={host} className="text-primary">
                  {email}
                </Link>
                {". "}
                This link will expire in 10 minutes.
              </Text>
            </Section>

            <Section className="mt-4">
              <table
                style={{
                  borderCollapse: "collapse",
                  marginTop: "16px"
                }}
              >
                <tr>
                  <td
                    style={{
                      backgroundColor: "#244746",
                      borderRadius: "8px",
                      padding: "0",
                    }}
                  >
                    <a
                      href={url}
                      style={{
                        backgroundColor: "#244746",
                        borderRadius: "8px",
                        color: "#FFFFFF",
                        display: "inline-block",
                        fontFamily: "sans-serif",
                        fontSize: "16px",
                        fontWeight: "bold",
                        lineHeight: "1.2",
                        padding: "16px 32px",
                        textAlign: "center",
                        textDecoration: "none",
                      }}
                      target="_blank"
                    >
                      Login
                    </a>
                  </td>
                </tr>
              </table>
            </Section>

            <Section className="mt-4">
              <Text className="text-sm text-primary/60">
                If you didn&apos;t request this email, you can safely ignore it.
              </Text>

              <Text className="text-[0.75rem]">
                Senda, Inc. - All Rights Reserved
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
