import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface KoalaWelcomeEmailProps {
  userFirstname: string;
}

const baseUrl = "https://saber-ver-v2.vercel.app";

export const KoalaWelcomeEmail = ({
  userFirstname,
}: KoalaWelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>
      Bienvenido a la plataforma de Maverick Capital Investment
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src={`${baseUrl}/logo.png`}
          width="170"
          height="50"
          alt="Maverick Capital Investment"
          style={logo}
        />
        <Text style={paragraph}>Hola {userFirstname},</Text>
        <Text style={paragraph}>
          Bienvenido a Maverick Capital Investment, tu plataforma OTC
        </Text>
        <Section style={btnContainer}>
          <Button style={button} href="https://www.maverickcapitalinvestment.com/plataforma">
            Comenzar
          </Button>
        </Section>
        <Text style={paragraph}>
          Saludos cordiales,
          <br />
          El equipo de Maverick Capital Investment
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Maverick Capital Investment — Tu camino hacia la libertad financiera
        </Text>
      </Container>
    </Body>
  </Html>
);

KoalaWelcomeEmail.PreviewProps = {
  userFirstname: "Juan",
} as KoalaWelcomeEmailProps;

export default KoalaWelcomeEmail;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
};

const logo = {
  margin: "0 auto",
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "26px",
};

const btnContainer = {
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#034180",
  borderRadius: "3px",
  color: "#fff",
  fontSize: "16px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px",
};

const hr = {
  borderColor: "#cccccc",
  margin: "20px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
};
