"""Email sending service with SMTP support and logging fallback."""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_html_body(title: str, body: str, action_url: str | None = None) -> str:
    action_btn = ""
    if action_url:
        action_btn = f"""
        <tr>
          <td style="padding:20px 0 0;">
            <a href="{action_url}"
               style="display:inline-block;padding:12px 28px;background:#4f46e5;color:#fff;
                      text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
              Ver en la App
            </a>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">
          <tr>
            <td style="background:#4f46e5;padding:24px 32px;">
              <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700;">
                {settings.smtp_from_name}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px;font-size:20px;color:#18181b;">{title}</h2>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#3f3f46;">
                {body}
              </p>
              {action_btn}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
                Este correo fue enviado automáticamente por {settings.smtp_from_name}.<br>
                No respondas a este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_email(to_email: str, subject: str, title: str, body: str, action_url: str | None = None) -> bool:
    """Send an HTML email. Returns True if sent, False otherwise."""
    if not settings.smtp_enabled:
        logger.info("[EMAIL-SKIP] SMTP disabled. To: %s | Subject: %s | Body: %s", to_email, subject, body)
        return False

    if not settings.smtp_user or not settings.smtp_password:
        logger.warning("[EMAIL-SKIP] SMTP credentials not configured.")
        return False

    from_email = settings.smtp_from_email or settings.smtp_user
    html_body = _build_html_body(title, body, action_url)

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.smtp_from_name} <{from_email}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(from_email, [to_email], msg.as_string())
        logger.info("[EMAIL-SENT] To: %s | Subject: %s", to_email, subject)
        return True
    except Exception:
        logger.exception("[EMAIL-FAIL] To: %s | Subject: %s", to_email, subject)
        return False
