import { env } from '../config/env.js'

export async function sendOtpEmail({ name, email, passcode }) {
  const payload = {
    service_id: env.EMAILJS_SERVICE_ID,
    template_id: env.EMAILJS_TEMPLATE_ID,
    user_id: env.EMAILJS_PUBLIC_KEY,
    accessToken: env.EMAILJS_PRIVATE_KEY,
    template_params: {
      name,
      email,
      passcode
    }
  }

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const errorBody = await res.text()
    console.error(`EmailJS Error (HTTP ${res.status}):`, errorBody)
    throw new Error('Failed to send OTP email')
  }
}
