// app/api/terms/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const termsOfUse = {
    lastUpdated: "01-03-2025",
    content: [
      {
        title: "Acceptance of Terms",
        text: "By accessing or using our Solana Lottery website (\"https://solana-lottery.com\"), you agree to comply with and be bound by these Terms of Service (\"Terms\"). If you do not agree to these Terms, you must not use the Website.",
      },
      {
        title: "Eligibility",
        text: "You must be at least 18 years old to use this Website. By using this Website, you represent and warrant that you are at least 18 years old and have the legal capacity to enter into these Terms.",
      },
      {
        title: "User Responsibilities",
        text: "As a user of the Website, you agree to: Use the Website in compliance with all applicable laws and regulations; Provide accurate and complete information when registering or participating in the lottery; Maintain the security of your account and promptly notify us of any unauthorized use.",
      },
      {
        title: "Lottery Participation",
        text: "Participation in the lottery is at your own risk and responsibility. We are not responsible for any losses or damages incurred as a result of participating in the lottery.",
      },
      {
        title: "No Refund Policy",
        text: "All purchases made on the Website are final and non-refundable. By participating in the lottery, you acknowledge and agree that you will not receive a refund for any reason.",
      },
      {
        title: "Intellectual Property",
        text: "All content on the Website, including text, graphics, logos, and software, is the property of Solana Lottery and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works from any content on the Website without our prior written consent.",
      },
      {
        title: "Disclaimer of Warranties",
        text: "The Website is provided on an \"as is\" and \"as available\" basis. We make no representations or warranties of any kind, express or implied, regarding the operation or availability of the Website, or the accuracy, completeness, or reliability of any information provided on the Website.",
      },
      {
        title: "Limitation of Liability",
        text: "To the fullest extent permitted by applicable law, we shall not be liable for any indirect, incidental, special, or consequential damages arising out of or in connection with your use of the Website, even if we have been advised of the possibility of such damages.",
      },
      {
        title: "Changes to the Terms",
        text: "We reserve the right to modify or update these Terms at any time. Any changes will be effective immediately upon posting on the Website. Your continued use of the Website after the posting of changes constitutes your acceptance of the modified Terms.",
      },
      {
        title: "Governing Law",
        text: "These Terms shall be governed by and construed in accordance with the laws of the USA, without regard to its conflict of law principles.",
      },
    ],
  };

  return NextResponse.json(termsOfUse);
}