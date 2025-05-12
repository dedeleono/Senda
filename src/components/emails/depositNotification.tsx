import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Button,
  Tailwind,
  Section,
  Row,
  Column,
  Hr,
} from '@react-email/components'
import * as React from 'react'

interface InvitationEmailProps {
  email: string;
  amount: number;
  token: string;
  senderName?: string;
}

export default function DepositNotificationEmail({
  email,
  amount,
  token,
  senderName
}: InvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${senderName || email} has sent you ${amount} ${token} through Senda`}</Preview>
      <Tailwind>
        <Body className="bg-white font-sans">
          <Container className="mx-auto py-8 px-4">
            <Heading className="text-2xl font-bold text-center mb-4 text-[#034180]">
              {"You've received something!"}
            </Heading>

            <Section className="bg-[#f6ead7]/30 border border-[#f6ead7] rounded-lg p-6 mb-6">
              <Row>
                <Column>
                  <Heading className="text-xl font-bold text-center mb-2">{senderName} has sent you</Heading>
                  <Heading className="text-2xl font-bold text-center mb-4">
                    {amount} {token}
                  </Heading>
                  <Text className="text-gray-600 text-center">
                    To claim these funds, you'll need to login to your Senda account.
                  </Text>
                </Column>
              </Row>
            </Section>

            <Text className="text-gray-600 mb-4">
              Senda is a secure platform for sending and receiving digital currency. Creating your account takes just a
              minute.
            </Text>

            <Text className="text-gray-600 mb-4">
              You can use this email address to create a new account.
            </Text>

            <Section className="text-center mb-6">
              <Button
                className="bg-[#034180] text-white px-6 py-3 rounded-md font-medium hover:bg-[#023366]"
                href={'https://senda-dapp.vercel.app/home'}
              >
                {'Withdraw Funds'}
              </Button>
            </Section>

            <Hr className="border-gray-200 my-6" />

            <Text className="text-gray-500 text-sm">
              This invitation link will expire in 24 hours. If you have any questions, please contact support@senda.com.
            </Text>

            <Text className="text-gray-400 text-xs text-center mt-6">© 2023 Senda. All rights reserved.</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
