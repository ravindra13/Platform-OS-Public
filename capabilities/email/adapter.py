import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication # <-- Add this import

class EmailAdapter:
    """Isolates third-party ESP/SMTP logic from the core engine."""
    def __init__(self, smtp_user: str, smtp_password: str):
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password

    # Add attachment_path as an optional parameter
    async def send_transactional_email(self, to_address: str, subject: str, html_body: str, attachment_path: str = None) -> bool:
        try:
            msg = MIMEMultipart()
            msg['From'] = self.smtp_user
            msg['To'] = to_address
            msg['Subject'] = subject
            msg.attach(MIMEText(html_body, 'html'))

            # <-- NEW ATTACHMENT LOGIC -->
            if attachment_path and os.path.exists(attachment_path):
                with open(attachment_path, "rb") as f:
                    part = MIMEApplication(f.read(), Name=os.path.basename(attachment_path))
                    part['Content-Disposition'] = f'attachment; filename="{os.path.basename(attachment_path)}"'
                    msg.attach(part)
            # <-------------------------->

            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            return True
        except Exception as e:
            print(f"[EmailAdapter] Delivery failed: {e}")
            return False