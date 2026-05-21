import nodemailer from 'nodemailer'

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const config = useRuntimeConfig()

  if (!config.gmailUser || !config.gmailPass) {
    return { sent: false, reason: 'GMAIL_NOT_CONFIGURED' as const }
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
    auth: {
      user: config.gmailUser,
      pass: config.gmailPass
    }
  })

  await transporter.verify()

  await transporter.sendMail({
    from: `"Toca dos Nerds" <${config.gmailUser}>`,
    to,
    subject: 'Redefinicao de senha - Toca dos Nerds',
    text: `Use este link para redefinir sua senha: ${resetUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#080711;color:#f8f4ff;padding:24px">
        <h1 style="color:#ff8a13">Toca dos Nerds</h1>
        <p>Recebemos uma solicitacao para redefinir sua senha.</p>
        <p><a href="${resetUrl}" style="color:#ff8a13">Redefinir senha</a></p>
        <p style="color:#a6a2bd">Se voce nao pediu isso, ignore este email.</p>
      </div>
    `
  })

  return { sent: true as const }
}

export async function sendVerificationEmail(to: string, subject: string, verificationUrl: string, summary: string) {
  const config = useRuntimeConfig()

  if (!config.gmailUser || !config.gmailPass) {
    return { sent: false, reason: 'GMAIL_NOT_CONFIGURED' as const }
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
    auth: {
      user: config.gmailUser,
      pass: config.gmailPass
    }
  })

  await transporter.verify()

  await transporter.sendMail({
    from: `"Toca dos Nerds" <${config.gmailUser}>`,
    to,
    subject,
    text: `${summary}\n\nConfirme neste link: ${verificationUrl}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#080711;color:#f8f4ff;padding:24px">
        <h1 style="color:#ff8a13">Toca dos Nerds</h1>
        <p>${summary}</p>
        <p><a href="${verificationUrl}" style="color:#ff8a13">Confirmar alteracao</a></p>
        <p style="color:#a6a2bd">Se voce nao pediu isso, ignore este email.</p>
      </div>
    `
  })

  return { sent: true as const }
}
